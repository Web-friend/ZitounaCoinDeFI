# API guide

Base URL: `http://localhost:4000/api/v1`

Interactive OpenAPI 3 documentation: **http://localhost:4000/docs**  
Raw document: `apps/api/src/openapi.js`

No authentication. Account IDs in requests are the demo database IDs or Hedera
account IDs returned by `GET /accounts`.

## Units

The API accepts and returns integers for money and token amounts.

| Field | Meaning | Example |
| --- | --- | --- |
| `litresMl` | integer millilitres | `12_500` = 12.5 L |
| `tokensCt` | integer token hundredths (2 decimals) | `125` = 1.25 tokens = 12.5 DGZ litres |
| `amountCents` / `pricePerLitreCents` | tUSDT cents | `420` = 4.20 tUSDT/L |
| response `tokens`, `litres`, `amount` | display decimals | `1.25`, `12.5`, `52.5` |

1 DGZ = 10 L. 1 TZT = 1,000 L. So 0.5 DGZ (the minimum) is `tokensCt: 50` and
redeems 5 L.

Every write needs an idempotency key of at least 8 characters. Repeating the
same key for the same operation returns the stored response; reusing it for a
different operation returns `409 IDEMPOTENCY_CONFLICT`.

## Errors

Errors use one envelope:

```json
{
  "error": {
    "code": "RESERVE_HEADROOM",
    "message": "This sale would exceed the attested litres",
    "details": { "attestedLitres": 10000, "supplyLitres": 10000 },
    "requestId": "..."
  }
}
```

Common codes:

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_AMOUNT`, `MISSING_LITRES`, `BELOW_MINIMUM` | Bad input or below redemption minimum |
| 400 | `PICKUP_CODE_REQUIRED` | Handover needs a code or operator override |
| 404 | `LOT_NOT_FOUND`, `ACCOUNT_NOT_FOUND`, `REDEMPTION_NOT_FOUND` | Unknown resource |
| 409 | `LOT_NOT_OPEN`, `RESERVE_HEADROOM`, `RESERVE_STALE`, `RESERVE_UNDERBACKED`, `AGENT_PAUSED` | Reserve gate rejected the sale |
| 409 | `LISTING_EXHAUSTED`, `LOT_DEPLETED`, `NOT_LISTED` | Sale limits |
| 409 | `INSUFFICIENT_PAYMENT`, `INSUFFICIENT_TOKEN_BALANCE` | Balance too low |
| 409 | `IDEMPOTENCY_CONFLICT` | Key reused for another operation |
| 409 | `BAD_PICKUP_CODE`, `INVALID_REDEMPTION_STATE` | Redemption state conflict |
| 502 | `HEDERA_TRANSACTION_FAILED` | Testnet transaction failed |

## System

### `GET /health`

```bash
curl http://localhost:4000/api/v1/health
```

```json
{
  "status": "ok",
  "mode": "stub",
  "network": "testnet",
  "database": "up",
  "operatorBalanceHbar": 1000,
  "latencyMs": 12,
  "time": "2026-10-26T22:46:20.013Z"
}
```

## Lots

### `GET /lots`

Returns every lot with live supply, reserve verdict, price and listing state.

### `GET /lots/:id`

Accepts the lot code (`LOT-0001`) or database ID. Returns the full passport:

```json
{
  "lot": {
    "id": "LOT-0001",
    "series": "DGZ",
    "status": "BACKED",
    "lotStatus": "ACTIVE",
    "litres": { "certified": 10000, "remaining": 9995, "unit": "L", "perToken": 10 },
    "price": { "value": 4.2, "cents": 420, "per": "L", "perToken": 42 },
    "supply": { "circulating": 0.75, "circulatingCt": 75, "max": 1000, "unit": "DGZ" },
    "attestations": [{ "seq": 1, "text": "zc1|A|...", "signature": "...", "chainHash": "..." }],
    "agent": { "verdict": "BACKED", "reasons": [], "ratioBps": 10000, "decisionSeq": 7 },
    "reserve": {
      "verdict": "BACKED",
      "ratioBps": 10000,
      "attestedLitres": 9995,
      "supplyLitres": 7.5,
      "headroomLitres": 9987.5,
      "allowsSales": true,
      "allowsRedemptions": true
    },
    "hashscan": { "topic": "...", "token": "...", "nft": "..." }
  }
}
```

`status` is the reserve verdict; `lotStatus` is the operational lot state
(`ACTIVE`, `PAUSED`, `LOW_STOCK`, `DEPLETED`). `litres.remaining` is the
effective stock after subtracting litres burned since the latest attestation.

### `POST /lots`

Operator-only concept in the spec; unauthenticated in the demo.

```bash
curl -X POST http://localhost:4000/api/v1/lots \
  -H 'content-type: application/json' \
  -d '{
    "series": "DGZ",
    "grade": "extra_virgin",
    "certifiedLitres": 10000,
    "warehouse": "Sousse Central Warehouse · Bay 3",
    "harvestYear": 2026,
    "pricePerLitreCents": 420
  }'
