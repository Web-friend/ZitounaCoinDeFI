import { verifyAttestationChain } from "./chain.js";
import { seriesConfig } from "./token-model.js";

export const VERDICTS = Object.freeze({
  BACKED: "BACKED",
  LOW_STOCK: "LOW_STOCK",
  UNDERBACKED: "UNDERBACKED",
  STALE: "STALE",
  INVALID: "INVALID",
});

export const REASONS = Object.freeze({
  S1: "S1 under 10% of certified litres left",
  U1: "U1 supply above attested litres",
  U2: "U2 new attestation shows less stock than supply",
  T1: "T1 no valid attestation within the staleness window",
  I1: "I1 bad signature or wrong auditor key",
  I2: "I2 sequence gap or broken chain",
  I0: "I0 no readable attestation",
});

export function verdictAllowsMint(verdict) {
  return verdict === VERDICTS.BACKED || verdict === VERDICTS.LOW_STOCK;
}

export function verdictAllowsSales(verdict) {
  return verdict === VERDICTS.BACKED || verdict === VERDICTS.LOW_STOCK;
}

export function verdictAllowsRedemptions(verdict) {
  return verdict !== VERDICTS.INVALID;
}

export function coverageBps(attestedLitres, supplyLitres) {
  if (supplyLitres <= 0) return 10_000;
  return Math.max(0, Math.floor((attestedLitres / supplyLitres) * 10_000));
}

/** Gauge value, capped at 100% (10,000 bps). Use coverageBps for over-cover. */
export function ratioBps(attestedLitres, supplyLitres) {
  return Math.min(10_000, coverageBps(attestedLitres, supplyLitres));
}

/**
 * Pure reserve rule. All litre values may be fractional; no money or DB access.
 */
export function evaluateReserve({
  certifiedLitres,
  attestedLitres,
  supplyLitres,
  latestAttestationTs = null,
  chainErrors = [],
  now = Date.now(),
  staleMs = 30 * 24 * 60 * 60 * 1_000,
  lowStockBps = 1_000,
}) {
  const reasons = [];
  let verdict = VERDICTS.BACKED;

  const hardErrors = chainErrors.filter((error) => error.code === "I1" || error.code === "I2");
  if (hardErrors.length > 0) {
    verdict = VERDICTS.INVALID;
    reasons.push(...new Set(hardErrors.map((error) => error.code)));
  } else if (latestAttestationTs == null) {
    verdict = VERDICTS.INVALID;
    reasons.push("I0");
  } else if (supplyLitres > attestedLitres + 1e-9) {
    verdict = VERDICTS.UNDERBACKED;
    reasons.push("U1");
  } else if (now - latestAttestationTs > staleMs) {
    verdict = VERDICTS.STALE;
    reasons.push("T1");
  } else if (attestedLitres <= (certifiedLitres * lowStockBps) / 10_000) {
    verdict = VERDICTS.LOW_STOCK;
    reasons.push("S1");
  }

  const ratio = ratioBps(attestedLitres, supplyLitres);
  return {
    verdict,
    reasons,
    reasonText: reasons.map((code) => REASONS[code] ?? code),
    ratioBps: ratio,
    coverageBps: coverageBps(attestedLitres, supplyLitres),
    certifiedLitres,
    attestedLitres,
    supplyLitres,
    headroomLitres: Math.max(0, attestedLitres - supplyLitres),
    latestAttestationTs,
    checkedAt: now,
    allowsMint: verdictAllowsMint(verdict),
    allowsSales: verdictAllowsSales(verdict),
    allowsRedemptions: verdictAllowsRedemptions(verdict),
  };
}

/**
 * Full evaluation from raw HCS records. Shared by backend, auditor CLI, tests
 * and the browser passport page.
 */
export async function evaluateLotFromRecords({
  genesisText,
  attestations,
  auditorPublicKeyHex,
  series,
  supplyCt,
  attestedAdjustmentLitres = 0,
  now = Date.now(),
  staleMs,
  lowStockBps = 1_000,
}) {
  const chain = await verifyAttestationChain({ genesisText, attestations, auditorPublicKeyHex });
  const last = chain.valid.at(-1);
  const cfg = seriesConfig(series);
  const supplyLitres = (supplyCt * cfg.litresPerToken) / 100;
  const certifiedLitres = chain.genesis?.fields?.litres ?? 0;
  const rawAttestedLitres = last?.parsed?.fields?.litresRemaining ?? 0;
  const attestedLitres = Math.max(0, rawAttestedLitres - attestedAdjustmentLitres);

  return {
    ...evaluateReserve({
      certifiedLitres,
      attestedLitres,
      supplyLitres,
      latestAttestationTs: last ? last.parsed.fields.ts : null,
      chainErrors: chain.errors,
      now,
      staleMs,
      lowStockBps,
    }),
    chain,
    series,
    supplyCt,
    rawAttestedLitres,
    attestedAdjustmentLitres,
    auditorPublicKeyHex: chain.genesis?.fields?.auditorPublicKeyHex ?? auditorPublicKeyHex,
  };
}

export function explainVerdict(result) {
  const ratio = (result.ratioBps / 100).toFixed(1);
  switch (result.verdict) {
    case VERDICTS.BACKED:
      return `The reserve covers ${ratio}% of circulating tokens, so sales and redemptions can continue. The latest auditor attestation is inside the freshness window and every signature checks out.`;
    case VERDICTS.LOW_STOCK:
      return `The reserve covers ${ratio}% of circulating tokens and the lot has under 10% of its certified litres left. Sales may continue to the cap, but the warehouse should schedule a re-attestation.`;
    case VERDICTS.UNDERBACKED:
      return `Circulating tokens exceed the attested litres, so minting is paused and the lot is flagged. Redemptions still work; a new attestation must restore cover before any sale continues.`;
    case VERDICTS.STALE:
      return `The latest valid attestation is older than the freshness window, so new sales are paused while redemptions continue. The auditor needs to sign a fresh stock count.`;
    case VERDICTS.INVALID:
      return `The attestation chain failed verification (${result.reasons.join(", ")}), so the lot is paused. No sale, mint or redemption should be trusted until a clean chain is published.`;
    default:
      return "The reserve state is unknown.";
  }
}
