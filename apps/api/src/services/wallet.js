import { seriesConfig, tokensCtToMl } from "@zitouna/rules";
import { prisma } from "../lib/prisma.js";
import { ledger } from "../ledger/index.js";
import { resolveAccount } from "./sales.js";

export async function listAccounts() {
  const accounts = await prisma.account.findMany({
    orderBy: [{ role: "asc" }, { label: "asc" }],
  });
  return accounts.map((account) => ({
    id: account.id,
    role: account.role,
    label: account.label,
    accountId: account.hederaAccountId,
    isDemo: account.isDemo,
  }));
}

export async function accountBalances(account) {
  const tokens = await prisma.token.findMany({ where: { kind: "FUNGIBLE" } });
  const balances = {};
  for (const token of tokens) {
    balances[token.symbol] = await ledger().getTokenBalance(account.id, token.tokenId);
  }
  return {
    tUSDT: (balances.tUSDT ?? 0) / 100,
    DGZ: (balances.DGZ ?? 0) / 100,
    TZT: (balances.TZT ?? 0) / 100,
    minor: balances,
  };
}

export async function getWallet(accountRef) {
  const account = await resolveAccount(accountRef);
  const balances = await accountBalances(account);
  const tokens = await prisma.token.findMany({ where: { kind: "FUNGIBLE" } });
  const holdings = [];
  for (const token of tokens) {
    if (!token.series) continue;
    const cfg = seriesConfig(token.series);
    const ct = balances.minor[token.symbol] ?? 0;
    const lot = await prisma.lot.findFirst({
      where: { series: token.series },
      orderBy: { createdAt: "desc" },
      include: { listing: true },
    });
    holdings.push({
      series: token.series,
      name: cfg.name,
      tokenId: token.tokenId,
      tokens: ct / 100,
      litres: tokensCtToMl(token.series, ct) / 1_000,
      litresPerToken: cfg.litresPerToken,
      minRedemptionTokens: cfg.minRedemptionTokens,
      lotId: lot?.code ?? null,
      lotDbId: lot?.id ?? null,
      lotStatus: lot?.status ?? null,
    });
  }

  const [trades, transfers, redemptions] = await Promise.all([
    prisma.trade.findMany({
      where: { buyerId: account.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { lot: true },
    }),
    prisma.transfer.findMany({
      where: { OR: [{ fromId: account.id }, { toId: account.id }] },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { lot: true, from: true, to: true },
    }),
    prisma.redemption.findMany({
      where: { holderId: account.id },
      orderBy: { requestedAt: "desc" },
      take: 20,
      include: { lot: true },
    }),
  ]);

  return {
    account: {
      id: account.id,
      role: account.role,
      label: account.label,
      accountId: account.hederaAccountId,
    },
    balances: { tUSDT: balances.tUSDT, DGZ: balances.DGZ, TZT: balances.TZT },
    holdings,
    activity: {
      trades: trades.map((trade) => ({
        id: trade.id,
        lotId: trade.lot.code,
        litres: trade.litresMl / 1_000,
        tokens: trade.tokensCt / 100,
        amount: trade.amountCents / 100,
        status: trade.status,
        createdAt: trade.createdAt,
      })),
      transfers: transfers.map((transfer) => ({
        id: transfer.id,
        lotId: transfer.lot.code,
        from: transfer.from.label,
        to: transfer.to.label,
        tokens: transfer.tokensCt / 100,
        direction: transfer.fromId === account.id ? "out" : "in",
        createdAt: transfer.createdAt,
      })),
      redemptions: redemptions.map((redemption) => ({
        id: redemption.id,
        code: redemption.code,
        lotId: redemption.lot.code,
        tokens: redemption.tokensCt / 100,
        litres: redemption.litresMl / 1_000,
        status: redemption.status,
        deadline: redemption.deadline,
      })),
    },
  };
}