```

Creates the lot row, HCS topic, genesis message and lot NFT passport.

### `GET /lots/:id/next-attestation`

Returns the next sequence number, previous chain hash and record template for
the auditor tool.

### `POST /lots/:id/attest`

Two forms:

1. **Auditor-signed** — send `recordText` and `signature`. The backend verifies
   the signature and chain before accepting.
2. **Demo helper** — send `litresRemaining`, `labHash`, `receiptHash` (and
   optional `seq`, `ts`). The backend signs with the demo auditor key. Clearly
   marked as simulated in the UI.

```bash
curl -X POST http://localhost:4000/api/v1/lots/LOT-0001/attest \
  -H 'content-type: application/json' \
  -d '{"litresRemaining":9990,"labHash":"sha256:demo","receiptHash":"sha256:demo"}'
```

### `POST /lots/:id/list`

```bash
curl -X POST http://localhost:4000/api/v1/lots/LOT-0001/list \
  -H 'content-type: application/json' \
  -d '{"pricePerLitreCents":420,"litresOffered":10000}'
```

### `POST /lots/:id/buy`

```bash
curl -X POST http://localhost:4000/api/v1/lots/LOT-0001/buy \
  -H 'content-type: application/json' \
  -d '{
    "accountId": "<buyer-db-id>",
    "litresMl": 12500,
    "idempotencyKey": "demo-buy-0001"
  }'
```

You may send `tokensCt` instead of `litresMl`. Response:

```json
{
  "tradeId": "...",
  "lotId": "LOT-0001",
  "buyer": { "id": "...", "label": "Buyer A", "accountId": "0.0.900023" },
  "litres": 12.5,
  "tokens": 1.25,
  "amount": 52.5,
  "currency": "tUSDT",
  "mintTxId": "stub-mint-DGZ-...",
  "swapTxId": "stub-transfer-...",
  "hcsSeq": 4,
  "createdAt": "..."
}
```

### `POST /lots/:id/transfer`

```bash
curl -X POST http://localhost:4000/api/v1/lots/LOT-0001/transfer \
  -H 'content-type: application/json' \
  -d '{
    "fromId": "<buyer-a-id>",
    "toId": "<buyer-b-id>",
    "tokensCt": 20,
    "memo": "split with a friend",
    "idempotencyKey": "demo-transfer-0001"
  }'
```

### `POST /lots/:id/agent-check`

Re-runs the reserve rule, writes a `V` record to the agent topic and returns the
verdict.

### `GET /lots/:id/agent`

Returns the latest stored verdict.

### `GET /lots/:id/stream`

Server-sent events. Sends a `hello` event and an `update` event whenever the lot
changes, with a heartbeat comment every 15 seconds.

```bash
curl -N http://localhost:4000/api/v1/lots/LOT-0001/stream
```

## Redemptions

### `GET /redemptions?accountId=...`

Lists redemptions, optionally filtered by holder database ID or Hedera account
ID.

### `POST /redemptions`

```bash
curl -X POST http://localhost:4000/api/v1/redemptions \
  -H 'content-type: application/json' \
  -d '{
    "lotId": "LOT-0001",
    "holderId": "<buyer-a-id>",
    "tokensCt": 50,
    "idempotencyKey": "demo-redeem-0001"
  }'
