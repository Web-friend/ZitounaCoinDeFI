import { Router } from "express";
import { asyncHandler } from "../lib/errors.js";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { ledger } from "../ledger/index.js";

const router = Router();

router.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const started = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    let operatorBalance = null;
    try {
      operatorBalance = await ledger().getHbarBalance();
    } catch {
      operatorBalance = null;
    }
    res.json({
      status: "ok",
      mode: config.ledgerMode,
      network: config.hedera.network,
      database: "up",
      operatorBalanceHbar: operatorBalance,
      latencyMs: Date.now() - started,
      time: new Date().toISOString(),
    });
  }),
);

export default router;
