import { mlToTokensCt, priceCentsForMl, tokensCtToMl } from "@zitouna/rules";
import { prisma } from "../lib/prisma.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { ledger } from "../ledger/index.js";
import { buildSale, buildTransfer } from "@zitouna/rules";
import { emitLotEvent } from "./events.js";
import { evaluateLot, nextTopicSeq, requireLot } from "./lots.js";
import { assertSaleAllowed, runAgent } from "./agent.js";

export async function resolveAccount(ref) {
  if (!ref) throw badRequest("accountId is required", "MISSING_ACCOUNT");
  const account = await prisma.account.findFirst({
    where: { OR: [{ id: String(ref) }, { hederaAccountId: String(ref) }, { label: String(ref) }] },
  });
  if (!account) throw notFound(`Account ${ref} not found`, "ACCOUNT_NOT_FOUND");
  return account;
}

async function soldMl(lotId) {
  const result = await prisma.trade.aggregate({
    where: { lotId, status: "COMPLETED" },
    _sum: { litresMl: true },
  });
  return result._sum.litresMl ?? 0;
}

export async function buy({ lotId, buyerId, accountId, litresMl, tokensCt, idempotencyKey }) {
  buyerId = buyerId ?? accountId;
  if (!idempotencyKey) throw badRequest("idempotencyKey is required", "MISSING_IDEMPOTENCY_KEY");
  const scope = `buy:${lotId}`;
  const existing = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
  if (existing) {
    if (existing.scope !== scope) throw conflict("Idempotency key reused for another operation", "IDEMPOTENCY_CONFLICT");
    return existing.response;
  }

  const buyer = await resolveAccount(buyerId);
  const bundle = await evaluateLot(lotId);
  const lot = bundle.lot;
  if (!lot.listing?.active) throw badRequest("This lot is not listed for sale", "NOT_LISTED");
  if (["PAUSED", "DEPLETED"].includes(lot.status)) {
    throw conflict(`Lot is ${lot.status}`, "LOT_NOT_OPEN");
  }

  let ml;
  let ct;
  if (litresMl != null) {
    ml = Number(litresMl);
    ct = mlToTokensCt(lot.series, ml);
  } else if (tokensCt != null) {
    ct = Number(tokensCt);
    ml = tokensCtToMl(lot.series, ct);
  } else {
    throw badRequest("Provide litresMl or tokensCt", "MISSING_AMOUNT");
  }
  if (!Number.isInteger(ml) || ml <= 0 || !Number.isInteger(ct) || ct <= 0) {
    throw badRequest("Amount must be a positive representable quantity", "INVALID_AMOUNT");
  }

  const offered = lot.listing.litresOfferedMl;
  const sold = await soldMl(lot.id);
  if (sold + ml > offered) {
    throw conflict("Not enough litres left in this listing", "LISTING_EXHAUSTED", {
      offeredLitres: offered / 1_000,
      soldLitres: sold / 1_000,
      requestedLitres: ml / 1_000,
    });
  }

  const pauseSetting = await prisma.systemSetting.findUnique({ where: { key: "agent:paused" } });
  const gate = assertSaleAllowed(bundle.evaluation, { paused: pauseSetting?.value === "true" });
  if (!gate.ok) throw conflict(gate.message, gate.code, { reasons: gate.reasons });

  if (bundle.evaluation.supplyLitres + ml / 1_000 > bundle.evaluation.attestedLitres + 1e-9) {
    throw conflict("This sale would exceed the attested litres", "RESERVE_HEADROOM", {
      attestedLitres: bundle.evaluation.attestedLitres,
      supplyLitres: bundle.evaluation.supplyLitres,
      requestedLitres: ml / 1_000,
    });
  }

  const pricePerLitreCents = lot.listing.pricePerLitreCents;
  const amountCents = priceCentsForMl(ml, pricePerLitreCents);
  const tusdt = await prisma.token.findFirst({ where: { symbol: "tUSDT" } });
  if (!tusdt) throw badRequest("tUSDT is not provisioned", "TUSDT_MISSING");
  const buyerBalance = await ledger().getTokenBalance(buyer.id, tusdt.tokenId);
  if (buyerBalance < amountCents) {
    throw conflict("Buyer does not have enough tUSDT", "INSUFFICIENT_PAYMENT", {
      balance: buyerBalance / 100,
      required: amountCents / 100,
    });
  }

  const treasury = await prisma.account.findFirst({ where: { role: "TREASURY" } });
  if (!treasury) throw badRequest("Treasury is not provisioned", "TREASURY_MISSING");

  const mint = await ledger().mintFungible(bundle.token.tokenId, ct);
  let swap;
  try {
    swap = await ledger().transferTokens(
      [
        { tokenId: tusdt.tokenId, fromAccountId: buyer.id, toAccountId: lot.producerId, amountCt: amountCents },
        { tokenId: bundle.token.tokenId, fromAccountId: treasury.id, toAccountId: buyer.id, amountCt: ct },
      ],
      `ZitounaDeFi sale ${lot.code} ${(ml / 1_000).toFixed(1)} L`,
    );
  } catch (error) {
    try {
      await ledger().burnFungible(bundle.token.tokenId, ct);
    } catch (burnError) {
      console.error("CRITICAL: swap failed and minted tokens could not be burned", burnError);
    }
    throw error;
  }

  const trade = await prisma.trade.create({
    data: {
      lotId: lot.id,
      buyerId: buyer.id,
      litresMl: ml,
      tokensCt: ct,
      amountCents,
      status: "COMPLETED",
      mintTxId: mint.txId,
      swapTxId: swap.txId,
      idempotencyKey,
    },
  });

  const seq = await nextTopicSeq(lot.topicId);
  const message = await ledger().submitMessage(
    lot.topicId,
    buildSale({
      lotId: lot.code,
      seq,
      ts: Date.now(),
      buyer: buyer.hederaAccountId,
      litresMl: ml,
      tokensCt: ct,
      amountCents,
    }),
    "SALE",
    lot.id,
  );

  const response = {
    tradeId: trade.id,
    lotId: lot.code,
    buyer: { id: buyer.id, label: buyer.label, accountId: buyer.hederaAccountId },
    litres: ml / 1_000,
    tokens: ct / 100,
    amount: amountCents / 100,
    currency: "tUSDT",
    mintTxId: mint.txId,
    swapTxId: swap.txId,
    hcsSeq: message.seq,
    createdAt: trade.createdAt,
  };

  await prisma.idempotencyKey.create({
    data: { key: idempotencyKey, scope, response },
  });

  emitLotEvent(lot.id, { type: "sale", tradeId: trade.id, seq: message.seq, txId: swap.txId });
  await runAgent(lot.id, { writeMessage: false }).catch((error) =>
    console.error("agent re-check after sale failed", error),
  );

  return response;
}

