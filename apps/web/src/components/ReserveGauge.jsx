import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { percentFromBps } from "../lib/format.js";

const TONE = {
  BACKED: { bar: "bg-ok", text: "text-ok", icon: ShieldCheck },
  LOW_STOCK: { bar: "bg-amber", text: "text-amber", icon: ShieldAlert },
  UNDERBACKED: { bar: "bg-rust", text: "text-rust", icon: ShieldAlert },
  STALE: { bar: "bg-amber", text: "text-amber", icon: ShieldAlert },
  INVALID: { bar: "bg-rust", text: "text-rust", icon: ShieldQuestion },
};

export default function ReserveGauge({ evaluation, compact = false }) {
  const verdict = evaluation?.verdict ?? "INVALID";
  const tone = TONE[verdict] ?? TONE.INVALID;
  const Icon = tone.icon;
  const ratio = Math.max(0, Math.min(10_000, evaluation?.ratioBps ?? 0));
  const attested = evaluation?.attestedLitres ?? 0;
  const supply = evaluation?.supplyLitres ?? 0;
  const headroom = Math.max(0, attested - supply);
  const cover = supply > 0 ? attested / supply : 1;

  return (
    <div className={compact ? "" : "card p-5"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Reserve cover</p>
          <p className={`mt-1 font-display text-3xl font-bold ${tone.text}`}>{percentFromBps(ratio)}</p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {attested.toLocaleString("en-US", { maximumFractionDigits: 1 })} L attested vs{" "}
            {supply.toLocaleString("en-US", { maximumFractionDigits: 2 })} L tokenized
          </p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-full bg-current/10 ${tone.text}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-4">
        <div
          className="relative h-2.5 w-full overflow-hidden rounded-full bg-ink/10"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio / 100)}
          aria-label="Reserve coverage"
        >
          <div className={`h-full rounded-full transition-all duration-700 ${tone.bar}`} style={{ width: `${ratio / 100}%` }} />
          {cover < 1 ? (
            <span
              className="absolute inset-y-0 w-px bg-rust/60"
              style={{ left: `${Math.min(100, cover * 100)}%` }}
              aria-hidden
            />
          ) : null}
        </div>
        {!compact ? (
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-cream-deep/60 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">Headroom</p>
              <p className="mt-0.5 font-semibold text-ink">{headroom.toLocaleString("en-US", { maximumFractionDigits: 1 })} L</p>
            </div>
            <div className="rounded-lg bg-cream-deep/60 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">Verdict</p>
              <p className={`mt-0.5 font-semibold ${tone.text}`}>{verdict.replace("_", " ")}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
