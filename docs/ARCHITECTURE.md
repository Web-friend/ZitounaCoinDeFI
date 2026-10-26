# Architecture

## Scope

ZitounaDeFi is a single-tenant demo. It proves one full asset lifecycle:

```
certify → list → buy → transfer → redeem → hand over → burn → verify
```

It is intentionally small: three demo buyers, two seeded lots, no login, no
fiat rail and no mainnet deployment. The architecture keeps the trust-critical
parts (token math, record format, signature verification, reserve rule) in one
shared package so the API, the tests and the browser cannot drift apart.

## Components

| Component | Technology | Responsibility |
| --- | --- | --- |
| `apps/web` | React 19, Vite 7, Tailwind 4, React Query | Market, lot detail, buy, wallet, redemption tracker, public passport, QR label, demo controls |
| `apps/api` | Express 5, Prisma 6, Pino, Zod | Money flow, idempotency, persistence, ledger writes, OpenAPI, SSE |
| `packages/rules` | Plain JavaScript, WebCrypto | Token math, `zc1` codec, P-256 signatures, hash chain, reserve verdicts |
| `apps/api/src/ledger` | Adapter interface | `stub` simulation or real Hedera testnet |
| PostgreSQL 16 | Podman/Docker | Demo state, audit mirror, balances, idempotency records |

```mermaid
flowchart LR
  UI[React SPA] -->|/api/v1| API[Express API]
  API --> RULES[packages/rules]
  API --> DB[(PostgreSQL)]
  API --> LEDGER{ledger()}
  LEDGER --> STUB[Stub ledger]
  LEDGER --> HEDERA[Hedera testnet]
  UI -->|attestations + reserve| RULES
  UI -->|Mirror-shaped reads| API
```

## Repository layout

```
apps/api
  prisma/schema.prisma        data model and migration
  src/app.js                  Express wiring, CORS, Swagger
  src/routes/                 HTTP surface
  src/services/               domain logic
  src/ledger/                 stub.js, hedera.js, selector
  test/api.test.js            integration suite
apps/web
  src/pages/                  route screens
  src/components/             passport, gauge, timeline, QR
  src/lib/verify.js           browser-only chain and reserve verification
  e2e/demo.spec.js            Playwright journey
packages/rules
  src/token-model.js          DGZ/TZT conversion and pricing
  src/records.js              zc1 wire codec
  src/crypto.js               P-256 sign/verify, SHA-256
  src/chain.js                attestation chain verification
  src/reserve.js              verdict rule and explanations
```

## Request lifecycle

### Primary sale

1. `POST /lots/:id/buy` validates `accountId`, `litresMl` and `idempotencyKey`.
2. The service loads the lot, token, genesis and attestations, then reads the
   series token supply from the ledger.
3. `evaluateLotFromRecords()` verifies the audit chain, subtracts litres burned
   after the latest attestation, and returns a reserve verdict.
4. The sale gate rejects the request unless the verdict allows sales, the
   listing still has litres and the new supply would stay inside attested stock.
5. The service checks the buyer's tUSDT balance, mints series tokens to the
   treasury, then executes one multi-leg transfer:
   - tUSDT: buyer → producer
   - series token: treasury → buyer
   If the swap fails, the mint is burned as compensation.
6. A `SALE` record is written to the lot topic, the trade row and idempotency
   record are stored, and the agent re-checks the lot.
7. The API returns token amount, litre amount, price, HCS sequence and ledger
   transaction IDs.

### Peer transfer

Tokens move directly between two accounts. Supply does not change. The lot topic
receives a `TRANSFER` record and the response is idempotent.

### Redemption

1. The holder requests at least the series minimum.
2. Tokens are transferred holder → treasury and the redemption row is created
   with a six-digit pickup code and a deadline. This locks the claim without
   changing supply yet.
3. `POST /redemptions/:id/handover` requires the pickup code or an explicit
   operator override.
4. The treasury burns the locked tokens, the lot's remaining litres decrease,
   and `HANDOVER` + `BURN` records are written.
