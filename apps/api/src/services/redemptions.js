import {
  buildBurn,
  buildHandover,
  buildRedemption,
  seriesConfig,
  sha256Hex,
  tokensCtToMl,
} from "@zitouna/rules";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { nextCode, pickupCode } from "../lib/ids.js";
import { ledger } from "../ledger/index.js";
import { emitLotEvent } from "./events.js";
import { evaluateLot, nextTopicSeq, requireLot } from "./lots.js";
import { resolveAccount } from "./sales.js";
import { runAgent } from "./agent.js";

export function serializeRedemption(redemption) {
  return {
    id: redemption.id,
    code: redemption.code,
    lotId: redemption.lot.code,
    lotDbId: redemption.lotId,
    series: redemption.lot.series,
    holder: {
      id: redemption.holder.id,
      label: redemption.holder.label,
      accountId: redemption.holder.hederaAccountId,
    },
    tokens: redemption.tokensCt / 100,
    litres: redemption.litresMl / 1_000,
    status: redemption.status,
    pickupCode: redemption.pickupCode,
    handoverSource: redemption.handoverSource,
    deadline: redemption.deadline,
    requestedAt: redemption.requestedAt,
    handoverAt: redemption.handoverAt,
    burnedAt: redemption.burnedAt,
    requestTxId: redemption.requestTxId,
    burnTxId: redemption.burnTxId,
    steps: ["REQUESTED", "HANDED_OVER", "BURNED"],
  };
}

export async function requestRedemption({ lotId, holderId, tokensCt, idempotencyKey }) {
  if (!idempotencyKey) throw badRequest("idempotencyKey is required", "MISSING_IDEMPOTENCY_KEY");
  const scope = `redeem:${lotId}`;
  const existing = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
  if (existing) {
    if (existing.scope !== scope) throw conflict("Idempotency key reused for another operation", "IDEMPOTENCY_CONFLICT");
    return existing.response;
  }

  const holder = await resolveAccount(holderId);
  const bundle = await evaluateLot(lotId);
  const lot = bundle.lot;
  const cfg = seriesConfig(lot.series);
  const ct = Number(tokensCt);
  if (!Number.isInteger(ct) || ct <= 0) throw badRequest("tokensCt must be a positive integer", "INVALID_AMOUNT");
  if (ct < cfg.minRedemptionTokens * 100) {
    throw badRequest(
      `Minimum redemption is ${cfg.minRedemptionTokens} ${lot.series} (${cfg.minRedemptionMl / 1_000} L)`,
      "BELOW_MINIMUM",
    );
  }
  if (!bundle.evaluation.allowsRedemptions) {
    throw conflict("The attestation chain is invalid; redemptions are paused", "REDEMPTIONS_PAUSED");
  }

  const tokenId = bundle.token.tokenId;
  const balance = await ledger().getTokenBalance(holder.id, tokenId);
  if (balance < ct) {
    throw conflict("Holder does not have enough tokens", "INSUFFICIENT_TOKEN_BALANCE", {
      balance: balance / 100,
      requested: ct / 100,
    });
  }

  const treasury = await prisma.account.findFirst({ where: { role: "TREASURY" } });
  if (!treasury) throw badRequest("Treasury is not provisioned", "TREASURY_MISSING");

  const code = await nextCode("redemption", "RDM");
  const pin = pickupCode();
  const deadline = new Date(Date.now() + config.policy.redemptionDeadlineSeconds * 1_000);

  const tx = await ledger().transferTokens(
    [{ tokenId, fromAccountId: holder.id, toAccountId: treasury.id, amountCt: ct }],
    `ZITOUNA-REDEEM:${code}`,
  );

  const redemption = await prisma.redemption.create({
    data: {
      code,
      lotId: lot.id,
      holderId: holder.id,
      tokensCt: ct,
      litresMl: tokensCtToMl(lot.series, ct),
      status: "REQUESTED",
      pickupCode: pin,
      requestTxId: tx.txId,
      deadline,
    },
    include: { lot: true, holder: true },
  });

  const message = await ledger().submitMessage(
    lot.topicId,
    buildRedemption({
      lotId: lot.code,
      seq: await nextTopicSeq(lot.topicId),
      ts: Date.now(),
      rid: code,
      holder: holder.hederaAccountId,
      tokensCt: ct,
      litresMl: redemption.litresMl,
    }),
    "REDEMPTION",
    lot.id,
  );

  const response = {
    ...serializeRedemption(redemption),
    hcsSeq: message.seq,
    swapTxId: tx.txId,
  };
  await prisma.idempotencyKey.create({ data: { key: idempotencyKey, scope, response } });
  emitLotEvent(lot.id, { type: "redemption.requested", redemptionId: redemption.id, seq: message.seq });
  return response;
}

