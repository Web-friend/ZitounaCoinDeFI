import { Router } from "express";
import { z } from "zod";
import { asyncHandler, zodBody } from "../lib/errors.js";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { seedDemo, resetDemo, demoUnderbacked } from "../services/seed.js";
import { runAgent } from "../services/agent.js";
import { listAccounts } from "../services/wallet.js";

const router = Router();

router.get(
  "/state",
  asyncHandler(async (_req, res) => {
    const [accounts, tokens, lots, settings] = await Promise.all([
      listAccounts(),
      prisma.token.findMany({ orderBy: { symbol: "asc" } }),
      prisma.lot.findMany({ orderBy: { code: "asc" } }),
      prisma.systemSetting.findMany(),
    ]);
    res.json({
      mode: config.ledgerMode,
      network: config.hedera.network,
      accounts,
      tokens: tokens.map((token) => ({
        symbol: token.symbol,
        tokenId: token.tokenId,
        kind: token.kind,
        series: token.series,
        treasury: token.treasuryAccountId,
      })),
      lots: lots.map((lot) => ({
        id: lot.code,
        dbId: lot.id,
        series: lot.series,
        status: lot.status,
        topicId: lot.topicId,
        nftSerial: lot.nftSerial,
      })),
      settings: Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
      policy: config.policy,
      hashscanBase: config.hashscanBase,
      appBaseUrl: config.appBaseUrl,
      serverTime: new Date().toISOString(),
    });
  }),
);

router.post(
  "/seed",
  asyncHandler(async (_req, res) => {
    res.json(await seedDemo());
  }),
);

router.post(
  "/reset",
  asyncHandler(async (_req, res) => {
    res.json(await resetDemo({ freshBuyers: true }));
  }),
);

const underbackedSchema = z.object({ lotId: z.string().optional() });
router.post(
  "/underbacked",
  asyncHandler(async (req, res) => {
    const input = zodBody(underbackedSchema, req.body ?? {});
    res.json(await demoUnderbacked(input.lotId));
  }),
);

const staleSchema = z.object({ seconds: z.number().int().positive().max(31_536_000) });
router.post(
  "/stale",
  asyncHandler(async (req, res) => {
    const { seconds } = zodBody(staleSchema, req.body);
    await prisma.systemSetting.upsert({
      where: { key: "demo:staleSeconds" },
      create: { key: "demo:staleSeconds", value: String(seconds) },
      update: { value: String(seconds) },
    });
    const lots = await prisma.lot.findMany();
    const verdicts = [];
    for (const lot of lots) verdicts.push(await runAgent(lot.id));
    res.json({ seconds, verdicts });
  }),
);

router.delete(
  "/stale",
  asyncHandler(async (_req, res) => {
    await prisma.systemSetting.deleteMany({ where: { key: "demo:staleSeconds" } });
    const lots = await prisma.lot.findMany();
    const verdicts = [];
    for (const lot of lots) verdicts.push(await runAgent(lot.id));
    res.json({ verdicts });
  }),
);

const pauseSchema = z.object({ paused: z.boolean() });
router.post(
  "/pause",
  asyncHandler(async (req, res) => {
    const { paused } = zodBody(pauseSchema, req.body);
    await prisma.systemSetting.upsert({
      where: { key: "agent:paused" },
      create: { key: "agent:paused", value: String(paused) },
      update: { value: String(paused) },
    });
    res.json({ paused });
  }),
);

export default router;
