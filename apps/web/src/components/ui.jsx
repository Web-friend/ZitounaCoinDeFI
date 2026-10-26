import { Check, Copy, Loader2, PackageOpen, TriangleAlert } from "lucide-react";
import { useState } from "react";

export function Spinner({ label = "Loading…", className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 text-ink-soft ${className}`}>
      <Loader2 className="h-6 w-6 animate-spin text-olive" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "Something went wrong" }) {
  return (
    <div className="card mx-auto max-w-lg p-6 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rust-soft text-rust">
        <TriangleAlert className="h-5 w-5" />
      </span>
      <h2 className="mt-3 font-display text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm text-ink-soft">{error?.message ?? "Unknown error"}</p>
      {onRetry ? (
        <button type="button" className="btn-primary mt-4" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, description, action, icon: Icon = PackageOpen }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 px-6 py-12 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-cream-deep text-olive">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-3 font-display text-lg font-bold">{title}</h3>
      {description ? <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint, className = "" }) {
  return (
    <div className={`rounded-xl border border-ink/8 bg-white/60 px-3.5 py-3 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">{label}</p>
      <p className="mt-1 font-display text-lg font-bold leading-tight text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-ink/45">{hint}</p> : null}
    </div>
  );
}

export function CopyButton({ value, label = "Copy", className = "" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft transition hover:bg-ink/5 ${className}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(String(value));
          setCopied(true);
          setTimeout(() => setCopied(false), 1_800);
        } catch {
          setCopied(false);
        }
      }}
      title={`Copy ${value}`}
    >
      {copied ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function SectionHeading({ eyebrow, title, description, action, className = "" }) {
  return (
    <div className={`mb-5 flex flex-wrap items-end justify-between gap-3 ${className}`}>
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-ink-soft">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Callout({ tone = "info", title, children, className = "" }) {
  const tones = {
    info: "border-olive/20 bg-olive-light/40 text-olive-deep",
    warn: "border-amber/25 bg-amber-soft/60 text-amber",
    danger: "border-rust/25 bg-rust-soft/60 text-rust",
    ok: "border-ok/25 bg-ok-soft/60 text-ok",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone] ?? tones.info} ${className}`}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-1 text-xs leading-relaxed opacity-90" : "text-xs leading-relaxed"}>{children}</div>
    </div>
  );
}