export async function peerTransfer({ lotId, fromId, toId, tokensCt, memo, idempotencyKey }) {
  if (!idempotencyKey) throw badRequest("idempotencyKey is required", "MISSING_IDEMPOTENCY_KEY");
  const scope = `transfer:${lotId}`;
  const existing = await prisma.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
  if (existing) {
    if (existing.scope !== scope) throw conflict("Idempotency key reused for another operation", "IDEMPOTENCY_CONFLICT");
    return existing.response;
  }
  const lot = await requireLot(lotId);
  const from = await resolveAccount(fromId);
  const to = await resolveAccount(toId);
  if (from.id === to.id) throw badRequest("Sender and recipient must differ", "SAME_ACCOUNT");
  const ct = Number(tokensCt);
  if (!Number.isInteger(ct) || ct <= 0) throw badRequest("tokensCt must be a positive integer", "INVALID_AMOUNT");

  const tokenId = await seriesTokenId(lot.series);
  const balance = await ledger().getTokenBalance(from.id, tokenId);
  if (balance < ct) {
    throw conflict("Sender does not hold enough tokens", "INSUFFICIENT_TOKEN_BALANCE", {
      balance: balance / 100,
      requested: ct / 100,
    });
  }

  const tx = await ledger().transferTokens(
    [{ tokenId, fromAccountId: from.id, toAccountId: to.id, amountCt: ct }],
    memo ?? `ZitounaDeFi transfer ${lot.code}`,
  );

  const transfer = await prisma.transfer.create({
    data: {
      lotId: lot.id,
      fromId: from.id,
      toId: to.id,
      tokensCt: ct,
      memo: memo ?? null,
      txId: tx.txId,
      idempotencyKey,
    },
  });

  const seq = await nextTopicSeq(lot.topicId);
  const message = await ledger().submitMessage(
    lot.topicId,
    buildTransfer({
      lotId: lot.code,
      seq,
      ts: Date.now(),
      from: from.hederaAccountId,
      to: to.hederaAccountId,
      tokensCt: ct,
      memo: memo ?? "-",
    }),
    "TRANSFER",
    lot.id,
  );

  const response = {
    transferId: transfer.id,
    lotId: lot.code,
    from: { id: from.id, label: from.label, accountId: from.hederaAccountId },
    to: { id: to.id, label: to.label, accountId: to.hederaAccountId },
    tokens: ct / 100,
    litres: tokensCtToMl(lot.series, ct) / 1_000,
    txId: tx.txId,
    hcsSeq: message.seq,
    createdAt: transfer.createdAt,
  };
  await prisma.idempotencyKey.create({ data: { key: idempotencyKey, scope, response } });
  emitLotEvent(lot.id, { type: "transfer", transferId: transfer.id, seq: message.seq });
  return response;
}

export async function seriesTokenId(series) {
  const token = await prisma.token.findFirst({ where: { kind: "FUNGIBLE", series } });
  if (!token) throw notFound(`Token for ${series} is not provisioned`, "TOKEN_NOT_FOUND");
  return token.tokenId;
}
