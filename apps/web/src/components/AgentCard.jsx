import { Bot, RefreshCw } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../lib/toast.jsx";
import { dateTime, percentFromBps, shortId } from "../lib/format.js";
import StatusBadge from "./StatusBadge.jsx";

const REASON_TEXT = {
  S1: "Under 10% of certified litres remain.",
  U1: "Circulating supply exceeds the attested litres.",
  U2: "The newest attestation shows less stock than the outstanding supply.",
  T1: "No valid attestation inside the freshness window.",
  I1: "Bad signature or the wrong auditor key.",
  I2: "Sequence gap or a broken hash chain.",
  I0: "No readable attestation found.",
};

export default function AgentCard({ lot, agent, onChecked, variant = "panel" }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const data = agent ?? lot?.agent ?? {};
  const evaluation = lot?.reserve ?? {};
  const verdict = data.verdict ?? evaluation.verdict ?? "INVALID";
  const reasons = data.reasons ?? evaluation.reasons ?? [];
  const explanation = data.explanation ?? evaluation.reasonText?.join(" ") ?? "";

  async function runCheck() {
    setBusy(true);
    try {
      const result = await api.agentCheck(lot.dbId ?? lot.id);
      toast.success(`Agent verdict: ${result.verdict.replace("_", " ")}`, {
        description: "A new verdict was written to the lot's HCS topic.",
      });
      onChecked?.(result);
    } catch (error) {
      toast.error("Agent check failed", { description: error.message });
    } finally {
      setBusy(false);
    }
  }

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3">
        <StatusBadge status={verdict} />
        <span className="text-xs text-ink-soft">{percentFromBps(data.ratioBps ?? evaluation.ratioBps)} cover</span>
      </div>
    );
  }

  return (
    <section className="card overflow-hidden">
      <div className="passport-banner grain relative px-5 py-4">
        <div className="relative flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream/15">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cream/60">
                Reserve agent
              </p>
              <p className="font-display text-lg font-bold">Automated solvency check</p>
            </div>
          </div>
          <StatusBadge status={verdict} />
        </div>
      </div>

      <div className="space-y-4 p-5">
        <p className="text-sm leading-relaxed text-ink/85">{explanation || "No explanation recorded yet."}</p>

        {reasons.length ? (
          <ul className="space-y-1.5">
            {reasons.map((reason) => (
              <li key={reason} className="flex gap-2 text-xs text-rust">
                <span className="mt-0.5 font-mono font-bold">{reason}</span>
                <span className="text-ink-soft">{REASON_TEXT[reason] ?? "Rule triggered."}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-ok-soft/60 px-3 py-2 text-xs font-medium text-ok">
            All five reserve rules passed: chain valid, fresh attestation, supply covered.
          </p>
        )}

        <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">Cover</dt>
            <dd className="mt-0.5 font-semibold">{percentFromBps(data.ratioBps ?? evaluation.ratioBps)}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">Supply</dt>
            <dd className="mt-0.5 font-semibold">
              {(Number(data.supplyCt ?? lot.supply?.circulatingCt ?? 0) / 100).toFixed(2)} {lot.series}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">Attested</dt>
            <dd className="mt-0.5 font-semibold">
              {Number(data.attestedLitres ?? evaluation.attestedLitres ?? 0).toLocaleString("en-US")} L
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">HCS seq</dt>
            <dd className="mt-0.5 font-mono text-[11px] font-semibold">
              {data.decisionSeq ? `#${data.decisionSeq}` : "—"}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
          <p className="text-[11px] text-ink/45">
            {data.createdAt ? `Last checked ${dateTime(data.createdAt)}` : "Not yet recorded on the topic"}
            {data.decisionSeq ? ` · tx ${shortId(String(data.decisionSeq))}` : ""}
          </p>
          <button type="button" className="btn-secondary !px-4 !py-2 !text-xs" onClick={runCheck} disabled={busy}>
            <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
            {busy ? "Checking…" : "Run agent check"}
          </button>
        </div>
      </div>
    </section>
  );
}
