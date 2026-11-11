# ZitounaDeFi

Tokenized certified Tunisian olive oil on Hedera. A buyer pays tUSDT for a
fraction of a certified lot, the producer is paid immediately, the tokens move
freely, and a holder can redeem real oil. Every stock attestation is signed,
chained and checked in the browser.

This repository is the working hackathon demo described in
[`docs/ZITOUNA_SPEC.md`](docs/ZITOUNA_SPEC.md). It runs end to end on a laptop
with a simulated ledger, and switches to Hedera testnet when operator keys are
present.

> **Demo, not a production security.** tUSDT, the auditor and the warehouse are
> simulated. The audit trail proves what the auditor signed, not that the drums
> are full today. See [Trust model and limits](#trust-model-and-limits).

## The flow

```
certify ──► list ──► buy (atomic tUSDT ⇄ token swap) ──► transfer
                                                            │
                                          redeem ◄──────────┘
                                             │
                              hand over oil ─┴─► burn the claim
```

Every step writes a public `zc1|...` record to the lot's HCS topic. A reserve
agent re-runs the backing rule after each change and writes its verdict and
reasoning to the agent audit topic.

## Token model

The implemented model is **1 DGZ = 10 L** and **1 TZT = 1,000 L**. Each seeded
lot therefore has 1,000.00 tokens, with 2 decimals.

| | DigaZitoun (DGZ) | TornataZite (TZT) |
| --- | --- | --- |
| Lot | 10,000 L retail extra virgin | 1,000,000 L wholesale |
| One token | 10 L | 1,000 L |
| Tokens per lot | 1,000.00 | 1,000.00 |
| Smallest unit | 0.01 token = 0.1 L | 0.01 token = 10 L |
| Minimum redemption | 0.5 DGZ = 5 L | 1 TZT = 1,000 L |
| Seed price | 4.20 tUSDT/L (~13.02 TND/L) | 3.80 tUSDT/L (~11.78 TND/L) |
| Buyer | Restaurants, shops, diaspora | Importers, distributors |

The maximum supply is fixed when each HTS token is created. Supply increases
only when oil is sold and decreases only when a pickup is burned. Details and
worked examples are in [`docs/TOKEN_MODEL.md`](docs/TOKEN_MODEL.md).

## Architecture

```
React (Vite, Tailwind)                  Express API                    PostgreSQL
┌──────────────────────┐   /api/v1   ┌──────────────────────┐        ┌──────────────┐
│ market, lot passport │ ──────────► │ routes → services    │ ─────► │ Prisma models│
│ buy, wallet, redeem  │ ◄────────── │ reserve + audit rules│ ◄───── │ state + audit│
│ browser verification │             └──────────┬───────────┘        └──────────────┘
└──────────────────────┘                        │ ledger()
                                                ▼
                              ┌─────────────────────────────────────┐
                              │ stub ledger (default)               │
                              │  or Hedera testnet HCS + HTS        │
                              └─────────────────────────────────────┘
```

- `packages/rules` is pure JavaScript shared by the API, tests and the browser:
  token math, `zc1` codec, P-256 verification, chain verification, reserve
  verdicts.
- The API owns the money flow, idempotency, database state and ledger writes.
- The public passport (`/l/:id`) fetches the lot's HCS messages through the
  Mirror-shaped endpoint, verifies every attestation signature with WebCrypto,
  recomputes the hash chain and re-runs the reserve rule locally.

More detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quick start (local, stub ledger)

Requirements: [Bun](https://bun.sh), Podman (or Docker) with Compose.

```bash
cp .env.example .env
bun install
bun run db:up                 # PostgreSQL on localhost:5434
bun run prisma:migrate        # apply the schema
bun run seed                  # two lots, attestations, funded buyers
bun run dev                   # API :4000 + Vite :5173
```

Open http://localhost:5173. The olive banner says **Stub ledger** until real
Hedera keys are configured, so the simulation is never hidden.

Then:

1. Switch to **Buyer A** in the account menu.
2. Open **DigaZitoun**, buy 12.5 L (1.25 DGZ) with the pre-funded tUSDT.
3. Open **Wallet**, send 0.2 DGZ to Buyer B.
4. Redeem 0.5 DGZ (5 L) and copy the pickup code.
5. On **Redemptions**, hand over with the code. The tokens burn.
6. Open the passport `/l/LOT-0001` to verify signatures and the reserve in the
   browser, or print the QR label from the lot page.

Reset at any time from **Demo** (`/demo`) or:

```bash
curl -X POST http://localhost:4000/api/v1/demo/reset
```

A reset drains and burns outstanding series tokens, recreates both lots from
fresh signed attestations and issues new Buyer A / Buyer B accounts, so a
rehearsal always starts clean.

## Run everything in containers

```bash
cp .env.example .env         # optional; compose defaults to stub mode
podman compose up --build
```

| Service | URL |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://localhost:4000 |
| Swagger UI | http://localhost:4000/docs |
| Health | http://localhost:4000/api/v1/health |
| PostgreSQL | localhost:5434 |

The API container applies migrations and seeds an empty database on start. The
web container serves the built SPA and proxies `/api` to the API, so the browser
uses one origin. Keys generated in the container are persisted in `./keys`.

## Ledger modes

| Mode | When | Behaviour |
| --- | --- | --- |
| `stub` (default) | No Hedera credentials | Simulated HCS topics, HTS supply and balances in PostgreSQL. Visible banner in the UI. |
| `hedera` | `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY` set | Real testnet accounts, topics, tokens, NFT metadata and transfers via `@hiero-ledger/sdk`. |

To move to testnet follow [`docs/HEDERA_SETUP.md`](docs/HEDERA_SETUP.md):

```dotenv
LEDGER_MODE=hedera
HEDERA_OPERATOR_ID=0.0.xxxxx
HEDERA_OPERATOR_KEY=<DER private key>
```

```bash
bun run setup:hedera
bun run seed
```

Only testnet is exercised. Operator keys are backend-held and never sent to the
browser. There is no authentication: this is a demo account switcher, not a
custody product.

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | API and web dev servers together |
| `bun run build` | Production build of the web app |
| `bun run db:up` / `db:down` | Start / stop PostgreSQL with Podman Compose |
| `bun run prisma:migrate` | Apply Prisma migrations |
| `bun run seed` | Idempotent demo seed |
| `bun run setup:hedera` | Provision real testnet accounts, tokens and topics |
| `bun run smoke` | API smoke checks against a running server |
| `bun run test` | Pure rule tests (`packages/rules`), 15 tests |
| `bun run test:api` | API integration suite, 19 tests against the configured DB |
| `bun run test:e2e` | Playwright browser journey |
| `bun run test:all` | All three suites |

`test:api` resets the configured database before and after it runs, so point it
only at the demo database. Root `bun test` intentionally runs the unit suite
only; this avoids wiping a development database by accident.

## API

The full OpenAPI 3 document is served by Swagger UI at
http://localhost:4000/docs. Human-readable notes and curl examples are in
[`docs/API.md`](docs/API.md).

Core endpoints:

```
GET    /api/v1/health
GET    /api/v1/lots
GET    /api/v1/lots/:id
POST   /api/v1/lots/:id/buy
POST   /api/v1/lots/:id/transfer
POST   /api/v1/redemptions
POST   /api/v1/redemptions/:id/handover
GET    /api/v1/wallets/:account
GET    /api/v1/mirror/topics/:topicId/messages
POST   /api/v1/demo/reset
```

Buy, transfer and redemption requests require an idempotency key. A retry with
the same key returns the original result; reusing the key for a different
operation returns `409 IDEMPOTENCY_CONFLICT`.

## Repository layout

```
apps/api        Express API, Prisma schema, ledger adapters, tests
apps/web        React SPA, passport verifier, Playwright E2E
packages/rules  Shared token math, records, crypto, chain, reserve rules
docs            Architecture, API, demo script, token model, Hedera setup
firmware        Vault-box record format and hardware plan (documentation only)
```

## Tests

```bash
bun run test       # 15 rule tests
bun run test:api   # 19 API integration tests, resets the demo DB
bun run test:e2e   # Playwright: buy → transfer → redeem → burn → passport
```

The E2E suite resets the demo first when the API reports stub mode. With
`LEDGER_MODE=hedera` it runs against existing state instead.

## Trust model and limits

- The auditor's P-256 key signs stock counts. The backend cannot invent stock,
  but a compromised auditor key can.
- The genesis message is written by the backend submit key. The chain proves the
  attestations that follow it, not the genesis itself. The UI states this.
- The reserve engine proves solvency against signed stock; it does not prove
  legal title, insurance, quality today or that a warehouse will honour a
  pickup.
- `tUSDT` is a test stablecoin, not real USDT. There is no fiat rail.
- Redemption is a demo handover with a six-digit pickup code, not a logistics
  integration.
- No authentication, no user accounts, no rate limiting, no mainnet deployment.
- Hedera testnet can lag; the UI reads backend state first and links to HashScan
  for confirmation.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API guide](docs/API.md)
- [Demo script](docs/DEMO.md)
- [Token model](docs/TOKEN_MODEL.md)
- [Hedera setup](docs/HEDERA_SETUP.md)
- [Source specification](docs/ZITOUNA_SPEC.md)
- [Firmware / vault-box records](firmware/README.md)
