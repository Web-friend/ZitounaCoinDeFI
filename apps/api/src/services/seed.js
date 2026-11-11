import { prisma } from "../lib/prisma.js";
import { ledger } from "../ledger/index.js";
import { provision, createFreshBuyer, fundWithTusdt } from "./provision.js";
import { attestWithAuditor } from "./attestations.js";
import { createLot, publishListing, requireLot } from "./lots.js";
import { runAgent } from "./agent.js";

const BUYER_FUNDS_CENTS = 2_500_000; // 25,000 tUSDT

async function ensureBuyerFunds(buyer, amountCents = BUYER_FUNDS_CENTS) {
  const token = await prisma.token.findFirst({ where: { symbol: "tUSDT" } });
  const balance = await ledger().getTokenBalance(buyer.id, token.tokenId);
  if (balance < amountCents) {
    await fundWithTusdt(buyer, amountCents - balance);
  }
}

export async function seedDemo({ res = null } = {}) {
  const ctx = await provision();
  const existing = await prisma.lot.count();
  const created = [];

  if (existing === 0) {
    const dgz = await createLot({
      series: "DGZ",
      grade: "extra_virgin",
      certifiedLitres: 10_000,
      warehouse: "Sousse Central Warehouse · Bay 3",
      harvestYear: 2026,
      pricePerLitreCents: 420,
    });
    await attestWithAuditor({
      lotId: dgz.id,
      litresRemaining: 10_000,
      labHash: "sha256:demo-lab-dgz-2026",
      receiptHash: "sha256:demo-receipt-dgz-2026",
    });
    await publishListing(dgz.id, { pricePerLitreCents: 420, litresOffered: 10_000 });
    await runAgent(dgz.id);
    created.push(dgz);

    const tzt = await createLot({
      series: "TZT",
      grade: "extra_virgin",
      certifiedLitres: 1_000_000,
      warehouse: "Sfax Bulk Terminal · Tank 12",
      harvestYear: 2026,
      pricePerLitreCents: 380,
    });
    await attestWithAuditor({
      lotId: tzt.id,
      litresRemaining: 1_000_000,
      labHash: "sha256:demo-lab-tzt-2026",
      receiptHash: "sha256:demo-receipt-tzt-2026",
    });
    await publishListing(tzt.id, { pricePerLitreCents: 380, litresOffered: 1_000_000 });
    await runAgent(tzt.id);
    created.push(tzt);
  }

  await ensureBuyerFunds(ctx.buyerA);
  await ensureBuyerFunds(ctx.buyerB);

  const lots = await prisma.lot.findMany({ orderBy: { code: "asc" } });
  const summary = {
    mode: ctx.mode,
    operator: ctx.operator.hederaAccountId,
    accounts: {
      producer: ctx.producer.hederaAccountId,
      treasury: ctx.treasury.hederaAccountId,
      buyerA: ctx.buyerA.hederaAccountId,
      buyerB: ctx.buyerB.hederaAccountId,
    },
    tokens: {
      tUSDT: ctx.tokens.tUSDT.tokenId,
      DGZ: ctx.tokens.dgz.tokenId,
      TZT: ctx.tokens.tzt.tokenId,
      LOT_NFT: ctx.tokens.lotNft.tokenId,
    },
    agentTopicId: ctx.agentTopicId,
    lots: lots.map((lot) => ({
      id: lot.code,
      series: lot.series,
      topicId: lot.topicId,
      nftSerial: lot.nftSerial,
      status: lot.status,
    })),
    created: created.map((lot) => lot.code),
  };
  if (res) res.json(summary);
  return summary;
}

async function drainSeriesTokens() {
  const treasury = await prisma.account.findFirst({ where: { role: "TREASURY" } });
  if (!treasury) return;
  const holders = await prisma.account.findMany({ where: { id: { not: treasury.id } } });
  const tokens = await prisma.token.findMany({ where: { kind: "FUNGIBLE" } });

  // Sweep every holder, not just buyers: stale balances can otherwise survive a
  // reset (e.g. tokens transferred to the producer or left by an old run) and
  // keep inflating the series supply that the reserve engine reads.
  for (const token of tokens) {
    for (const holder of holders) {
      const balance = await ledger().getTokenBalance(holder.id, token.tokenId);
      if (balance > 0) {
        await ledger().transferTokens(
          [{ tokenId: token.tokenId, fromAccountId: holder.id, toAccountId: treasury.id, amountCt: balance }],
          `ZitounaDeFi demo reset ${token.symbol}`,
        );
      }
    }
  }

  for (const token of tokens) {
    if (!["DGZ", "TZT"].includes(token.symbol)) continue;
    const balance = await ledger().getTokenBalance(treasury.id, token.tokenId);
    if (balance > 0) await ledger().burnFungible(token.tokenId, balance);
  }
}

export async function resetDemo({ freshBuyers = true } = {}) {
  await drainSeriesTokens();

  await prisma.idempotencyKey.deleteMany();
  await prisma.ledgerMessage.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.redemption.deleteMany();
  await prisma.agentVerdict.deleteMany();
  await prisma.attestation.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.lot.deleteMany();

  let buyerA = null;
  let buyerB = null;
  if (freshBuyers) {
    // Keep the account switcher clean: retire buyers from the previous run.
    await prisma.account.deleteMany({ where: { role: "BUYER" } });
    const current = await prisma.systemSetting.findUnique({ where: { key: "demo:buyerGeneration" } });
    const generation = Number(current?.value ?? 1) + 1;
    await prisma.systemSetting.upsert({
      where: { key: "demo:buyerGeneration" },
      create: { key: "demo:buyerGeneration", value: String(generation) },
      update: { value: String(generation) },
    });
    buyerA = await createFreshBuyer({ label: "Buyer A", keyEnvVar: `BUYER_G${generation}_A_KEY` });
    buyerB = await createFreshBuyer({ label: "Buyer B", keyEnvVar: `BUYER_G${generation}_B_KEY` });
    await ensureBuyerFunds(buyerA);
    await ensureBuyerFunds(buyerB);
  }

  const summary = await seedDemo();
  return {
    ...summary,
    reset: true,
    freshBuyers: buyerA && buyerB ? [buyerA.hederaAccountId, buyerB.hederaAccountId] : [],
  };
}

export async function lotForSeries(series) {
  return prisma.lot.findFirst({ where: { series }, orderBy: { createdAt: "desc" } });
}

export async function demoUnderbacked(lotId = "LOT-0001") {
  const lot = await requireLot(lotId);
  const supply = await prisma.token.findFirst({ where: { kind: "FUNGIBLE", series: lot.series } });
  const supplyCt = await ledger().getTotalSupply(supply.tokenId);
  const supplyLitres = (supplyCt / 100) * (lot.series === "DGZ" ? 10 : 1_000);
  const low = Math.max(1, Math.floor(supplyLitres * 0.5));
  const attestation = await attestWithAuditor({
    lotId: lot.id,
    litresRemaining: Math.min(low, lot.certifiedMl / 1_000),
    labHash: "sha256:demo-lab-underbacked",
    receiptHash: "sha256:demo-receipt-underbacked",
  });
  const verdict = await runAgent(lot.id);
  return { attestation, verdict };
}
