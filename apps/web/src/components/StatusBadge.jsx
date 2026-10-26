const VERDICT_STYLE = {
  BACKED: "bg-ok-soft text-ok border-ok/20",
  LOW_STOCK: "bg-amber-soft text-amber border-amber/25",
  UNDERBACKED: "bg-rust-soft text-rust border-rust/25",
  STALE: "bg-amber-soft text-amber border-amber/25",
  INVALID: "bg-rust-soft text-rust border-rust/25",
  REQUESTED: "bg-gold-soft text-amber border-amber/25",
  HANDED_OVER: "bg-olive-light text-olive-deep border-olive/20",
  BURNED: "bg-ok-soft text-ok border-ok/20",
  RETURNED: "bg-cream-deep text-ink-soft border-ink/15",
  COMPLETED: "bg-ok-soft text-ok border-ok/20",
  FAILED: "bg-rust-soft text-rust border-rust/25",
  CERTIFIED: "bg-olive-light text-olive-deep border-olive/20",
  LISTED: "bg-olive-light text-olive-deep border-olive/20",
  ACTIVE: "bg-ok-soft text-ok border-ok/20",
  DEPLETED: "bg-cream-deep text-ink-soft border-ink/15",
  PAUSED: "bg-rust-soft text-rust border-rust/25",
};

const LABEL = {
  LOW_STOCK: "Low stock",
  UNDERBACKED: "Under-backed",
  HANDED_OVER: "Handed over",
  REQUESTED: "Requested",
  BURNED: "Burned",
  RETURNED: "Returned",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CERTIFIED: "Certified",
  LISTED: "Listed",
  ACTIVE: "Active",
  DEPLETED: "Depleted",
  PAUSED: "Paused",
};

export default function StatusBadge({ status, dot = true, className = "" }) {
  const style = VERDICT_STYLE[status] ?? "bg-cream-deep text-ink-soft border-ink/15";
  return (
    <span className={`badge border ${style} ${className}`}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {LABEL[status] ?? status ?? "Unknown"}
    </span>
  );
}