5. The agent re-runs. If the deadline passes without a handover, the operator can
   return the locked tokens to the holder (`POST /redemptions/:id/return`).

### Reset

`POST /demo/reset`:

1. Sweeps series-token balances from **every** non-treasury account into the
   treasury and burns the treasury balance. This is what keeps supply at zero
   even if a previous run left tokens with the producer or an old buyer.
2. Deletes trades, transfers, redemptions, verdicts, attestations, listings,
   lots, ledger messages and idempotency keys.
3. Deletes buyer rows and creates two new buyer accounts with generation-scoped
   key names.
4. Funds both buyers with 25,000 tUSDT and re-seeds both lots.

The reset is destructive by design. The UI labels it as such.

## Ledger abstraction

`ledger()` returns one of two adapters with the same small surface:

```js
createTopic, ensureTopic, submitMessage
createAccount, createFungibleToken, createNftCollection
associateToken, mintFungible, burnFungible, transferTokens
mintNft, updateNftMetadata
getTokenBalance, getTotalSupply, getHbarBalance
getTopicRecords, getTopicMessagesRaw, getTokenInfoRaw
```

| Concept | Stub | Hedera testnet |
| --- | --- | --- |
| Topic | `LedgerMessage` rows | HCS topic per lot + one agent topic |
| Fungible token | `Token` + `TokenBalance` rows | HTS fungible token, finite supply, 2 decimals |
| Lot passport | JSON metadata stored in `Token` | HTS NFT with metadata key, one serial per lot |
| Transfer | Database transaction | Atomic multi-leg `TransferTransaction` |
| Supply | Sum of `TokenBalance.amount` | `TokenMintTransaction` / `TokenBurnTransaction` |
| IDs | `0.0.900xxx`, `stub-*` | Real account/token/transaction IDs |

The stub is deliberately transaction-shaped. It enforces integer minor units,
non-negative balances, max supply and treasury-only burns, so the demo exercises
the same service logic as testnet.

The Hedera adapter is loaded lazily. Constructing it without operator
credentials fails fast with `HEDERA_NOT_CONFIGURED`; the stub never needs a
network.

## HCS audit trail

One topic per lot, plus one agent topic. All records start with `zc1`:

| Record | Purpose |
| --- | --- |
| `G` genesis | Lot ID, series, grade, certified litres, warehouse, auditor public key, producer, harvest year |
| `A` attestation | Signed stock count, lab/receipt hashes, previous chain hash |
| `L` listing | Price per litre, litres offered, currency |
| `S` sale | Buyer, litres, tokens, tUSDT amount |
| `T` transfer | Sender, recipient, tokens, memo |
| `R` redemption | Redemption ID, holder, tokens, litres |
| `H` handover | Redemption ID, source, salted pickup-code hash |
| `B` burn | Redemption ID, tokens burned |
| `V` verdict | Reserve verdict, ratio, supply, attested litres, reason codes |

The auditor signs an attestation with ECDSA P-256 over the SHA-256 of the record
text. The 64-byte `r‖s` signature is base64url encoded. Each record's `prev`
field is the SHA-256 of the previous record, producing a tamper-evident chain.
The browser verifies this chain again; it does not trust the API's verdict.

See [`../firmware/README.md`](../firmware/README.md) for the full wire format.

## Reserve engine

Verdict precedence (first match wins):

```
INVALID > UNDERBACKED > STALE > LOW_STOCK > BACKED
```

| Verdict | Condition | Sales | Redemptions |
| --- | --- | --- | --- |
| `INVALID` | Bad signature/key (`I1`), sequence gap or broken chain (`I2`), no attestation (`I0`) | Blocked | Blocked |
| `UNDERBACKED` | Supply > attested litres (`U1`), or new attestation below supply (`U2`) | Blocked | Allowed |
| `STALE` | Latest attestation older than the window (`T1`) | Blocked | Allowed |
| `LOW_STOCK` | Attested litres ≤ 10% of certified (`S1`) | Allowed to cap | Allowed |
| `BACKED` | None of the above | Allowed | Allowed |

