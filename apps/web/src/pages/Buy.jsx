import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleDollarSign,
  Info,
  Leaf,
  ReceiptText,
  Wallet as WalletIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { mlToTokensCt, priceCentsForMl } from "@zitouna/rules";
import { api, idempotencyKey } from "../lib/api.js";
import { useAccount } from "../lib/account.jsx";
import { litres, money, tnd } from "../lib/format.js";
import { useToast } from "../lib/toast.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import TxLink from "../components/TxLink.jsx";
import { Callout, ErrorState, Spinner } from "../components/ui.jsx";

function quickPicks(series) {
  return series === "TZT" ? [1_000, 2_500, 5_000, 10_000] : [5, 12.5, 25, 50];
}

export default function Buy() {
  const { id } = useParams();
  const { account } = useAccount();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState("");
  const [receipt, setReceipt] = useState(null);

  const lotQuery = useQuery({ queryKey: ["lot", id], queryFn: () => api.lot(id) });
  const walletQuery = useQuery({
    queryKey: ["wallet", account?.id],
    queryFn: () => api.wallet(account.id),
    enabled: Boolean(account?.id),
  });

  const lot = lotQuery.data?.lot;
  const wallet = walletQuery.data;
  const balance = wallet?.balances?.tUSDT ?? 0;

  const step = lot ? lot.litres.perToken / 100 : 0.1;
  const entered = Number(quantity);
  const ml = Number.isFinite(entered) ? Math.round(entered * 1_000) : 0;

  const available = useMemo(() => {
    if (!lot) return { litres: 0, reason: "" };
    const sold = lot.listing ? Math.max(0, lot.listing.litresOffered - lot.litres.remaining) : 0;
    const listingLeft = lot.listing ? Math.max(0, lot.listing.litresOffered - sold) : 0;
    const headroom = Math.max(0, lot.reserve.attestedLitres - lot.reserve.supplyLitres);
    const affordable = lot.price.value > 0 ? balance / lot.price.value : 0;
    const max = Math.min(listingLeft, headroom, affordable);
    const stepped = Math.floor((max + 1e-9) / step) * step;
    const normalised = Math.round(stepped * 100) / 100;
    const reason =
      max === affordable && affordable < Math.min(listingLeft, headroom)
        ? "limited by your tUSDT balance"
        : max === headroom
          ? "limited by attested reserve"
          : "limited by the listing";
    return { litres: Math.max(0, normalised), reason };
  }, [lot, balance, step]);

  let tokensCt = 0;
  let tokenError = null;
  if (lot && ml > 0) {
    try {
      tokensCt = mlToTokensCt(lot.series, ml);
    } catch (error) {
      tokenError = error.message;
    }
  }
  const amountCents = lot && ml > 0 ? priceCentsForMl(ml, lot.price.cents) : 0;
  const amount = amountCents / 100;

  const buyMutation = useMutation({
    mutationFn: () =>
      api.buy(lot.id, {
        accountId: account.id,
        litresMl: ml,
        idempotencyKey: idempotencyKey("buy"),
      }),
    onSuccess: (result) => {
      setReceipt(result);
      setQuantity("");
      queryClient.invalidateQueries({ queryKey: ["wallet", account.id] });
      queryClient.invalidateQueries({ queryKey: ["lot", id] });
      queryClient.invalidateQueries({ queryKey: ["lots"] });
      queryClient.invalidateQueries({ queryKey: ["redemptions"] });
      toast.success("Purchase settled", {
        description: `${result.tokens} ${lot.series} for ${money(result.amount)}.`,
      });
    },
    onError: (error) => {
      toast.error("Purchase rejected", {
        description: error.details?.reasons?.join(" · ") ?? error.message,
      });
    },
  });

  if (lotQuery.isLoading || walletQuery.isLoading) return <Spinner label="Preparing checkout…" className="py-24" />;
  if (lotQuery.error) return <div className="shell py-16"><ErrorState error={lotQuery.error} onRetry={lotQuery.refetch} /></div>;
  if (!lot) return null;

  const saleOpen = lot.listing?.active && ["BACKED", "LOW_STOCK"].includes(lot.status);
  const canBuy =
    saleOpen && ml > 0 && !tokenError && amount <= balance && ml / 1_000 <= available.litres + 1e-9;

  const disableReason = !saleOpen
    ? `Sales are paused by the ${lot.status.toLowerCase().replace("_", " ")} verdict.`
    : tokenError
      ? tokenError
      : ml > 0 && ml / 1_000 > available.litres + 1e-9
        ? `Only ${litres(available.litres, 1)} available (${available.reason}).`
        : amount > balance
          ? "Not enough tUSDT in this demo account."
          : null;

  return (
    <div className="shell max-w-5xl py-6 sm:py-8">
      <nav className="mb-4 flex items-center gap-2 text-xs text-ink-soft">
        <Link to={`/lots/${lot.id}`} className="inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          {lot.id}
        </Link>
        <span className="text-ink/25">/</span>
        <span className="font-semibold text-ink">Buy {lot.series}</span>
      </nav>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="card overflow-hidden">
          <div className="border-b border-ink/10 bg-white/40 px-5 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Primary sale · {lot.id}</p>
                <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
                  Buy {lot.seriesName}
                </h1>
                <p className="mt-1 text-sm text-ink-soft">
                  {money(lot.price.value)} per litre · {litres(lot.litres.perToken, 0)} per {lot.series} ·{" "}
                  {lot.producer.label}
                </p>
              </div>
              <StatusBadge status={lot.status} />
            </div>
          </div>

          {receipt ? (
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-3 rounded-xl border border-ok/25 bg-ok-soft/50 px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-ok" />
                <div>
                  <p className="text-sm font-bold text-ok">Settled on the ledger</p>
                  <p className="mt-0.5 text-xs text-ok/80">
                    {receipt.litres} L → {receipt.tokens} {receipt.lotId ? lot.series : ""} for{" "}
                    {money(receipt.amount)}. A sale record was appended to HCS seq #{receipt.hcsSeq}.
                  </p>
                </div>
              </div>

              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-cream-deep/50 px-3.5 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                    Tokens received
                  </dt>
                  <dd className="mt-0.5 font-display text-xl font-bold">
                    {receipt.tokens} {lot.series}
                  </dd>
                </div>
                <div className="rounded-xl bg-cream-deep/50 px-3.5 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                    Paid
                  </dt>
                  <dd className="mt-0.5 font-display text-xl font-bold">{money(receipt.amount)}</dd>
                </div>
                <div className="rounded-xl bg-cream-deep/50 px-3.5 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                    Swap transaction
                  </dt>
                  <dd className="mt-1">
                    <TxLink txId={receipt.swapTxId} />
                  </dd>
                </div>
                <div className="rounded-xl bg-cream-deep/50 px-3.5 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">
                    Mint transaction
                  </dt>
                  <dd className="mt-1">
                    <TxLink txId={receipt.mintTxId} />
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/wallet" className="btn-primary !py-2 !text-xs">
                  <WalletIcon className="h-3.5 w-3.5" />
                  Open wallet
                </Link>
                <Link to="/redemptions" className="btn-secondary !py-2 !text-xs">
                  <ReceiptText className="h-3.5 w-3.5" />
                  Redeem oil
                </Link>
                <button type="button" className="btn-ghost !py-2 !text-xs" onClick={() => setReceipt(null)}>
                  Buy more
                </button>
              </div>
            </div>
          ) : (
            <form
              className="space-y-5 p-5 sm:p-6"
              onSubmit={(event) => {
                event.preventDefault();
                if (canBuy) buyMutation.mutate();
              }}
            >
              <div>
                <label className="label" htmlFor="quantity">
                  How many litres?
                </label>
                <div className="flex items-end gap-2">
                  <input
                    id="quantity"
                    type="number"
                    inputMode="decimal"
                    min={step}
                    step={step}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder={lot.series === "TZT" ? "1000" : "12.5"}
                    className="input font-display !text-2xl !font-bold"
                  />
                  <span className="pb-3 text-sm font-semibold text-ink-soft">L</span>
                </div>
                <p className="mt-1.5 text-xs text-ink-soft">
                  Step {step} L · max {litres(available.litres, 1)} ({available.reason || "available"})
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {quickPicks(lot.series).map((pick) => (
                  <button
                    key={pick}
                    type="button"
                    onClick={() => setQuantity(String(pick))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      Number(quantity) === pick
                        ? "border-olive bg-olive text-cream"
                        : "border-ink/15 bg-white/60 text-ink-soft hover:border-olive/40"
                    }`}
                  >
                    {pick.toLocaleString("en-US")} L
                  </button>
                ))}
                {available.litres > 0 ? (
                  <button
                    type="button"
                    onClick={() => setQuantity(String(available.litres))}
                    className="rounded-full border border-ink/15 bg-white/60 px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-olive/40"
                  >
                    Max
                  </button>
                ) : null}
              </div>

              <div className="rounded-xl border border-ink/10 bg-cream-deep/40 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Tokens</span>
                  <span className="font-semibold">
                    {tokensCt > 0 ? `${(tokensCt / 100).toFixed(2)} ${lot.series}` : "—"}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-sm">
                  <span className="text-ink-soft">Total</span>
                  <span className="font-display text-xl font-bold">{amount > 0 ? money(amount) : "—"}</span>
                </div>
                {amount > 0 ? (
                  <p className="mt-1 text-right text-[11px] text-ink-soft">
                    ≈ {tnd(amount * lot.tndPerUsd)} at the fixed demo rate
                  </p>
                ) : null}
                <div className="mt-2 flex items-center justify-between border-t border-ink/10 pt-2 text-[11px] text-ink-soft">
                  <span>Balance</span>
                  <span>{money(balance)}</span>
                </div>
              </div>

              {disableReason ? (
                <Callout tone="warn" title="Cannot submit yet">
                  {disableReason}
                </Callout>
              ) : (
                <Callout tone="info">
                  The demo operator signs both sides of the swap: tUSDT leaves your account, freshly
                  minted {lot.series} arrives in the same transaction. The sale is recorded on HCS.
                </Callout>
              )}

              <button type="submit" className="btn-primary w-full !py-3" disabled={!canBuy || buyMutation.isPending}>
                <CircleDollarSign className="h-4 w-4" />
                {buyMutation.isPending ? "Settling…" : amount > 0 ? `Pay ${money(amount)}` : "Enter a quantity"}
                {!buyMutation.isPending ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
              <p className="text-center text-[11px] text-ink/40">
                Demo custody: the backend holds the testnet keys. No real money moves.
              </p>
            </form>
          )}
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">Lot snapshot</h2>
              <StatusBadge status={lot.status} />
            </div>
            <dl className="mt-3 space-y-2.5 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Attested stock</dt>
                <dd className="font-semibold">{litres(lot.litres.remaining, 0)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Tokenized</dt>
                <dd className="font-semibold">{litres(lot.reserve.supplyLitres, 2)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Reserve cover</dt>
                <dd className="font-semibold">{(lot.reserve.ratioBps / 100).toFixed(1)}%</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Auditor attestations</dt>
                <dd className="font-semibold">{lot.attestations.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-soft">Warehouse</dt>
                <dd className="max-w-[11rem] text-right font-medium">{lot.warehouse}</dd>
              </div>
            </dl>
          </section>

          <section className="card bg-olive-light/30 p-5">
            <div className="flex items-center gap-2">
              <Leaf className="h-4 w-4 text-olive" />
              <h2 className="font-display text-lg font-bold">Series rules</h2>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-ink-soft">
              <li className="flex gap-2">
                <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />2 decimals · smallest unit{" "}
                {(lot.litres.perToken / 100).toLocaleString("en-US")} L
              </li>
              <li className="flex gap-2">
                <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                {lot.series === "DGZ" ? "0.5 DGZ (5 L)" : "1 TZT (1,000 L)"} minimum redemption
              </li>
              <li className="flex gap-2">
                <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                Tokens burn at physical handover
              </li>
              <li className="flex gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-olive" />
                Sales pause automatically on STALE or UNDERBACKED
              </li>
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="font-display text-lg font-bold">Acting as</h2>
            <p className="mt-1 text-sm font-semibold">{account?.label}</p>
            <p className="font-mono text-[11px] text-ink-soft">{account?.accountId}</p>
            <p className="mt-2 text-[11px] text-ink-soft">
              Switch accounts in the header. Demo buyers start with 25,000 tUSDT.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
