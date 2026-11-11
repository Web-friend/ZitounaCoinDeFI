/**
 * ZitounaDeFi token model.
 *
 * Corrected economics (docs/TOKEN_MODEL.md):
 *   1 DGZ  = 10 litres      lot = 10,000 L  -> 1,000.00 DGZ
 *   1 TZT  = 1,000 litres   lot = 1,000,000 L -> 1,000.00 TZT
 *
 * On-chain tokens use 2 decimals, so 1 minor unit (ct) is:
 *   DGZ: 0.1 L      TZT: 10 L
 */
export const DECIMALS = 2;
export const MINOR_PER_TOKEN = 10 ** DECIMALS;

export const SERIES = Object.freeze({
  DGZ: Object.freeze({
    code: "DGZ",
    name: "DigaZitoun",
    tagline: "Retail extra-virgin olive oil",
    litresPerToken: 10,
    lotLitres: 10_000,
    maxTokens: 1_000,
    minRedemptionTokens: 0.5,
    minRedemptionMl: 5_000,
    buyer: "Restaurants, shops, diaspora, individuals",
  }),
  TZT: Object.freeze({
    code: "TZT",
    name: "TornataZite",
    tagline: "Wholesale and bulk lots",
    litresPerToken: 1_000,
    lotLitres: 1_000_000,
    maxTokens: 1_000,
    minRedemptionTokens: 1,
    minRedemptionMl: 1_000_000,
    buyer: "Importers, traders, distributors",
  }),
});

export function seriesConfig(series) {
  const cfg = SERIES[series];
  if (!cfg) throw new Error(`Unknown series: ${series}`);
  return cfg;
}

/** 1 minor token unit expressed in millilitres. */
export function mlPerMinorUnit(series) {
  return seriesConfig(series).litresPerToken * 1_000 / MINOR_PER_TOKEN;
}

/** Convert millilitres to integer token minor units (ct). */
export function mlToTokensCt(series, ml) {
  const unit = mlPerMinorUnit(series);
  if (!Number.isInteger(ml) || ml < 0) throw new Error("ml must be a non-negative integer");
  if (ml % unit !== 0) throw new Error(`${ml} mL is not representable in ${series} (step ${unit} mL)`);
  return ml / unit;
}

/** Convert token minor units (ct) to millilitres. */
export function tokensCtToMl(series, ct) {
  if (!Number.isInteger(ct) || ct < 0) throw new Error("tokensCt must be a non-negative integer");
  return ct * mlPerMinorUnit(series);
}

export function tokensCtToTokens(ct) {
  return ct / MINOR_PER_TOKEN;
}

export function tokensToCt(tokens) {
  const ct = Math.round(tokens * MINOR_PER_TOKEN);
  if (Math.abs(tokens * MINOR_PER_TOKEN - ct) > 1e-9) {
    throw new Error(`Token amount ${tokens} has more than ${DECIMALS} decimals`);
  }
  return ct;
}

/** Price in tUSDT cents for a given millilitre quantity. */
export function priceCentsForMl(ml, pricePerLitreCents) {
  if (!Number.isInteger(ml) || ml < 0) throw new Error("ml must be a non-negative integer");
  if (!Number.isInteger(pricePerLitreCents) || pricePerLitreCents < 0) {
    throw new Error("pricePerLitreCents must be a non-negative integer");
  }
  return Math.round((ml * pricePerLitreCents) / 1_000);
}

/** Litres represented by a token supply, in whole/fractional litres. */
export function supplyLitres(series, supplyCt) {
  return tokensCtToMl(series, supplyCt) / 1_000;
}

export function pricePerTokenCents(series, pricePerLitreCents) {
  return pricePerLitreCents * seriesConfig(series).litresPerToken;
}

export function tndCentsFromUsdCents(usdCents, tndPerUsdCents) {
  return Math.round((usdCents * tndPerUsdCents) / 100);
}
