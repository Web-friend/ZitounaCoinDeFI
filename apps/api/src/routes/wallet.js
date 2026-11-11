import { Router } from "express";
import { asyncHandler } from "../lib/errors.js";
import { accountBalances, getWallet, listAccounts } from "../services/wallet.js";
import { resolveAccount } from "../services/sales.js";

const router = Router();

router.get(
  "/accounts",
  asyncHandler(async (_req, res) => {
    res.json({ accounts: await listAccounts() });
  }),
);

router.get(
  "/accounts/:ref/balances",
  asyncHandler(async (req, res) => {
    const account = await resolveAccount(req.params.ref);
    res.json({
      account: { id: account.id, label: account.label, accountId: account.hederaAccountId, role: account.role },
      balances: await accountBalances(account),
    });
  }),
);

router.get(
  "/wallets/:ref",
  asyncHandler(async (req, res) => {
    res.json(await getWallet(req.params.ref));
  }),
);

export default router;
