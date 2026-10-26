import { prisma } from "../lib/prisma.js";
import { seedDemo } from "../services/seed.js";
import { buy, peerTransfer } from "../services/sales.js";
import { handover, requestRedemption } from "../services/redemptions.js";
import { lotDetail } from "../services/lots.js";

const key = (name) => `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

try {
  console.log("1. Seeding demo data...");
  const summary = await seedDemo();
  const buyer = await prisma.account.findFirst({ where: { label: "Buyer A" } });
  const buyerB = await prisma.account.findFirst({ where: { label: "Buyer B" } });
  const lot = await prisma.lot.findFirst({ where: { series: "DGZ" } });
  if (!buyer || !buyerB || !lot) throw new Error("Seed did not create accounts or a DGZ lot");

  console.log("2. Buying 12.5 L for Buyer A...");
  const sale = await buy({
    lotId: lot.id,
    buyerId: buyer.id,
    litresMl: 12_500,
    idempotencyKey: key("smoke-buy"),
  });
  console.log("   ", sale.amount, "tUSDT ·", sale.tokens, "DGZ ·", sale.swapTxId);

  console.log("3. Transferring 2 L (0.2 DGZ) to Buyer B...");
  const transfer = await peerTransfer({
    lotId: lot.id,
    fromId: buyer.id,
    toId: buyerB.id,
    tokensCt: 20,
    memo: "smoke peer transfer",
    idempotencyKey: key("smoke-transfer"),
  });
  console.log("   ", transfer.tokens, "DGZ ·", transfer.txId);

  console.log("4. Redeeming 5 L (0.5 DGZ)...");
  const redemption = await requestRedemption({
    lotId: lot.id,
    holderId: buyer.id,
    tokensCt: 50,
    idempotencyKey: key("smoke-redeem"),
  });
  console.log("   ", redemption.code, "pickup", redemption.pickupCode);

  console.log("5. Handing over and burning...");
  const closed = await handover({
    redemptionId: redemption.id,
    source: "OPERATOR",
    pickupCode: redemption.pickupCode,
  });
  console.log("   status", closed.status, "· burn", closed.burnTxId);

  const detail = await lotDetail(lot.id);
  console.log("\nSmoke passed");
  console.log({
    mode: summary.mode,
    lot: detail.id,
    supply: detail.supply.circulating,
    certifiedLitres: detail.litres.certified,
    remainingLitres: detail.litres.remaining,
    verdict: detail.status,
    attestations: detail.attestations.length,
  });
  if (summary.mode === "hedera") {
    console.log("\nHashScan topic:", detail.hashscan.topic);
  }
} catch (error) {
  console.error("\nSmoke failed:", error.message);
  if (error.details) console.error(error.details);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
