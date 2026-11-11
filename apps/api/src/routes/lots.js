import { Router } from "express";
import { z } from "zod";
import { asyncHandler, badRequest, notFound, zodBody } from "../lib/errors.js";
import {
  createLot,
  listLots,
  lotDetail,
  publishListing,
  requireLot,
} from "../services/lots.js";
import { attestationContext, submitAttestation } from "../services/attestations.js";
import { buy, peerTransfer } from "../services/sales.js";
import { runAgent, latestVerdict } from "../services/agent.js";
import { onLotEvent } from "../services/events.js";

const router = Router();

const lotSchema = z.object({
  series: z.enum(["DGZ", "TZT"]),
  grade: z.string().min(1).max(64).optional(),
  certifiedLitres: z.number().int().positive().optional(),
  warehouse: z.string().min(1).max(120).optional(),
  harvestYear: z.number().int().min(2000).max(2100).optional(),
  pricePerLitreCents: z.number().int().positive().optional(),
  producerId: z.string().optional(),
});

const attestSchema = z.object({
  recordText: z.string().optional(),
  signature: z.string().optional(),
  seq: z.number().int().positive().optional(),
  ts: z.number().int().positive().optional(),
  litresRemaining: z.number().int().nonnegative().optional(),
  labHash: z.string().optional(),
  receiptHash: z.string().optional(),
});

const listSchema = z.object({
  pricePerLitreCents: z.number().int().positive().optional(),
  litresOffered: z.number().int().positive().optional(),
});

const buySchema = z
  .object({
    accountId: z.string().min(1),
    litresMl: z.number().int().positive().optional(),
    tokensCt: z.number().int().positive().optional(),
    idempotencyKey: z.string().min(8),
  })
  .refine((value) => value.litresMl != null || value.tokensCt != null, {
    message: "litresMl or tokensCt is required",
  });

const transferSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  tokensCt: z.number().int().positive(),
  memo: z.string().max(100).optional(),
  idempotencyKey: z.string().min(8),
});

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ lots: await listLots() });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = zodBody(lotSchema, req.body);
    const lot = await createLot(input);
    res.status(201).json({ lot: await lotDetail(lot.id) });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ lot: await lotDetail(req.params.id) });
  }),
);

router.post(
  "/:id/attest",
  asyncHandler(async (req, res) => {
    const input = zodBody(attestSchema, req.body);
    const lot = await requireLot(req.params.id);
    const { attestation, message } = await submitAttestation({ ...input, lotId: lot.id });
    const verdict = await runAgent(lot.id);
    res.status(201).json({ attestation, hcs: message, agent: verdict });
  }),
);

router.get(
  "/:id/next-attestation",
  asyncHandler(async (req, res) => {
    res.json(await attestationContext(req.params.id));
  }),
);

router.post(
  "/:id/list",
  asyncHandler(async (req, res) => {
    const input = zodBody(listSchema, req.body);
    const { listing, message } = await publishListing(req.params.id, input);
    res.json({ listing, hcs: message, lot: await lotDetail(req.params.id) });
  }),
);

router.post(
  "/:id/buy",
  asyncHandler(async (req, res) => {
    const input = zodBody(buySchema, req.body);
    const result = await buy({ lotId: req.params.id, ...input });
    res.status(201).json(result);
  }),
);

router.post(
  "/:id/transfer",
  asyncHandler(async (req, res) => {
    const input = zodBody(transferSchema, req.body);
    const result = await peerTransfer({ lotId: req.params.id, ...input });
    res.status(201).json(result);
  }),
);

router.post(
  "/:id/agent-check",
  asyncHandler(async (req, res) => {
    const lot = await requireLot(req.params.id);
    res.json(await runAgent(lot.id));
  }),
);

router.get(
  "/:id/agent",
  asyncHandler(async (req, res) => {
    const lot = await requireLot(req.params.id);
    const verdict = await latestVerdict(lot.id);
    if (!verdict) throw notFound("No agent verdict yet", "NO_VERDICT");
    res.json({ agent: verdict });
  }),
);

router.get(
  "/:id/stream",
  asyncHandler(async (req, res) => {
    const lot = await requireLot(req.params.id);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`event: hello\ndata: ${JSON.stringify({ lotId: lot.code, at: new Date().toISOString() })}\n\n`);
    const unsubscribe = onLotEvent(lot.id, (event) => {
      res.write(`event: update\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 15_000);
    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }),
);

export default router;
