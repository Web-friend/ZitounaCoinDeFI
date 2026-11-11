import { CheckCircle2, Fingerprint, ShieldEllipsis, XCircle } from "lucide-react";
import { useState } from "react";
import { dateTime, shortId } from "../lib/format.js";
import { verifyLotChain } from "../lib/verify.js";
import { CopyButton } from "./ui.jsx";

export default function VerifyPanel({ lot }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const outcome = await verifyLotChain(lot);
      setResult(outcome);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive-light text-olive-deep">
            <Fingerprint className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold">Independent verification</h2>
            <p className="text-xs text-ink-soft">
              Re-verifies the genesis, every P-256 signature and the SHA-256 chain in your browser.
            </p>
          </div>
        </div>
        <button type="button" onClick={run} className="btn-secondary shrink-0 !px-4 !py-2 !text-xs" disabled={busy}>
          {busy ? "Verifying…" : result ? "Re-run" : "Verify now"}
        </button>
      </div>

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg bg-cream-deep/50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">Auditor key</p>
          <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-ink-soft">
            {shortId(lot.auditorPublicKey ?? "", 18, 8)}
            <CopyButton value={lot.auditorPublicKey ?? ""} />
          </p>
        </div>
        <div className="rounded-lg bg-cream-deep/50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink/45">HCS topic</p>
          <p className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-ink-soft">
            {lot.topicId ?? "—"}
            {lot.topicId ? <CopyButton value={lot.topicId} /> : null}
          </p>
        </div>
      </div>

      {result ? (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 ${
            result.ok ? "border-ok/25 bg-ok-soft/60 text-ok" : "border-rust/25 bg-rust-soft/60 text-rust"
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-sm font-semibold">
            {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {result.ok
              ? `Chain valid · ${result.attestationCount} attestation${result.attestationCount === 1 ? "" : "s"} verified`
              : "Verification failed"}
          </div>
          {result.ok ? (
            <p className="mt-1 text-xs opacity-80">
              Last attestation #{result.lastSeq}
              {result.lastLitres != null
                ? ` · ${Number(result.lastLitres).toLocaleString("en-US")} L declared`
                : ""}
              {result.lastTs ? ` · ${dateTime(result.lastTs)}` : ""}
            </p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs">
              {result.errors.map((error, index) => (
                <li key={`${error.code}-${index}`} className="flex gap-2">
                  <span className="font-mono font-bold">{error.code}</span>
                  <span className="opacity-80">{error.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-dashed border-ink/15 px-4 py-3 text-xs leading-relaxed text-ink-soft">
          <ShieldEllipsis className="mt-0.5 h-4 w-4 shrink-0 text-olive" />
          Nothing is trusted from the API: raw <span className="font-mono">zc1</span> records are fetched,
          parsed and verified with WebCrypto. Press verify to run it.
        </p>
      )}
    </section>
  );
}
