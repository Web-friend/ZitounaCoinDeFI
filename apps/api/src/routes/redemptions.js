import { Router } from "express";
import { z } from "zod";
import { asyncHandler, zodBody } from "../lib/errors.js";
import {
  getRedemption,
  handover,
  listRedemptions,
  requestRedemption,
  returnRedemption,
  serializeRedemption,
} from "../services/redemptions.js";
import { listAccounts } from "../services/wallet.js";

const router = Router();

const requestSchema = z.object({
  lotId: z.string().min(1),
  holderId: z.string().min(1),
  tokensCt: z.number().int().positive(),
  idempotencyKey: z.string().min(8),
});

const handoverSchema = z.object({
  source: z.string().max(32).optional(),
  pickupCode: z.string().max(12).optional(),
  operatorOverride: z.boolean().optional(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ redemptions: await listRedemptions(req.query.accountId) });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = zodBody(requestSchema, req.body);
    const redemption = await requestRedemption(input);
    res.status(201).json({ redemption });
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ redemption: serializeRedemption(await getRedemption(req.params.id)) });
  }),
);

router.post(
  "/:id/handover",
  asyncHandler(async (req, res) => {
    const input = zodBody(handoverSchema, req.body);
    const redemption = await handover({ redemptionId: req.params.id, ...input });
    res.json({ redemption });
  }),
);

router.post(
  "/:id/return",
  asyncHandler(async (req, res) => {
    const force = Boolean(req.body?.force);
    res.json({ redemption: await returnRedemption({ redemptionId: req.params.id, force }) });
  }),
);

router.get(
  "/meta/accounts",
  asyncHandler(async (_req, res) => {
    res.json({ accounts: await listAccounts() });
  }),
);

export default router;
