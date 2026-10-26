import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ClipboardCheck,
  Droplets,
  Leaf,
  Package,
  PackageCheck,
  Plus,
  ScanLine,
  Ticket,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, idempotencyKey } from "../lib/api.js";
import { useAccount } from "../lib/account.jsx";
import { dateTime, litres } from "../lib/format.js";
import { useToast } from "../lib/toast.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { Callout, EmptyState, ErrorState, Spinner } from "../components/ui.jsx";

const STEPS = ["REQUESTED", "HANDED_OVER", "BURNED"];
const STEP_LABEL = { REQUESTED: "Requested", HANDED_OVER: "Handed over", BURNED: "Burned" };

function Progress({ status }) {
  const currentIndex =
    status === "BURNED" ? 2 : status === "HANDED_OVER" ? 1 : status === "RETURNED" ? 0 : 0;
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((step, index) => {
        const done = index <= currentIndex && status !== "RETURNED";
        const active = index === currentIndex;
        return (
          <div key={step} className="flex flex-1 items-center gap-1.5">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                done ? "bg-olive text-cream" : "bg-cream-deep text-ink/35"
              }`}
            >
              {done && !active ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            <span className={`text-[10px] font-semibold ${active ? "text-olive" : "text-ink/40"}`}>
              {STEP_LABEL[step]}
            </span>
            {index < STEPS.length - 1 ? <span className="h-px flex-1 bg-ink/10" /> : null}
          </div>
        );
      })}
    </div>
  );
}

export default function Redemptions() {
  const { account } = useAccount();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [trackCode, setTrackCode] = useState("");
  const [form, setForm] = useState({ series: params.get("series") ?? "DGZ", tokens: "" });

  const walletQuery = useQuery({
    queryKey: ["wallet", account?.id],
    queryFn: () => api.wallet(account.id),
    enabled: Boolean(account?.id),
  });
  const lotsQuery = useQuery({ queryKey: ["lots"], queryFn: api.lots });
  const redemptionsQuery = useQuery({
    queryKey: ["redemptions", account?.id],
    queryFn: () => api.redemptions(account?.id),
    enabled: Boolean(account?.id),
    refetchInterval: 15_000,
  });

  const lotParam = params.get("lot");
  const holding = walletQuery.data?.holdings?.find((item) => item.series === form.series);
  const lots = lotsQuery.data?.lots ?? [];
  const lot = useMemo(() => {
    if (lotParam) return lots.find((candidate) => candidate.id === lotParam) ?? null;
    return lots.find((candidate) => candidate.series === form.series) ?? null;
  }, [lots, form.series, lotParam]);

  const tokensNum = Number(form.tokens);
  const minTokens = holding?.minRedemptionTokens ?? (form.series === "DGZ" ? 0.5 : 1);
  const canRedeem =
    holding &&
    lot &&
    Number.isFinite(tokensNum) &&
    tokensNum >= minTokens &&
    tokensNum <= holding.tokens &&
    Math.round(tokensNum * 100) === tokensNum * 100;

  const requestMutation = useMutation({
    mutationFn: () =>
      api.requestRedemption({
        lotId: lot.id,
        holderId: account.id,
        tokensCt: Math.round(tokensNum * 100),
        idempotencyKey: idempotencyKey("redeem"),
      }),
    onSuccess: (result) => {
      toast.success(`Pickup ${result.redemption.code} opened`, {
        description: `Keep code ${result.redemption.pickupCode} for the warehouse.`,
      });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["lots"] });
      navigate(`/redemptions/${result.redemption.id}`);
    },
    onError: (error) => toast.error("Redemption rejected", { description: error.message }),
  });

  if (!account) return <Spinner label="Loading account…" className="py-24" />;
  if (redemptionsQuery.isLoading || walletQuery.isLoading) return <Spinner label="Loading redemptions…" className="py-24" />;
  if (redemptionsQuery.error)
    return <div className="shell py-16"><ErrorState error={redemptionsQuery.error} onRetry={redemptionsQuery.refetch} /></div>;

  const redemptions = redemptionsQuery.data?.redemptions ?? [];

  return (
    <div className="shell py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Physical settlement</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Redeem your oil
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Lock tokens, take a pickup code to the warehouse, and the tokens are burned at handover. If
            you miss the deadline, the tokens come back to your wallet.
          </p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (trackCode.trim()) navigate(`/redemptions/${encodeURIComponent(trackCode.trim())}`);
          }}
        >
          <div className="relative">
            <ScanLine className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input
              className="input !w-44 !py-2 !pl-8 !text-xs"
              placeholder="Track RDM-0001"
              value={trackCode}
              onChange={(event) => setTrackCode(event.target.value)}
              aria-label="Track a redemption by code"
            />
          </div>
          <button type="submit" className="btn-secondary !px-3 !py-2 !text-xs">
            Track
          </button>
        </form>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="card overflow-hidden">
          <div className="border-b border-ink/10 bg-white/40 px-5 py-4">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-olive" />
              <h2 className="font-display text-lg font-bold">New redemption</h2>
            </div>
            <p className="mt-0.5 text-xs text-ink-soft">
              Acting as {account.label}. Tokens move to treasury custody until handover.
            </p>
          </div>
          <form
            className="space-y-4 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (canRedeem) requestMutation.mutate();
            }}
          >
            <div>
              <label className="label" htmlFor="redeem-series">
                Series
              </label>
              <select
                id="redeem-series"
                className="input"
                value={form.series}
                onChange={(event) => setForm((current) => ({ ...current, series: event.target.value, tokens: "" }))}
              >
                {(walletQuery.data?.holdings ?? []).map((item) => (
                  <option key={item.series} value={item.series}>
                    {item.name} — {item.tokens.toFixed(2)} tokens ({litres(item.litres, 1)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="redeem-tokens">
                Tokens to redeem
              </label>
              <input
                id="redeem-tokens"
                className="input"
                type="number"
                step="0.01"
                min={minTokens}
                max={holding?.tokens ?? 0}
                value={form.tokens}
                onChange={(event) => setForm((current) => ({ ...current, tokens: event.target.value }))}
                placeholder={String(minTokens)}
              />
              <p className="mt-1.5 text-[11px] text-ink-soft">
                Minimum {minTokens} {form.series} ({litres(minTokens * (holding?.litresPerToken ?? 10), 0)})
                {holding ? ` · you hold ${holding.tokens.toFixed(2)}` : ""}
              </p>
            </div>

            {holding ? (
              <div className="rounded-xl border border-ink/10 bg-cream-deep/40 px-4 py-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Litres to collect</span>
                  <span className="font-semibold">
                    {Number.isFinite(tokensNum) && tokensNum > 0
                      ? litres(tokensNum * holding.litresPerToken, 2)
                      : "—"}
                  </span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-ink-soft">Lot</span>
                  <span className="font-semibold">{lot?.id ?? "—"}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-ink-soft">Warehouse</span>
                  <span className="max-w-[12rem] text-right font-medium">{lot?.warehouse ?? "—"}</span>
                </div>
              </div>
            ) : (
              <Callout tone="warn">You have no tokens in this series yet.</Callout>
            )}

            <button
              type="submit"
              className="btn-primary w-full !py-2.5 !text-xs"
              disabled={!canRedeem || requestMutation.isPending}
            >
              <Ticket className="h-3.5 w-3.5" />
              {requestMutation.isPending ? "Opening pickup…" : "Request pickup"}
            </button>
            {!holding?.tokens ? (
              <Link to="/" className="btn-secondary w-full !py-2 !text-xs">
                Buy tokens first
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : null}
          </form>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Your pickups</h2>
            <span className="text-xs text-ink-soft">{redemptions.length} total</span>
          </div>
          {redemptions.length === 0 ? (
            <EmptyState
              title="No redemptions yet"
              description="When you redeem, a pickup code appears here with a countdown to the warehouse deadline."
              icon={Package}
            />
          ) : (
            <div className="space-y-3">
              {redemptions.map((redemption) => (
                <Link
                  key={redemption.id}
                  to={`/redemptions/${redemption.id}`}
                  className="card block p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-lg font-bold">{redemption.code}</span>
                        <StatusBadge status={redemption.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {redemption.lotId} · {redemption.tokens} {redemption.series} ·{" "}
                        {litres(redemption.litres, 1)}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-soft">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {dateTime(redemption.deadline)}
                    </span>
                  </div>
                  <div className="mt-3">
                    <Progress status={redemption.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-ink/10 pt-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-soft">
                      {redemption.series === "DGZ" ? <Leaf className="h-3 w-3" /> : <Droplets className="h-3 w-3" />}
                      {redemption.holder.label}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-olive">
                      Open tracker
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function RedemptionSteps({ status }) {
  return <Progress status={status} />;
}

export { PackageCheck };