Two details matter for correctness:

- **Effective stock.** Litres burned after the latest attestation are subtracted
  from that attestation's `litresRemaining`. Without this adjustment a lot would
  look over-backed until the next auditor visit.
- **Supply unit conversion.** Supply is stored in token minor units. The rule
  converts it to litres with the series config (DGZ 10 L/token, TZT 1,000
  L/token) before comparing against attested litres.

The rule is pure: no database, network or clock dependency except an injected
`now`. The API passes the current time and the configured staleness window; the
browser passes the same inputs from the public records.

## Data model

| Table | Purpose |
| --- | --- |
| `Account` | Demo roles and Hedera IDs. `keyEnvVar` points at the private key in `.env.local` |
| `Token` | Fungible series tokens, tUSDT and the lot NFT collection |
| `TokenBalance` | Stub-ledger balances for every token/account pair |
| `Lot` | Certified lot, status, topic, NFT serial, producer |
| `Attestation` | Signed record text, signature, chain hash, consensus time |
| `Listing` | Active price and litres offered |
| `Trade` | Primary sale, idempotency key, mint/swap transaction IDs |
| `Transfer` | Peer transfer and transaction ID |
| `Redemption` | Locked tokens, pickup code, deadline, handover/burn state |
| `AgentVerdict` | Latest and historical reserve decisions, HCS sequence |
| `LedgerMessage` | Stub HCS topic mirror used by the passport and mirror endpoints |
| `IdempotencyKey` | Operation scope plus stored response |
| `SystemSetting` | Demo knobs: staleness override, pause flag, ID counters |

The database is the operational state. On Hedera, the HCS topic and HTS supply
are the public source of truth; the database mirrors enough of them for fast
reads and links out to HashScan.

## Frontend

| Route | Screen |
| --- | --- |
| `/` | Market with live reserve badges |
| `/lots/:id` | Lot passport, reserve gauge, activity, QR label link |
| `/lots/:id/buy` | Fractional purchase |
| `/lots/:id/label` | Printable label with QR |
| `/wallet` | Balances, peer transfer, redemption entry |
| `/redemptions` | Redemption list and filters |
| `/redemptions/:id` | Status timeline, pickup code, handover |
| `/passports` | All lot passports |
| `/l/:id` | Public QR target with browser verification |
| `/demo` | Reset, fault injection, settings and ledger state |

The passport route deliberately uses the Mirror-shaped endpoint rather than the
aggregated lot endpoint. It takes the auditor key from the genesis record,
verifies every attestation locally with WebCrypto, recomputes the chain and
re-runs `evaluateReserve()`. The line "Signatures verified in your browser"
reflects that local result.

Tailwind 4 provides the olive design system. Status colours are reserved: green
backed, amber low stock/stale, red underbacked/invalid.

## Failure handling

| Failure | Behaviour |
| --- | --- |
| Duplicate buy/transfer/redemption request | Stored response replayed; no second charge |
| Same idempotency key, different operation | `409 IDEMPOTENCY_CONFLICT` |
| Mint succeeds, swap fails | Minted tokens are burned before the error is returned |
| Attestation chain broken | `INVALID`, sales and redemptions blocked |
| Stale attestation | Sales paused, redemptions continue |
| Under-backed lot | Sales paused, redemptions continue |
| Handover without code | Rejected unless `operatorOverride:true` |
| Handover after burn | `409 INVALID_REDEMPTION_STATE` |
| Hedera network error | `502 HEDERA_TRANSACTION_FAILED`; no partial database row is committed |

## Deferred for production

- Authentication and per-user authorisation
- A real KYC/AML and licensed stablecoin rail
- Durable outbox with retries for HCS/HTS writes
- Mainnet cost, key management and HSM/KMS custody
- Warehouse logistics, insurance, legal title and spoilage handling
- Order book or DEX liquidity
- Rate limiting, monitoring and backup/restore drills
