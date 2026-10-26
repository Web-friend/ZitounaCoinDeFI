import { config, isHedera } from "../config.js";
import { provision } from "../services/provision.js";
import { prisma } from "../lib/prisma.js";
import { hashscanToken, hashscanTopic } from "../config.js";

try {
  if (!isHedera()) {
    console.log(
      "LEDGER_MODE is currently stub. Set LEDGER_MODE=hedera in .env, add HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY, then re-run.",
    );
    process.exitCode = 1;
  } else if (!config.hedera.operatorId || !config.hedera.operatorKey) {
    console.error(
      [
        "Missing Hedera operator credentials.",
        "",
        "1. Create a testnet account at https://portal.hedera.com/",
        "2. Fund it from https://portal.hedera.com/faucet",
        "3. Put these in .env (never commit them):",
        "   HEDERA_OPERATOR_ID=0.0.xxxxx",
        "   HEDERA_OPERATOR_KEY=<DER-encoded private key>",
        "   LEDGER_MODE=hedera",
        "",
        "Then run: bun run setup:hedera",
      ].join("\n"),
    );
    process.exitCode = 1;
  } else {
    const ctx = await provision();
    console.log("\nHedera testnet provisioning complete\n");
    console.table({
      Operator: ctx.operator.hederaAccountId,
      Treasury: ctx.treasury.hederaAccountId,
      Producer: ctx.producer.hederaAccountId,
      "Buyer A": ctx.buyerA.hederaAccountId,
      "Buyer B": ctx.buyerB.hederaAccountId,
      tUSDT: ctx.tokens.tUSDT.tokenId,
      DGZ: ctx.tokens.dgz.tokenId,
      TZT: ctx.tokens.tzt.tokenId,
      "Lot NFT": ctx.tokens.lotNft.tokenId,
      "Agent topic": ctx.agentTopicId,
    });
    console.log("\nHashScan");
    console.log("DGZ:      ", hashscanToken(ctx.tokens.dgz.tokenId));
    console.log("TZT:      ", hashscanToken(ctx.tokens.tzt.tokenId));
    console.log("tUSDT:    ", hashscanToken(ctx.tokens.tUSDT.tokenId));
    console.log("Lot NFT:  ", hashscanToken(ctx.tokens.lotNft.tokenId));
    console.log("Agent HCS:", hashscanTopic(ctx.agentTopicId));
    console.log("\nGenerated credentials were written to .env.local and keys/hedera-accounts.json (both gitignored).");
    console.log("Next: bun run seed");
  }
} catch (error) {
  console.error("\nHedera setup failed:", error.message);
  if (error.details) console.error(error.details);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