```

Locks 0.5 DGZ (5 L) in the treasury and returns:

```json
{
  "redemption": {
    "id": "...",
    "code": "RDM-0001",
    "status": "REQUESTED",
    "tokens": 0.5,
    "litres": 5,
    "pickupCode": "482913",
    "deadline": "...",
    "hcsSeq": 5
  }
}
```

The pickup code is only returned at request time; treat it as a secret.

### `POST /redemptions/:id/handover`

```bash
curl -X POST http://localhost:4000/api/v1/redemptions/<id>/handover \
  -H 'content-type: application/json' \
  -d '{"pickupCode":"482913","source":"WAREHOUSE"}'
```

`source` is free text (`WAREHOUSE`, `OPERATOR`, `VAULT_BOX`, ...).
`operatorOverride:true` skips the code and is labelled as an override in the
audit trail. Success burns the tokens and returns the redemption with
`burnTxId`, `handoverSeq` and `burnSeq`.

### `POST /redemptions/:id/return`

Returns locked tokens to the holder. Without `force`, only after the deadline.
Body: `{ "force": true }` to bypass the deadline in the demo.

### `GET /redemptions/:id`

Returns one redemption.

## Wallets and accounts

### `GET /accounts`

All demo accounts in switcher order. Use the `id` field in write requests.

### `GET /accounts/:ref/balances` and `GET /wallets/:ref`

`:ref` accepts the database ID, Hedera account ID or label.

```json
{
  "account": { "id": "...", "label": "Buyer A", "accountId": "0.0.900023", "role": "BUYER" },
  "balances": {
    "tUSDT": 24947.5,
    "DGZ": 1.25,
    "TZT": 0,
    "minor": { "tUSDT": 2494750, "DGZ": 125, "TZT": 0 }
  }
}
```

`GET /wallets/:ref` adds holdings with lot links, recent trades, transfers and
redemptions.

## Mirror-shaped reads

These work in both ledger modes. In stub mode they read the local audit mirror;
in Hedera mode they proxy the Mirror Node.

| Endpoint | Purpose |
| --- | --- |
| `GET /mirror/topics/:topicId/messages?limit=100&order=asc` | HCS messages in Mirror Node shape |
| `GET /mirror/tokens/:tokenId` | Supply and metadata |
| `GET /mirror/tokens/:tokenId/balances` | Holders |
| `GET /mirror/accounts/:accountId/tokens` | Token balances |

The public passport uses the topic endpoint to verify signatures and the reserve
locally.

## Demo controls

| Endpoint | Body | Effect |
| --- | --- | --- |
| `GET /demo/state` | — | Mode, network, accounts, tokens, lots, settings, policy |
| `POST /demo/seed` | — | Idempotent seed |
| `POST /demo/reset` | — | **Destructive**: drain/burn supply, recreate lots and buyers |
| `POST /demo/underbacked` | `{ "lotId": "LOT-0001" }` | Inject a low signed attestation and re-run the agent |
| `POST /demo/stale` | `{ "seconds": 5 }` | Override the freshness window for a few seconds |
| `DELETE /demo/stale` | — | Restore the configured window |
| `POST /demo/pause` | `{ "paused": true }` | Pause or resume all sales |

```bash
curl -X POST http://localhost:4000/api/v1/demo/reset
curl -X POST http://localhost:4000/api/v1/demo/stale \
  -H 'content-type: application/json' -d '{"seconds":5}'
curl -X DELETE http://localhost:4000/api/v1/demo/stale
```

## Operational notes

- CORS allows the origin in `CORS_ORIGIN` (default `http://localhost:5173`).
- JSON bodies are capped and validated with Zod.
- Helmet is enabled; CSP is disabled so Swagger UI works.
- The API logs structured Pino lines, including a request ID.
- Health checks query PostgreSQL and the ledger balance.
- In Hedera mode, a network write may fail after the database operation started;
  the service returns `502` and the UI asks the operator to retry. There is no
  durable outbox yet.
