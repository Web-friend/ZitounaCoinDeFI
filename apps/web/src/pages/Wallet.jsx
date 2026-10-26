import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  Droplets,
  Leaf,
  Package,
  Send,
  ShoppingBasket,
  Wallet as WalletIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, idempotencyKey } from "../lib/api.js";
import { useAccount } from "../lib/account.jsx";
import { dateTime, litres, money, tokens } from "../lib/format.js";
import { useToast } from "../lib/toast.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import TxLink from "../components/TxLink.jsx";
import { Callout, EmptyState, ErrorState, Spinner, Stat } from "../components/ui.jsx";

export default function Wallet() {
  const { account, accounts, selectAccount } = useAccount();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [series, setSeries] = useState("DGZ");
  const [recipientId, setRecipientId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const walletQuery = useQuery({
    queryKey: ["wallet", account?.id],
    queryFn: () => api.wallet(account.id),
    enabled: Boolean(account?.id),
    refetchInterval: 15_000,
  });
  const lotsQuery = useQuery({ queryKey: ["lots"], queryFn: api.lots });

  const wallet = walletQuery.data;
  const holding = wallet?.holdings?.find((item) => item.series === series);
  const lot = useMemo(() => {
    const lots = lotsQuery.data?.lots ?? [];
    return lots.find((candidate) => candidate.series === series);
  }, [lotsQuery.data, series]);

  const others = accounts.filter(
    (candidate) => candidate.id !== account?.id && ["BUYER", "PRODUCER", "TREASURY"].includes(candidate.role),
  );
  const currentRecipient =
    others.find((candidate) => candidate.id === recipientId) ??
    others.find((candidate) => candidate.role === "BUYER") ??
    others[0];

  const transferMutation = useMutation({
    mutationFn: () =>
      api.transfer(lot.id, {
        fromId: account.id,
        toId: currentRecipient.id,
        tokensCt: Math.round(Number(amount) * 100),
        memo: memo || undefined,
        idempotencyKey: idempotencyKey("transfer"),
      }),
    onSuccess: (result) => {
      toast.success(`Sent ${result.tokens} ${series}`, {
        description: `${result.from.label} → ${result.to.label} · HCS seq #${result.hcsSeq}`,
      });
      setAmount("");
      setMemo("");
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["lots"] });
      queryClient.invalidateQueries({ queryKey: ["lot"] });
    },
    onError: (error) => toast.error("Transfer failed", { description: error.message }),
  });

  if (!account) return <Spinner label="Loading demo account…" className="py-24" />;
  if (walletQuery.isLoading) return <Spinner label="Loading wallet…" className="py-24" />;
  if (walletQuery.error)
    return <div className="shell py-16"><ErrorState error={walletQuery.error} onRetry={walletQuery.refetch} /></div>;
  if (!wallet) return null;

  const balances = wallet.balances;
  const activity = wallet.activity;
  const activityCount = activity.trades.length + activity.transfers.length + activity.redemptions.length;
  const transferAmount = Number(amount);
  const transferValid =
    currentRecipient &&
    lot &&
    Number.isFinite(transferAmount) &&
    transferAmount >= 0.01 &&
    transferAmount <= (holding?.tokens ?? 0);

  return (
    <div className="shell py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Demo wallet</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {account.label}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {account.role.toLowerCase()} · <span className="font-mono text-xs">{account.accountId}</span>{" "}
            · custodial testnet account
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-soft">
          Switch wallet
          <select
            className="input !w-auto !py-2 text-sm"
            value={account.id}
            onChange={(event) => selectAccount(event.target.value)}
          >
            {accounts
              .filter((candidate) => candidate.role !== "OPERATOR")
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </option>
              ))}
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-olive-light text-olive-deep">
            <CircleDollarSign className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">tUSDT</p>
            <p className="font-display text-2xl font-bold">{money(balances.tUSDT)}</p>
            <p className="text-[11px] text-ink-soft">Demo stablecoin</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-soft text-amber">
            <Leaf className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">DigaZitoun</p>
            <p className="font-display text-2xl font-bold">{tokens(balances.DGZ, "DGZ")}</p>
            <p className="text-[11px] text-ink-soft">{litres(balances.DGZ * 10, 2)} of oil</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-deep text-olive-deep">
            <Droplets className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">TornataZite</p>
            <p className="font-display text-2xl font-bold">{tokens(balances.TZT, "TZT")}</p>
            <p className="text-[11px] text-ink-soft">{litres(balances.TZT * 1_000, 0)} of oil</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-bold">Holdings</h2>
                <p className="text-xs text-ink-soft">Redeemable against the latest lot in each series.</p>
              </div>
              <WalletIcon className="h-4 w-4 text-olive" />
            </div>
            <div className="divide-y divide-ink/5">
              {wallet.holdings.map((item) => (
                <div key={item.series} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream-deep text-olive">
                    {item.series === "DGZ" ? <Leaf className="h-4 w-4" /> : <Droplets className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                      {item.name}{" "}
                      <span className="ml-1 rounded bg-cream-deep px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                        {item.series}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {item.tokens.toFixed(2)} tokens · {litres(item.litres, 2)} · {item.litresPerToken} L each
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-bold">{litres(item.litres, 2)}</p>
                    <p className="text-[10px] text-ink/40">{item.lotId ?? "no lot"}</p>
                  </div>
                  <Link
                    to={`/redemptions?series=${item.series}`}
                    className="btn-secondary !px-3 !py-1.5 !text-xs"
                    aria-disabled={item.tokens < item.minRedemptionTokens}
                  >
                    <Package className="h-3.5 w-3.5" />
                    Redeem
                  </Link>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-bold">Activity</h2>
                <p className="text-xs text-ink-soft">{activityCount} recorded actions on this demo account.</p>
              </div>
            </div>
            {activityCount === 0 ? (
              <EmptyState
                title="Nothing here yet"
                description="Buy a little oil to see trades, transfers and redemptions appear here."
                action={
                  <Link to="/" className="btn-primary !py-2 !text-xs">
                    Browse the market
                  </Link>
                }
                icon={ShoppingBasket}
              />
            ) : (
              <div className="divide-y divide-ink/5">
                {activity.trades.map((trade) => (
                  <div key={trade.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-xs">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ok-soft text-ok">
                      <ShoppingBasket className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        Bought {litres(trade.litres, 2)} of {trade.lotId}
                      </p>
                      <p className="text-[11px] text-ink-soft">
                        {trade.tokens} tokens · {money(trade.amount)} · {dateTime(trade.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={trade.status} />
                  </div>
                ))}
                {activity.transfers.map((transfer) => (
                  <div key={transfer.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-xs">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full ${
                        transfer.direction === "out" ? "bg-amber-soft text-amber" : "bg-olive-light text-olive-deep"
                      }`}
                    >
                      {transfer.direction === "out" ? (
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {transfer.direction === "out"
                          ? `Sent ${transfer.tokens} tokens to ${transfer.to}`
                          : `Received ${transfer.tokens} tokens from ${transfer.from}`}
                      </p>
                      <p className="text-[11px] text-ink-soft">
                        {transfer.lotId} · {dateTime(transfer.createdAt)}
                      </p>
                    </div>
                    <span className="rounded bg-cream-deep px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">
                      {transfer.direction}
                    </span>
                  </div>
                ))}
                {activity.redemptions.map((redemption) => (
                  <Link
                    key={redemption.id}
                    to={`/redemptions/${redemption.id}`}
                    className="flex flex-wrap items-center gap-3 px-5 py-3 text-xs hover:bg-cream-deep/40"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-soft text-amber">
                      <Package className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        Redemption {redemption.code} · {litres(redemption.litres, 2)}
                      </p>
                      <p className="text-[11px] text-ink-soft">
                        {redemption.lotId} · deadline {dateTime(redemption.deadline)}
                      </p>
                    </div>
                    <StatusBadge status={redemption.status} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-olive" />
              <h2 className="font-display text-lg font-bold">Send tokens</h2>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              Peer transfer between demo accounts. This is the “split the tin with a friend” moment.
            </p>
            <form
              className="mt-4 space-y-3.5"
              onSubmit={(event) => {
                event.preventDefault();
                if (transferValid) transferMutation.mutate();
              }}
            >
              <div>
                <label className="label" htmlFor="series">
                  Series
                </label>
                <select id="series" className="input" value={series} onChange={(event) => setSeries(event.target.value)}>
                  {wallet.holdings.map((item) => (
                    <option key={item.series} value={item.series}>
                      {item.name} ({item.series}) — {item.tokens.toFixed(2)} available
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="recipient">
                  Recipient
                </label>
                <select
                  id="recipient"
                  className="input"
                  value={currentRecipient?.id ?? ""}
                  onChange={(event) => setRecipientId(event.target.value)}
                >
                  {others.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label} · {candidate.accountId}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="amount">
                  Amount ({series})
                </label>
                <input
                  id="amount"
                  className="input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.50"
                />
                <button
                  type="button"
                  className="mt-1 text-[11px] font-semibold text-olive hover:underline"
                  onClick={() => setAmount(String(holding?.tokens ?? 0))}
                >
                  Use max ({holding?.tokens.toFixed(2) ?? "0.00"} {series})
                </button>
              </div>
              <div>
                <label className="label" htmlFor="memo">
                  Memo <span className="normal-case tracking-normal text-ink/30">(optional)</span>
                </label>
                <input
                  id="memo"
                  className="input"
                  value={memo}
                  maxLength={100}
                  onChange={(event) => setMemo(event.target.value)}
                  placeholder="Gift for the restaurant"
                />
              </div>
              <button type="submit" className="btn-primary w-full !py-2.5 !text-xs" disabled={!transferValid || transferMutation.isPending}>
                <Send className="h-3.5 w-3.5" />
                {transferMutation.isPending ? "Sending…" : "Send tokens"}
              </button>
            </form>
            {!lot ? (
              <Callout tone="warn" className="mt-3">
                No {series} lot exists yet. Seed the demo first.
              </Callout>
            ) : null}
            {holding && holding.tokens < holding.minRedemptionTokens ? (
              <Callout tone="info" className="mt-3">
                Redemption opens at {holding.minRedemptionTokens} {series} ({litres(holding.minRedemptionTokens * holding.litresPerToken, 0)}).
              </Callout>
            ) : null}
          </section>

          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Wallet notes</h2>
            <ul className="mt-2 space-y-2 text-xs text-ink-soft">
              <li>Balances mirror the Hedera token ledger; the database keeps a local index for the UI.</li>
              <li>Redemptions move tokens to treasury custody, then burn them on handover.</li>
              <li>Demo accounts are custodial: the backend signs for them.</li>
            </ul>
            <Link to="/demo" className="btn-ghost mt-3 !px-0 !text-xs">
              Open demo controls
              <ArrowRight className="h-3 w-3" />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
