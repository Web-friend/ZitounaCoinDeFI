import { ExternalLink } from "lucide-react";
import { shortId } from "../lib/format.js";

const HASHSCAN = "https://hashscan.io/testnet";

export function isStubTx(txId) {
  return !txId || String(txId).startsWith("stub-");
}

export default function TxLink({ txId, kind = "transaction", base = HASHSCAN, className = "" }) {
  if (!txId) return <span className="text-ink/30">—</span>;
  if (isStubTx(txId)) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded bg-cream-deep px-1.5 py-0.5 font-mono text-[10px] text-ink-soft ${className}`}
        title={`Simulated transaction ${txId}`}
      >
        sim:{shortId(String(txId).replace(/^stub-/, ""), 12, 4)}
      </span>
    );
  }
  const path = kind === "topic" ? "topic" : kind === "token" ? "token" : "transaction";
  return (
    <a
      href={`${base}/${path}/${encodeURIComponent(txId)}`}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1 font-mono text-[10px] text-olive underline decoration-olive/30 underline-offset-2 hover:decoration-olive ${className}`}
      title={txId}
    >
      {shortId(String(txId), 10, 4)}
      <ExternalLink className="h-2.5 w-2.5" />
    </a>
  );
}
