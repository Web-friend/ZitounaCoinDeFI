import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  ExternalLink,
  Flame,
  Leaf,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Timer,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { dateTime, litres, money, shortId } from "../lib/format.js";
import { useToast } from "../lib/toast.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { Callout, ErrorState, Spinner } from "../components/ui.jsx";

export default function Demo() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [staleSeconds, setStaleSeconds] = useState("5");
  const [underbackedLot, setUnderbackedLot] = useState("");

  const stateQuery = useQuery({ queryKey: ["demo-state"], queryFn: api.demoState, refetchInterval: 20_000 });
  const state = stateQuery.data;
  const paused = state?.settings?.["agent:paused"] === "true";
  const staleWindow = state?.settings?.["demo:staleSeconds"];

  const refreshAll = () => {
    queryClient.invalidateQueries();
  };

  const resetMutation = useMutation({
    mutationFn: api.reset,
    onSuccess: (result) => {
      toast.success("Demo reset complete", {
        description: `Fresh lots ${result.lots.map((lot) => lot.id).join(", ")} · buyers ${result.freshBuyers.join(", ")}`,
      });
      refreshAll();
    },
    onError: (error) => toast.error("Reset failed", { description: error.message }),
  });

  const underbackedMutation = useMutation({
    mutationFn: () => api.underbacked({ lotId: underbackedLot || undefined }),
    onSuccess: (result) => {
      toast.success(`Verdict now ${result.verdict.verdict}`, {
        description: result.verdict.explanation,
      });
      refreshAll();
    },
    onError: (error) => toast.error("Fault injection failed", { description: error.message }),
  });

  const staleMutation = useMutation({
    mutationFn: () => api.stale(Number(staleSeconds)),
    onSuccess: (result) => {
      toast.info(`Freshness window set to ${result.seconds}s`, {
        description: result.verdicts.map((verdict) => verdict.verdict).join(" · "),
      });
      refreshAll();
    },
    onError: (error) => toast.error("Could not set staleness", { description: error.message }),
  });

  const clearStaleMutation = useMutation({
    mutationFn: api.clearStale,
    onSuccess: (result) => {
      toast.success("Freshness window restored", {
        description: result.verdicts.map((verdict) => `${verdict.verdict}`).join(" · "),
      });
      refreshAll();
    },
    onError: (error) => toast.error("Could not restore staleness", { description: error.message }),
  });

  const pauseMutation = useMutation({
    mutationFn: (next) => api.pause(next),
    onSuccess: (result) => {
      toast.info(result.paused ? "Agent paused" : "Agent resumed", {
        description: result.paused ? "New sales are blocked by the operator switch." : "Sales are allowed by the agent again.",
      });
      refreshAll();
    },
    onError: (error) => toast.error("Could not change pause state", { description: error.message }),
  });

  const seedMutation = useMutation({
    mutationFn: api.seed,
    onSuccess: () => {
      toast.success("Demo seeded");
      refreshAll();
    },
    onError: (error) => toast.error("Seed failed", { description: error.message }),
  });

  const runAllMutation = useMutation({
    mutationFn: async () => {
      const lots = state?.lots ?? [];
      const results = await Promise.allSettled(lots.map((lot) => api.agentCheck(lot.dbId)));
      return results;
    },
    onSuccess: (results) => {
      const failed = results.filter((result) => result.status === "rejected").length;
      toast.success(`Agent checked ${results.length} lot${results.length === 1 ? "" : "s"}`, {
        description: failed ? `${failed} failed — check the API logs.` : "All verdicts written to HCS.",
      });
      refreshAll();
    },
  });

  if (stateQuery.isLoading) return <Spinner label="Loading demo state…" className="py-24" />;
  if (stateQuery.error)
    return <div className="shell py-16"><ErrorState error={stateQuery.error} onRetry={stateQuery.refetch} /></div>;
  if (!state) return null;

  return (
    <div className="shell py-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Operator console</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Demo controls
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Reset the stage, inject a solvency failure, or shrink the freshness window live. Everything
            here maps to a real API call and a consensus message.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`badge border ${
              state.mode === "hedera" ? "border-ok/25 bg-ok-soft text-ok" : "border-gold/30 bg-gold-soft text-amber"
            }`}
          >
            {state.mode === "hedera" ? "Hedera testnet" : "Simulated ledger"}
          </span>
          <button type="button" className="btn-secondary !px-3.5 !py-2 !text-xs" onClick={refreshAll}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <Callout tone="warn" title="Stage-only controls" className="mt-5">
        Reset burns the demo supply and replaces the buyer accounts. Fault injection changes the verdicts
        of live lots. Do not expose this panel in production.
      </Callout>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-rust" />
              <h2 className="font-display text-lg font-bold">Reset the demo</h2>
            </div>
            <span className="badge border border-rust/25 bg-rust-soft text-rust">Destructive</span>
          </div>
          <div className="p-5">
            <p className="text-xs leading-relaxed text-ink-soft">
              Burns all DGZ/TZT held by demo buyers, clears lots and messages, retires the old buyers,
              creates two fresh funded accounts, and reseeds one DGZ and one TZT lot with attestations and
              a listing.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-ink-soft">
              <span>Current lots: {state.lots.length}</span>
              <span>Buyers: {state.accounts.filter((account) => account.role === "BUYER").length}</span>
              <span>Mode: {state.mode}</span>
              <span>Network: {state.network}</span>
            </div>
            <button
              type="button"
              className="btn-danger mt-4 !py-2.5 !text-xs"
              disabled={resetMutation.isPending}
              onClick={() => {
                if (window.confirm("Reset the demo? This burns demo supply and replaces buyer accounts.")) {
                  resetMutation.mutate();
                }
              }}
            >
              <Flame className="h-3.5 w-3.5" />
              {resetMutation.isPending ? "Resetting…" : "Reset & reseed"}
            </button>
            {state.lots.length === 0 ? (
              <button
                type="button"
                className="btn-primary mt-2 !py-2.5 !text-xs"
                disabled={seedMutation.isPending}
                onClick={() => seedMutation.mutate()}
              >
                <Leaf className="h-3.5 w-3.5" />
                {seedMutation.isPending ? "Seeding…" : "Seed empty database"}
              </button>
            ) : null}
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rust" />
              <h2 className="font-display text-lg font-bold">Inject an under-backed lot</h2>
            </div>
          </div>
          <div className="p-5">
            <p className="text-xs leading-relaxed text-ink-soft">
              Signs a new attestation with roughly half of the outstanding litres, then re-runs the agent.
              The lot should flip to <strong>UNDERBACKED</strong> and sales should stop while redemptions
              stay open.
            </p>
            <label className="label mt-4" htmlFor="underbacked-lot">
              Lot
            </label>
            <select
              id="underbacked-lot"
              className="input"
              value={underbackedLot || state.lots[0]?.id || ""}
              onChange={(event) => setUnderbackedLot(event.target.value)}
            >
              {state.lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.id} · {lot.series} · {lot.status}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-danger mt-3 !py-2.5 !text-xs"
              disabled={underbackedMutation.isPending || state.lots.length === 0}
              onClick={() => {
                if (window.confirm("Sign an attestation below outstanding supply and flip the lot?")) {
                  underbackedMutation.mutate();
                }
              }}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {underbackedMutation.isPending ? "Attesting…" : "Make under-backed"}
            </button>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-amber" />
              <h2 className="font-display text-lg font-bold">Freshness window</h2>
            </div>
            {staleWindow ? (
              <span className="rounded-full bg-amber-soft px-2 py-0.5 text-[10px] font-bold text-amber">
                {staleWindow}s
              </span>
            ) : (
              <span className="text-[10px] text-ink/40">default</span>
            )}
          </div>
          <div className="p-5">
            <p className="text-xs leading-relaxed text-ink-soft">
              Set the attestation staleness window to a few seconds, then re-run the agent. With an old
              attestation the verdict becomes <strong>STALE</strong>; new sales pause, redemptions continue.
            </p>
            <div className="mt-4 flex items-end gap-2">
              <div className="flex-1">
                <label className="label" htmlFor="stale-seconds">
                  Window (seconds)
                </label>
                <input
                  id="stale-seconds"
                  className="input"
                  type="number"
                  min="1"
                  max="31536000"
                  value={staleSeconds}
                  onChange={(event) => setStaleSeconds(event.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn-secondary !py-2.5 !text-xs"
                disabled={staleMutation.isPending}
                onClick={() => staleMutation.mutate()}
              >
                Apply
              </button>
              <button
                type="button"
                className="btn-ghost !py-2.5 !text-xs"
                disabled={clearStaleMutation.isPending || !staleWindow}
                onClick={() => clearStaleMutation.mutate()}
              >
                Restore
              </button>
            </div>
            <p className="mt-2 text-[11px] text-ink/40">
              Default window: {state.policy.attestationStaleSeconds.toLocaleString("en-US")}s.
            </p>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <PauseCircle className="h-4 w-4 text-olive" />
              <h2 className="font-display text-lg font-bold">Operator pause</h2>
            </div>
            <span className={`badge border ${paused ? "border-rust/25 bg-rust-soft text-rust" : "border-ok/25 bg-ok-soft text-ok"}`}>
              {paused ? "Paused" : "Running"}
            </span>
          </div>
          <div className="p-5">
            <p className="text-xs leading-relaxed text-ink-soft">
              A manual circuit breaker on top of the reserve rules. Pausing blocks every new sale while
              leaving the audit trail and redemptions intact.
            </p>
            <button
              type="button"
              className={paused ? "btn-primary mt-4 !py-2.5 !text-xs" : "btn-danger mt-4 !py-2.5 !text-xs"}
              disabled={pauseMutation.isPending}
              onClick={() => pauseMutation.mutate(!paused)}
            >
              {paused ? <PlayCircle className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5" />}
              {pauseMutation.isPending ? "Updating…" : paused ? "Resume sales" : "Pause all sales"}
            </button>
            <button
              type="button"
              className="btn-secondary mt-2 !py-2.5 !text-xs"
              disabled={runAllMutation.isPending || state.lots.length === 0}
              onClick={() => runAllMutation.mutate()}
            >
              <Bot className="h-3.5 w-3.5" />
              {runAllMutation.isPending ? "Checking…" : "Re-run agent on all lots"}
            </button>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ink/10 px-5 py-4">
            <Users className="h-4 w-4 text-olive" />
            <h2 className="font-display text-lg font-bold">Accounts</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="pl-5">Label</th>
                  <th>Role</th>
                  <th>Hedera ID</th>
                </tr>
              </thead>
              <tbody>
                {state.accounts.map((account) => (
                  <tr key={account.id}>
                    <td className="pl-5 font-medium">{account.label}</td>
                    <td className="text-xs uppercase tracking-wide text-ink-soft">{account.role}</td>
                    <td className="pr-5 font-mono text-[10px]">{account.accountId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-ink/10 px-5 py-4">
            <Wallet className="h-4 w-4 text-olive" />
            <h2 className="font-display text-lg font-bold">Tokens</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="pl-5">Symbol</th>
                  <th>Kind</th>
                  <th>Token ID</th>
                  <th>Series</th>
                </tr>
              </thead>
              <tbody>
                {state.tokens.map((token) => (
                  <tr key={token.tokenId}>
                    <td className="pl-5 font-medium">{token.symbol}</td>
                    <td className="text-xs text-ink-soft">{token.kind}</td>
                    <td className="font-mono text-[10px]">{token.tokenId}</td>
                    <td className="text-xs">{token.series ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.mode === "hedera" ? (
            <div className="border-t border-ink/10 px-5 py-3">
              <a
                href={`${state.hashscanBase}/token/${state.tokens[0]?.tokenId ?? ""}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-olive hover:underline"
              >
                Open HashScan
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ) : null}
        </section>
      </div>

      <section className="card mt-5 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-ink/10 px-5 py-4">
          <Leaf className="h-4 w-4 text-olive" />
          <h2 className="font-display text-lg font-bold">Lots</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="pl-5">Lot</th>
                <th>Series</th>
                <th>Status</th>
                <th>Topic</th>
                <th>NFT</th>
                <th className="pr-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.lots.map((lot) => (
                <tr key={lot.id}>
                  <td className="pl-5 font-semibold">{lot.id}</td>
                  <td>{lot.series}</td>
                  <td>
                    <StatusBadge status={lot.status} />
                  </td>
                  <td className="font-mono text-[10px]">{lot.topicId ?? "—"}</td>
                  <td className="font-mono text-[10px]">#{lot.nftSerial ?? "—"}</td>
                  <td className="pr-5">
                    <div className="flex gap-2 text-[11px]">
                      <Link to={`/lots/${lot.id}`} className="text-olive hover:underline">
                        Open
                      </Link>
                      <Link to={`/l/${lot.id}`} className="text-olive hover:underline">
                        Passport
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {state.lots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-sm text-ink-soft">
                    No lots. Use Reset & reseed above.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-display text-lg font-bold">Policy</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-cream-deep/50 px-3 py-2">
              <dt className="text-[10px] uppercase tracking-[0.1em] text-ink/45">Stale after</dt>
              <dd className="mt-0.5 font-semibold">
                {state.policy.attestationStaleSeconds.toLocaleString("en-US")}s
              </dd>
            </div>
            <div className="rounded-lg bg-cream-deep/50 px-3 py-2">
              <dt className="text-[10px] uppercase tracking-[0.1em] text-ink/45">Low-stock</dt>
              <dd className="mt-0.5 font-semibold">{state.policy.lowStockBps / 100}% of certified</dd>
            </div>
            <div className="rounded-lg bg-cream-deep/50 px-3 py-2">
              <dt className="text-[10px] uppercase tracking-[0.1em] text-ink/45">TND / USD</dt>
              <dd className="mt-0.5 font-semibold">{(state.policy.tndPerUsdCents / 100).toFixed(2)}</dd>
            </div>
            <div className="rounded-lg bg-cream-deep/50 px-3 py-2">
              <dt className="text-[10px] uppercase tracking-[0.1em] text-ink/45">Pickup deadline</dt>
              <dd className="mt-0.5 font-semibold">
                {Math.round(state.policy.redemptionDeadlineSeconds / 86_400)} days
              </dd>
            </div>
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="font-display text-lg font-bold">Agent topic</h2>
          <p className="mt-1 font-mono text-sm">{state.settings.agentTopicId ?? "—"}</p>
          <p className="mt-1 text-xs text-ink-soft">
            Verdict decisions are written here in addition to each lot topic. Server time{" "}
            {dateTime(state.serverTime)}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <Link to="/" className="btn-secondary !px-3 !py-1.5 !text-[11px]">
              Market
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link to="/passports" className="btn-secondary !px-3 !py-1.5 !text-[11px]">
              Passports
            </Link>
            <a
              href={`${state.hashscanBase}/topic/${state.settings.agentTopicId ?? ""}`}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost !px-3 !py-1.5 !text-[11px]"
            >
              HashScan
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </section>
      </div>

      <p className="mt-6 text-center text-[10px] text-ink/35">
        Demo state snapshot · {shortId(String(state.serverTime), 10, 0)} · accounts and token IDs are
        simulated unless the banner says Hedera testnet.
      </p>
    </div>
  );
}
