import { Router } from "express";
import { asyncHandler } from "../lib/errors.js";
import { ledger } from "../ledger/index.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get(
  "/topics/:topicId/messages",
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 100) || 100, 100);
    const order = req.query.order === "desc" ? "desc" : "asc";
    res.json(await ledger().getTopicMessagesRaw(req.params.topicId, { limit, order }));
  }),
);

router.get(
  "/tokens/:tokenId",
  asyncHandler(async (req, res) => {
    res.json(await ledger().getTokenInfoRaw(req.params.tokenId));
  }),
);

router.get(
  "/tokens/:tokenId/balances",
  asyncHandler(async (req, res) => {
    if (ledger().mode === "hedera") {
      return res.json(await ledger().mirrorGet(`/tokens/${req.params.tokenId}/balances?limit=100`));
    }
    const token = await prisma.token.findUnique({ where: { tokenId: req.params.tokenId } });
    if (!token) return res.json({ balances: [] });
    const rows = await prisma.tokenBalance.findMany({
      where: { tokenDbId: token.id, amount: { gt: 0 } },
      include: { account: true },
    });
    res.json({
      balances: rows.map((row) => ({
        account: row.account.hederaAccountId,
        balance: row.amount,
        label: row.account.label,
      })),
      timestamp: new Date().toISOString(),
    });
  }),
);

router.get(
  "/accounts/:accountId/tokens",
  asyncHandler(async (req, res) => {
    if (ledger().mode === "hedera") {
      return res.json(await ledger().mirrorGet(`/accounts/${req.params.accountId}/tokens?limit=100`));
    }
    const account = await prisma.account.findUnique({
      where: { hederaAccountId: req.params.accountId },
      include: { balances: { include: { token: true } } },
    });
    if (!account) return res.json({ tokens: [] });
    res.json({
      tokens: account.balances
        .filter((balance) => balance.amount > 0)
        .map((balance) => ({
          token_id: balance.token.tokenId,
          balance: balance.amount,
          symbol: balance.token.symbol,
          decimals: balance.token.decimals,
        })),
    });
  }),
);

export default router;
