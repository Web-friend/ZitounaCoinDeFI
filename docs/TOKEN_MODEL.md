# Token model

ZitounaDeFi tokenizes a certified olive-oil lot into a finite-supply fungible
token. The implementation is intentionally simple:

- **1 DGZ = 10 litres**
- **1 TZT = 1,000 litres**
- **1,000.00 tokens per lot** (both series)
- **2 decimals** on every token
- Mint only on a primary sale; burn only after a physical handover

This differs from the original one-token-per-litre sketch in
[`ZITOUNA_SPEC.md`](ZITOUNA_SPEC.md). The change keeps both seeded lots at 1,000
tokens, which gives readable token amounts and a €-sized retail ticket.

## Series

| | DigaZitoun (DGZ) | TornataZite (TZT) |
| --- | --- | --- |
| Lot size | 10,000 L | 1,000,000 L |
| Litres per token | 10 L | 1,000 L |
| Tokens per lot | 1,000.00 | 1,000.00 |
| Decimals | 2 | 2 |
| Smallest unit (`ct`) | 0.01 token = 0.1 L | 0.01 token = 10 L |
| Max supply | 100,000 ct = 1,000.00 tokens | 100,000 ct = 1,000.00 tokens |
| Minimum redemption | 0.5 token = 5 L | 1 token = 1,000 L |
| Seed price | 4.20 tUSDT/L | 3.80 tUSDT/L |
| Price per token | 42.00 tUSDT | 3,800.00 tUSDT |
| Seed TND reference | 13.02 TND/L | 11.78 TND/L |

The TND reference uses `TND_PER_USD_CENTS=310` (3.10 TND/USD). It is a display
reference only; the seller posts the tUSDT price.

## Integer arithmetic

All money and token values are integers on the wire and in the database. There
are no floating-point token balances.

Definitions:

```
MINOR_PER_TOKEN = 10^2 = 100
DGZ: mlPerMinorUnit = 10 L × 1,000 / 100  = 100 mL
TZT: mlPerMinorUnit = 1,000 L × 1,000 / 100 = 10,000 mL
```

Conversions:

```
tokensCt = ml / mlPerMinorUnit
ml       = tokensCt × mlPerMinorUnit
tokens   = tokensCt / 100
```

A purchase must land exactly on a representable step. For DGZ the purchase step
is **100 mL**; for TZT it is **10 L**. The API rejects a `litresMl` that does not
divide exactly.

Price:

```
amountCents = round(litresMl × pricePerLitreCents / 1000)
perTokenCents = pricePerLitreCents × litresPerToken
```

## Worked examples

### DGZ buy 12.5 L

```
litresMl  = 12,500
tokensCt  = 12,500 / 100        = 125
tokens    = 125 / 100           = 1.25 DGZ
amount    = 12,500 × 420 / 1000 = 5,250 ct = 52.50 tUSDT
```

### DGZ transfer 0.2

```
tokensCt = 20
ml       = 20 × 100 = 2,000 mL = 2 L
```

A peer transfer does not change total supply.

### DGZ redeem the minimum

```
0.5 DGZ = 50 ct = 5,000 mL = 5 L
```

The holder's tokens move to the treasury, the warehouse releases the oil, and
the treasury burns 50 ct after the pickup code is confirmed.

### TZT buy 1,000 L

```
litresMl  = 1,000,000
tokensCt  = 1,000,000 / 10,000 = 100
tokens    = 1.00 TZT
amount    = 1,000,000 × 380 / 1000 = 380,000 ct = 3,800.00 tUSDT
```

TZT's minimum redemption is 1 token (1,000 L), so a 1-token position is exactly
redeemable.

## Supply lifecycle

```
certified lot: supply 0
        │
        ├── buy 12.5 L ──► mint 1.25 DGZ (supply 1.25)
        ├── transfer    ──► supply unchanged
        ├── redeem 0.5  ──► tokens locked in treasury (supply still 1.25)
        └── handover    ──► burn 0.5 (supply 0.75)
```

Important: requesting a redemption does **not** reduce supply. The tokens are
locked in the treasury but still count as circulating until the burn. This is
deliberate: the claim still exists until the oil is handed over, and a missed
deadline can return it.

Supply is read from the ledger:

- stub mode: sum of all `TokenBalance` rows for the series token;
- Hedera mode: HTS total supply.

The max supply is fixed at token creation. A sale that would exceed the lot's
remaining attested headroom is rejected before minting.

## Reserve rule

The reserve engine compares effective attested litres with circulating litres:

```
supplyLitres = supplyCt × litresPerToken / 100
coverageBps  = floor(attestedLitres / supplyLitres × 10,000)
gaugeRatio   = min(10,000, coverageBps)       // the gauge is capped at 100%
```

An empty supply is defined as 100% covered.

Effective attested litres:

```
effectiveAttested = latestAttestation.litresRemaining
                  - litresBurnedAfter(latestAttestation.consensusTs)
```

Example: the auditor attests 9,995 L. The holder then redeems 5 L and the burn
happens. Until the next attestation, effective stock is 9,990 L, so the lot does
not look under-backed by the 5 L that left the warehouse.

Verdict precedence:

```
INVALID > UNDERBACKED > STALE > LOW_STOCK > BACKED
```

| Verdict | Trigger | Sales | Mints | Redemptions |
| --- | --- | --- | --- | --- |
| `INVALID` | Bad signature/key, gap, broken chain, no attestation | No | No | No |
| `UNDERBACKED` | Supply > effective attested litres | No | No | Yes |
| `STALE` | Latest attestation older than window | No | No | Yes |
| `LOW_STOCK` | Attested litres ≤ 10% of certified | Yes, to cap | Yes | Yes |
| `BACKED` | Otherwise | Yes | Yes | Yes |

`U2` (new attestation below supply) is represented by the same `UNDERBACKED`
verdict and the `U1` supply-vs-attestation comparison after the new record is
stored.

## Fees and decimals

- HTS token decimals are 2.
- Display code divides minor units by 100.
- Input code multiplies by 100 and validates at most two decimals.
- The UI's max button rounds down to a representable step.
- The API rejects amounts that would overflow a lot, exceed max supply, or fall
  below the minimum redemption.

## Why this model

- **Producer paid on day one.** The sale settles tUSDT and tokens atomically;
  the producer does not wait for a redemption.
- **Fractional access.** A restaurant can buy 12.5 L instead of a 10,000 L lot.
- **Finite and auditable.** Supply only grows against signed stock and shrinks
  on verified handover.
- **No hidden freeze.** The demo has no wipe or freeze key; a holder's balance is
  theirs until they transfer or redeem it.

## Limits

- A token is a claim on oil held by the demo custodian. It is not legal title.
- The model does not handle spoilage, insurance, export logistics, taxes or
  currency controls.
- Liquidity is a goal, not a property: there is no order book or DEX pool.
- tUSDT is a test token with no fiat backing.
