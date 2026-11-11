# Hedera testnet setup

The demo runs on a local stub ledger by default. This guide switches it to real
Hedera testnet. Only testnet is exercised; do not point this code at mainnet
with real funds.

## What gets created

`bun run setup:hedera` calls the normal provisioning path and creates, if they
do not already exist:

| Object | Purpose |
| --- | --- |
| Treasury account | Mint/burn account for all tokens |
| Producer account | Receives tUSDT from sales |
| Buyer A / Buyer B accounts | Demo holders, funded with 25,000 tUSDT |
| `tUSDT` HTS fungible token | Test stablecoin, 2 decimals |
| `DGZ` HTS fungible token | 2 decimals, finite max 100,000 ct (1,000 tokens) |
| `TZT` HTS fungible token | 2 decimals, finite max 100,000 ct (1,000 tokens) |
| `ZLOT` HTS NFT collection | One serial per lot, metadata status letter |
| Agent audit topic | Reserve verdict history |
| One HCS topic per lot | Created by `bun run seed` |

The supply key and admin key are the operator key. Token associations are
created for the treasury, producer, operator and both buyers. New demo buyers
created by a reset are associated automatically.

## 1. Create and fund a testnet account

1. Open https://portal.hedera.com/ and create a testnet account.
2. Copy the account ID (`0.0.xxxxx`) and private key.
3. Fund it from https://portal.hedera.com/faucet. Provisioning creates four
   accounts with 20 HBAR each plus topic/token/message fees, so start with a
   comfortable balance (the health endpoint reports the live balance).

## 2. Configure credentials

Edit `.env` (never commit it):

```dotenv
LEDGER_MODE=hedera
HEDERA_NETWORK=testnet
HEDERA_OPERATOR_ID=0.0.xxxxx
HEDERA_OPERATOR_KEY=<private key>
DATABASE_URL="postgresql://zitouna:zitouna@localhost:5434/zitounadefi?schema=public"
```

`HEDERA_OPERATOR_KEY` accepts a DER-encoded key or the SDK string form. The
adapter tries DER first, then `PrivateKey.fromString`.

Optional mirror overrides:

```dotenv
MIRROR_BASE=https://testnet.mirrornode.hedera.com/api/v1
HASHSCAN_BASE=https://hashscan.io/testnet
```

## 3. Provision

```bash
bun run db:up
bun run prisma:migrate
bun run setup:hedera
```

Expected output: a table of account IDs and token IDs, HashScan links, and a
note that credentials were written to:

- `.env.local` — generated account IDs and private keys
- `keys/hedera-accounts.json` — JSON secret store
- `keys/auditor-private.jwk.json` — demo auditor P-256 key

All three are gitignored. `.env.local` overrides `.env` at startup.

Then seed the lots:

```bash
bun run seed
```

## 4. Verify

```bash
curl http://localhost:4000/api/v1/health
curl http://localhost:4000/api/v1/demo/state
```

Health should report `"mode": "hedera"` and the operator HBAR balance. The demo
state lists the real token and topic IDs.

Open a lot passport and follow a HashScan link:

- `/l/LOT-0001` — browser-verified signatures and reserve
- HashScan topic — `zc1|G|...`, `zc1|A|...`, sale/transfer/redemption records
- HashScan token — finite supply and holders
- HashScan NFT — lot serial and metadata

The API writes a message, then waits for the Mirror Node to expose it so the
response contains the real consensus timestamp and sequence. Mirror lag is
handled with retries; if the record is not visible within the wait window, the
database mirror is used and `mirrored: false` in the ledger result indicates the
fallback.

## 5. Run the flow

```bash
bun run dev
```

Buy, transfer, redeem and hand over exactly as in
[`DEMO.md`](DEMO.md). Each write is a real testnet transaction.

Reset with care in Hedera mode:

```bash
curl -X POST http://localhost:4000/api/v1/demo/reset
```

The reset burns outstanding series supply and creates two new buyer accounts.
Hedera accounts from previous runs are not deleted by the reset; the demo is
not designed as a cleanup service for testnet accounts.

## Switching back to stub

Set `LEDGER_MODE=stub` in `.env` (or remove it) and restart the API. The stub
ignores Hedera credentials. Keep `LEDGER_MODE` explicit in demos so the banner
matches reality.

If you switch modes against an existing database, note that token and account
IDs in the database came from the previous mode. For a clean switch:

```bash
bun run db:reset   # drops and recreates the schema
bun run seed
```

## Costs and limits

- All fees are paid in test HBAR by the operator.
- Account creation, token creation, topic creation, mint/burn and messages each
  cost fees; a sale is a mint, a multi-leg transfer and an HCS message.
- The spec's October 2026 estimate was roughly USD 0.003 per sale and under USD
  0.01 per redemption, using test HBAR.
- HCS and Mirror Node are eventually consistent. The dashboard shows backend
  state first.
- There is no durable outbox or retry queue. A network failure returns `502`;
  the operator retries the request with the same idempotency key where possible.
- Keys are files on the demo laptop. Production needs KMS/HSM, key rotation and
  separation of duties.
- The demo auditor is a P-256 JWK file, not an independent custodian.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `HEDERA_NOT_CONFIGURED` | Set both operator ID and key, then restart |
| `HEDERA_KEY_MISSING` for an account | Re-run `setup:hedera`; check `.env.local` |
| `INSUFFICIENT_TX_FEE` / low balance | Top up from the portal faucet |
| `TOKEN_NOT_ASSOCIATED` | Re-run seed/provision; associations are automatic but may have failed |
| HashScan link 404 | Testnet IDs only; check `HEDERA_NETWORK=testnet` |
| Passport says signatures invalid | The database came from another mode or the auditor key was regenerated; reset the database and re-seed |
| Mirror lag | Wait a few seconds, refresh; the UI reads backend state meanwhile |