export async function getRedemption(idOrCode) {
  const redemption = await prisma.redemption.findFirst({
    where: { OR: [{ id: String(idOrCode) }, { code: String(idOrCode) }] },
    include: { lot: true, holder: true },
  });
  if (!redemption) throw notFound(`Redemption ${idOrCode} not found`, "REDEMPTION_NOT_FOUND");
  return redemption;
}

export async function handover({
  redemptionId,
  source = "OPERATOR",
  pickupCode: providedPin,
  operatorOverride = false,
}) {
  const redemption = await getRedemption(redemptionId);
  if (redemption.status !== "REQUESTED") {
    throw conflict(`Redemption is ${redemption.status}`, "INVALID_REDEMPTION_STATE");
  }
  if (providedPin && providedPin !== redemption.pickupCode) {
    throw conflict("Pickup code does not match", "BAD_PICKUP_CODE");
  }
  if (!providedPin && !operatorOverride) {
    throw badRequest("Provide the pickup code or operatorOverride:true", "PICKUP_CODE_REQUIRED");
  }
  const lot = redemption.lot;
  const token = await prisma.token.findFirst({ where: { kind: "FUNGIBLE", series: lot.series } });
  if (!token) throw notFound("Series token is not provisioned", "TOKEN_NOT_FOUND");

  const burn = await ledger().burnFungible(token.tokenId, redemption.tokensCt);
  const now = new Date();
  const updated = await prisma.redemption.update({
    where: { id: redemption.id },
    data: {
      status: "BURNED",
      burnTxId: burn.txId,
      handoverTxId: burn.txId,
      handoverAt: now,
      burnedAt: now,
      handoverSource: source,
    },
    include: { lot: true, holder: true },
  });
  await prisma.lot.update({
    where: { id: lot.id },
    data: { remainingMl: Math.max(0, lot.remainingMl - redemption.litresMl) },
  });

  const handoverText = buildHandover({
    lotId: lot.code,
    seq: await nextTopicSeq(lot.topicId),
    ts: now.getTime(),
    rid: redemption.code,
    source,
    pickupHash: (await sha256Hex(`${redemption.code}:${redemption.pickupCode}`)).slice(0, 24),
  });
  const handoverMessage = await ledger().submitMessage(lot.topicId, handoverText, "HANDOVER", lot.id);
  const burnText = buildBurn({
    lotId: lot.code,
    seq: await nextTopicSeq(lot.topicId),
    ts: Date.now(),
    rid: redemption.code,
    tokensCt: redemption.tokensCt,
  });
  const burnMessage = await ledger().submitMessage(lot.topicId, burnText, "BURN", lot.id);

  emitLotEvent(lot.id, {
    type: "redemption.burned",
    redemptionId: redemption.id,
    handoverSeq: handoverMessage.seq,
    burnSeq: burnMessage.seq,
  });
  await runAgent(lot.id, { writeMessage: false }).catch((error) =>
    console.error("agent re-check after burn failed", error),
  );

  return {
    ...serializeRedemption(updated),
    handoverSeq: handoverMessage.seq,
    burnSeq: burnMessage.seq,
    burnTxId: burn.txId,
  };
}

export async function returnRedemption({ redemptionId, force = false }) {
  const redemption = await getRedemption(redemptionId);
  if (redemption.status !== "REQUESTED") {
    throw conflict(`Redemption is ${redemption.status}`, "INVALID_REDEMPTION_STATE");
  }
  if (!force && new Date(redemption.deadline).getTime() > Date.now()) {
    throw conflict("The handover deadline has not passed", "DEADLINE_NOT_REACHED");
  }
  const treasury = await prisma.account.findFirst({ where: { role: "TREASURY" } });
  const token = await prisma.token.findFirst({ where: { kind: "FUNGIBLE", series: redemption.lot.series } });
  if (!treasury || !token) throw badRequest("Treasury or token is not provisioned", "NOT_PROVISIONED");
  const tx = await ledger().transferTokens(
    [
      {
        tokenId: token.tokenId,
        fromAccountId: treasury.id,
        toAccountId: redemption.holderId,
        amountCt: redemption.tokensCt,
      },
    ],
    `ZITOUNA-RETURN:${redemption.code}`,
  );
  const updated = await prisma.redemption.update({
    where: { id: redemption.id },
    data: { status: "RETURNED", handoverSource: "DEADLINE" },
    include: { lot: true, holder: true },
  });
  emitLotEvent(redemption.lotId, { type: "redemption.returned", redemptionId: redemption.id });
  return { ...serializeRedemption(updated), returnTxId: tx.txId };
}

export async function listRedemptions(accountRef) {
  let holderId;
  if (accountRef) holderId = (await resolveAccount(accountRef)).id;
  const rows = await prisma.redemption.findMany({
    where: holderId ? { holderId } : undefined,
    orderBy: { requestedAt: "desc" },
    include: { lot: true, holder: true },
    take: 50,
  });
  return rows.map(serializeRedemption);
}
