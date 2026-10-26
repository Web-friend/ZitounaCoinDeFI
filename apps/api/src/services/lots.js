import {
  buildGenesis,
  buildListing,
  evaluateLotFromRecords,
  pricePerTokenCents,
  seriesConfig,
  tndCentsFromUsdCents,
  VERDICTS,
} from "@zitouna/rules";
import { config, hashscanToken, hashscanTopic } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { badRequest, notFound } from "../lib/errors.js";
import { nextCode } from "../lib/ids.js";
import { ledger } from "../ledger/index.js";
import { ensureAuditor } from "./auditor.js";
import { emitLotEvent } from "./events.js";

export async function findLot(idOrCode) {
  return prisma.lot.findFirst({
    where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
    include: {
      producer: true,
      listing: true,
      attestations: { orderBy: { seq: "asc" } },
      verdicts: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export async function requireLot(idOrCode) {
  const lot = await findLot(idOrCode);
  if (!lot) throw notFound(`Lot ${idOrCode} not found`, "LOT_NOT_FOUND");
  return lot;
}

export async function genesisMessage(lot) {
  if (!lot.topicId) return null;
  return prisma.ledgerMessage.findFirst({
    where: { topicId: lot.topicId, type: "GENESIS" },
    orderBy: { seq: "asc" },
  });
}

export async function chainRecords(lot) {
  const genesis = await genesisMessage(lot);
  if (!genesis) throw notFound(`Genesis message missing for ${lot.code}`, "GENESIS_MISSING");
  return {
    genesis,
    attestations: lot.attestations.map((attestation) => ({
      text: attestation.recordText,
      signature: attestation.signature,
      seq: attestation.seq,
      consensusTs: attestation.consensusTs,
      chainHash: attestation.chainHash,
    })),
  };
}

export async function staleMsForLot() {
  const setting = await prisma.systemSetting.findUnique({ where: { key: "demo:staleSeconds" } });
  const seconds = setting ? Number(setting.value) : config.policy.attestationStaleSeconds;
  return (Number.isFinite(seconds) ? seconds : config.policy.attestationStaleSeconds) * 1_000;
}

export async function evaluateLot(lotInput) {
  const lot = typeof lotInput === "string" ? await requireLot(lotInput) : lotInput;
  const token = await prisma.token.findFirst({
    where: { series: lot.series, kind: "FUNGIBLE" },
  });
  if (!token) throw notFound(`Token for series ${lot.series} is not provisioned`, "TOKEN_NOT_FOUND");
  const { genesis, attestations } = await chainRecords(lot);
  const supplyCt = await ledger().getTotalSupply(token.tokenId);
  const lastAttestation = lot.attestations.at(-1);
  const burned = lastAttestation
    ? await prisma.redemption.aggregate({
        where: { lotId: lot.id, status: "BURNED", burnedAt: { gt: lastAttestation.consensusTs } },
        _sum: { litresMl: true },
      })
    : { _sum: { litresMl: 0 } };
  const evaluation = await evaluateLotFromRecords({
    genesisText: genesis.payload,
    attestations,
    auditorPublicKeyHex: lot.auditorPublicKey,
    series: lot.series,
    supplyCt,
    attestedAdjustmentLitres: (burned._sum.litresMl ?? 0) / 1_000,
    staleMs: await staleMsForLot(),
    lowStockBps: config.policy.lowStockBps,
  });
  return { lot, token, genesis, supplyCt, evaluation };
}

export function nftLetter(status) {
  if (status === "DEPLETED") return "D";
  if (status === "LOW_STOCK") return "L";
  return "A";
}

export function nftMetadata(lot, letter = nftLetter(lot.status)) {
  return `zc1|${lot.code}|${lot.topicId ?? "-"}|${letter}`;
}

export async function updateNftStatus(lot, status) {
  if (!lot.nftTokenId || !lot.nftSerial) return;
  const metadata = nftMetadata(lot, nftLetter(status));
  try {
    await ledger().updateNftMetadata(lot.nftTokenId, lot.nftSerial, metadata);
  } catch {
    // NFT metadata is a convenience pointer; never block the money flow.
  }
}

export function serializeLot(bundle) {
  const { lot, token, supplyCt, evaluation } = bundle;
  const cfg = seriesConfig(lot.series);
  const circulationTokens = supplyCt / 100;
  const latestVerdict = lot.verdicts?.[0] ?? null;
  const attestationList = lot.attestations.map((attestation) => ({
    seq: attestation.seq,
    text: attestation.recordText,
    signature: attestation.signature,
    consensusTs: attestation.consensusTs,
    chainHash: attestation.chainHash,
  }));

  return {
    id: lot.code,
    dbId: lot.id,
    series: lot.series,
    seriesName: cfg.name,
    grade: lot.grade,
    status: evaluation.verdict,
    lotStatus: lot.status,
    warehouse: lot.warehouse,
    harvestYear: lot.harvestYear,
    litres: {
      certified: lot.certifiedMl / 1_000,
      remaining: evaluation.attestedLitres,
      unit: "L",
      perToken: cfg.litresPerToken,
    },
    price: {
      value: lot.pricePerLitreCents / 100,
      cents: lot.pricePerLitreCents,
      token: "tUSDT",
      per: "L",
      perToken: pricePerTokenCents(lot.series, lot.pricePerLitreCents) / 100,
      tndPerLitre: tndCentsFromUsdCents(lot.pricePerLitreCents, lot.tndPerUsdCents) / 100,
      tndPerUsd: lot.tndPerUsdCents / 100,
    },
    supply: {
      tokenId: token.tokenId,
      circulating: circulationTokens,
      circulatingCt: supplyCt,
      max: (token.maxSupply ?? 0) / 100,
      unit: lot.series,
    },
    auditorPublicKey: lot.auditorPublicKey,
    tndPerUsd: lot.tndPerUsdCents / 100,
    topicId: lot.topicId,
    nft: {
      tokenId: lot.nftTokenId,
      serial: lot.nftSerial,
      status: nftLetter(lot.status),
    },
    producer: {
      label: lot.producer.label,
      accountId: lot.producer.hederaAccountId,
    },
    listing: lot.listing
      ? {
          active: lot.listing.active,
          litresOffered: lot.listing.litresOfferedMl / 1_000,
          pricePerLitreCents: lot.listing.pricePerLitreCents,
        }
      : null,
    attestations: attestationList,
    agent: latestVerdict
      ? {
          verdict: latestVerdict.verdict,
          reasons: latestVerdict.reasons,
          explanation: latestVerdict.explanation,
          ratioBps: latestVerdict.ratioBps,
          supplyCt: latestVerdict.supplyCt,
          attestedLitres: latestVerdict.attestedLitres,
          decisionSeq: latestVerdict.decisionSeq,
          createdAt: latestVerdict.createdAt,
        }
      : {
          verdict: evaluation.verdict,
          reasons: evaluation.reasons,
          explanation: null,
          ratioBps: evaluation.ratioBps,
          supplyCt,
          attestedLitres: evaluation.attestedLitres,
        },
    reserve: evaluation,
    hashscan: {
      topic: lot.topicId ? hashscanTopic(lot.topicId) : null,
      token: token.tokenId ? hashscanToken(token.tokenId) : null,
      nft: lot.nftTokenId ? hashscanToken(lot.nftTokenId) : null,
    },
    createdAt: lot.createdAt,
    certifiedAt: lot.certifiedAt,
  };
}

export async function createLot(input) {
  const cfg = seriesConfig(input.series);
  const certifiedLitres = Number(input.certifiedLitres ?? cfg.lotLitres);
  if (!Number.isInteger(certifiedLitres) || certifiedLitres <= 0) {
    throw badRequest("certifiedLitres must be a positive integer", "INVALID_LITRES");
  }
  const pricePerLitreCents = Number(input.pricePerLitreCents ?? 420);
  if (!Number.isInteger(pricePerLitreCents) || pricePerLitreCents <= 0) {
    throw badRequest("pricePerLitreCents must be a positive integer", "INVALID_PRICE");
  }
  const harvestYear = Number(input.harvestYear ?? new Date().getFullYear());
  const grade = String(input.grade ?? "extra_virgin");
  const warehouse = String(input.warehouse ?? "Sousse Central Warehouse");
  const producer =
    (input.producerId
      ? await prisma.account.findUnique({ where: { id: input.producerId } })
      : null) ?? (await prisma.account.findFirst({ where: { role: "PRODUCER" } }));
  if (!producer) throw badRequest("No producer account provisioned", "PRODUCER_MISSING");

  const auditor = await ensureAuditor();
  const lotNft = await prisma.token.findFirst({ where: { symbol: "ZLOT" } });
  if (!lotNft) throw badRequest("Lot NFT collection is not provisioned", "NFT_MISSING");

  const code = await nextCode("lot", "LOT");
  let lot = await prisma.lot.create({
    data: {
      code,
      series: input.series,
      grade,
      certifiedMl: certifiedLitres * 1_000,
      remainingMl: certifiedLitres * 1_000,
      pricePerLitreCents,
      tndPerUsdCents: config.policy.tndPerUsdCents,
      warehouse,
      harvestYear,
      auditorPublicKey: auditor.publicKeyHex,
      producerId: producer.id,
      status: "CERTIFIED",
    },
  });

  const topic = await ledger().createTopic(`ZitounaDeFi lot ${code} · ${cfg.name}`);
  lot = await prisma.lot.update({ where: { id: lot.id }, data: { topicId: topic.topicId } });

  const metadata = nftMetadata(lot, "A");
  const minted = await ledger().mintNft(lotNft.tokenId, metadata, producer.id);
  lot = await prisma.lot.update({
    where: { id: lot.id },
    data: { nftTokenId: lotNft.tokenId, nftSerial: minted.serial },
  });

  const genesisText = buildGenesis({
    lotId: lot.code,
    series: lot.series,
    grade: lot.grade,
    litres: certifiedLitres,
    warehouse: lot.warehouse,
    auditorPublicKeyHex: lot.auditorPublicKey,
    producerAccount: producer.hederaAccountId,
    harvestYear: lot.harvestYear,
  });
  const message = await ledger().submitMessage(lot.topicId, genesisText, "GENESIS", lot.id);
  emitLotEvent(lot.id, { type: "lot.created", seq: message.seq, txId: message.txId });
  return lot;
}

export async function publishListing(lotId, input) {
  const lot = await requireLot(lotId);
  const pricePerLitreCents = Number(input.pricePerLitreCents ?? lot.pricePerLitreCents);
  if (!Number.isInteger(pricePerLitreCents) || pricePerLitreCents <= 0) {
    throw badRequest("pricePerLitreCents must be a positive integer", "INVALID_PRICE");
  }
  const litresOffered = Number(input.litresOffered ?? lot.certifiedMl / 1_000);
  if (!Number.isInteger(litresOffered) || litresOffered <= 0 || litresOffered > lot.certifiedMl / 1_000) {
    throw badRequest("litresOffered must be between 1 and the certified litres", "INVALID_OFFER");
  }
  if (lot.status === "DEPLETED") throw badRequest("This lot is depleted", "LOT_DEPLETED");

  const listing = await prisma.listing.upsert({
    where: { lotId: lot.id },
    create: {
      lotId: lot.id,
      pricePerLitreCents,
      litresOfferedMl: litresOffered * 1_000,
      active: true,
    },
    update: {
      pricePerLitreCents,
      litresOfferedMl: litresOffered * 1_000,
      active: true,
    },
  });
  const updated = await prisma.lot.update({
    where: { id: lot.id },
    data: { pricePerLitreCents, status: lot.status === "CERTIFIED" ? "LISTED" : lot.status },
  });

  const text = buildListing({
    lotId: lot.code,
    seq: (await nextTopicSeq(lot.topicId)) ,
    ts: Date.now(),
    pricePerLitreCents,
    litresOffered,
    currency: "tUSDT",
  });
  const message = await ledger().submitMessage(lot.topicId, text, "LISTING", lot.id);
  emitLotEvent(lot.id, { type: "lot.listed", seq: message.seq, txId: message.txId });
  return { listing, lot: updated, message };
}

export async function nextTopicSeq(topicId) {
  if (!topicId) return 1;
  const max = await prisma.ledgerMessage.aggregate({
    where: { topicId },
    _max: { seq: true },
  });
  return (max._max.seq ?? 0) + 1;
}

export async function updateLotStatus(lotId, status) {
  const lot = await prisma.lot.update({ where: { id: lotId }, data: { status } });
  await updateNftStatus(lot, status);
  emitLotEvent(lot.id, { type: "lot.status", status });
  return lot;
}

export async function listLots() {
  const lots = await prisma.lot.findMany({
    include: {
      producer: true,
      listing: true,
      attestations: { orderBy: { seq: "asc" } },
      verdicts: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { code: "asc" },
  });
  const output = [];
  for (const lot of lots) {
    try {
      output.push(serializeLot(await evaluateLot(lot)));
    } catch (error) {
      output.push({
        id: lot.code,
        dbId: lot.id,
        series: lot.series,
        status: "INVALID",
        error: error.message,
        lotStatus: lot.status,
      });
    }
  }
  return output;
}

export async function lotDetail(idOrCode) {
  const bundle = await evaluateLot(idOrCode);
  const serialized = serializeLot(bundle);
  const [messages, trades, redemptions, transfers] = await Promise.all([
    prisma.ledgerMessage.findMany({
      where: { topicId: bundle.lot.topicId },
      orderBy: { seq: "asc" },
      select: { seq: true, type: true, consensusTs: true, payload: true, hash: true },
    }),
    prisma.trade.findMany({
      where: { lotId: bundle.lot.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { buyer: true },
    }),
    prisma.redemption.findMany({
      where: { lotId: bundle.lot.id },
      orderBy: { requestedAt: "desc" },
      take: 25,
      include: { holder: true },
    }),
    prisma.transfer.findMany({
      where: { lotId: bundle.lot.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { from: true, to: true },
    }),
  ]);
  return {
    ...serialized,
    messages,
    trades: trades.map((trade) => ({
      id: trade.id,
      buyer: trade.buyer.label,
      buyerAccountId: trade.buyer.hederaAccountId,
      litres: trade.litresMl / 1_000,
      tokens: trade.tokensCt / 100,
      amount: trade.amountCents / 100,
      status: trade.status,
      swapTxId: trade.swapTxId,
      createdAt: trade.createdAt,
    })),
    redemptions: redemptions.map((redemption) => ({
      id: redemption.id,
      code: redemption.code,
      holder: redemption.holder.label,
      tokens: redemption.tokensCt / 100,
      litres: redemption.litresMl / 1_000,
      status: redemption.status,
      deadline: redemption.deadline,
      requestedAt: redemption.requestedAt,
    })),
    transfers: transfers.map((transfer) => ({
      id: transfer.id,
      from: transfer.from.label,
      to: transfer.to.label,
      tokens: transfer.tokensCt / 100,
      txId: transfer.txId,
      createdAt: transfer.createdAt,
    })),
    mirrorUrl: `/api/v1/mirror/topics/${bundle.lot.topicId}/messages`,
  };
}
