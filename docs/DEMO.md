# Demo script

A three-minute run that ends with a producer paid, a holder collecting oil and a
judge verifying the audit trail in the browser.

## Before the audience arrives

```bash
bun run db:up
bun run prisma:migrate
bun run seed
bun run dev
```

Then open:

- App: http://localhost:5173
- Swagger: http://localhost:4000/docs
- Health: http://localhost:4000/api/v1/health

Preflight checklist:

- [ ] Header says the expected ledger mode. **Stub ledger** is correct unless
      real testnet keys are configured.
- [ ] `/demo` shows two lots, five accounts and `mode: stub` (or `hedera`).
- [ ] Buyer A and Buyer B each hold 25,000 tUSDT.
- [ ] `POST /demo/reset` succeeds and returns `LOT-0001`, `LOT-0002` and two new
      buyer IDs.
- [ ] Market cards show a green **Backed** badge.
- [ ] Projector shows the lot detail and reserve gauge clearly.
- [ ] Phone can open the printed QR target. If the phone is on the LAN, set
      `APP_BASE_URL` and `VITE_API_BASE` to the laptop's LAN IP before building
      or starting Vite. `localhost` on a phone points at the phone.
- [ ] Backup: a screen recording of this script, plus the E2E test as a fallback.

Reset immediately before the pitch:

```bash
curl -X POST http://localhost:4000/api/v1/demo/reset
```

## Three-minute script

### 0:00–0:20 — The asset

**Show:** `/lots/LOT-0001` (DigaZitoun).

**Say:** "A cooperative near Sousse has 10,000 litres of certified extra-virgin
oil in a named warehouse. The auditor signed that stock count. The lot passport
shows 10,000 litres certified, zero tokens in circulation and a 100% reserve."

Point at:

- the signed attestation timeline and auditor key,
- the reserve gauge,
- the lot NFT / topic links,
- the honest line that the audit proves signed stock, not legal title.

### 0:20–1:00 — Buy

**Do:**

1. Switch the account menu to **Buyer A**.
2. Open `/lots/LOT-0001/buy`.
3. Enter **12.5 L** (or use the max helper).
4. Confirm the price: 12.5 × 4.20 = **52.50 tUSDT**.
5. Click **Buy**.

**Show:** the success panel, then `/wallet`.

**Say:** "The buyer paid tUSDT and received 1.25 DGZ in one atomic swap. The
producer was paid in the same transaction. Supply is now 1.25 DGZ against
10,000 certified litres."

**Check:** Buyer A has 1.25 DGZ and 24,947.50 tUSDT. The producer's tUSDT
balance rose by 52.50.

### 1:00–1:20 — Transfer

**Do:**

1. Stay on `/wallet` as Buyer A.
2. Choose **Buyer B** as recipient.
3. Send **0.2 DGZ** (2 L) with an optional memo.
4. Switch to **Buyer B** and show the balance.

**Say:** "Ownership moves wallet to wallet. Supply does not change, and a
`TRANSFER` record is written to the lot topic."

**Check:** Buyer A 1.05 DGZ, Buyer B 0.2 DGZ. Supply stays 1.25 DGZ.

### 1:20–2:10 — Redeem and burn

**Do:**

1. Switch back to **Buyer A**.
2. On `/wallet` or `/redemptions`, redeem **0.5 DGZ** (the 5 L minimum).
3. Copy the six-digit pickup code.
4. Open the redemption detail.
5. Enter the code and press **Hand over** (warehouse source).
6. Show the status move to **Burned**.

**Say:** "0.5 DGZ is locked in the treasury, the warehouse releases a 5 L tin,
the handover is signed, and the claim is burned. Supply falls to 0.75 DGZ and
the lot's remaining stock falls by 5 litres."

**Check:** Buyer A 0.55 DGZ. Redemption status `BURNED`. Sequence includes
`REDEMPTION`, `HANDOVER` and `BURN`. Lot supply 0.75 DGZ, remaining 9,995 L.

### 2:10–2:40 — Verify in the browser

**Do:**

1. Open `/l/LOT-0001` (the QR target).
2. Scroll to the verification panel.
3. Point at **Signatures verified in your browser** and the re-computed reserve.

**Say:** "This page did not trust our API's verdict. It fetched the public
records, took the auditor key from genesis, checked every P-256 signature with
WebCrypto, rebuilt the hash chain and re-ran the reserve rule locally."

Open one HashScan link if on Hedera mode. In stub mode the links show the local
IDs and are labelled as simulated.

### 2:40–3:00 — Close

**Show:** `/` or `/lots/LOT-0002` (TornataZite).

**Say:** "The same code runs the 1,000,000-litre wholesale series. Every step is
a signed public record, the producer is paid on day one, and the holder can
always redeem or transfer. The honest limit: the auditor and warehouse are the
trust anchors, and this is testnet."

## Fault injection (20 seconds, optional)

### Under-backed lot

**Do:** `/demo` → **Inject under-backed attestation** for `LOT-0001`.

**Result:** a new signed attestation reports less stock than circulating tokens.
The agent flips to **UNDERBACKED / U1**, the lot pauses, new sales return
`409 RESERVE_UNDERBACKED`, and redemptions still work.

**Say:** "The token cannot be minted past signed stock. When the stock count
drops, sales stop automatically and the reason is on the public topic."

### Stale attestation

**Do:** `/demo` → set freshness to **5 seconds** → **Apply**.

**Result:** after five seconds the agent reports **STALE / T1**. Sales pause;
redemptions continue. Clear it with **Restore window**.

**Say:** "Freshness is part of backing. An old signature is not good enough to
sell new tokens."

### Agent pause

**Do:** `/demo` → toggle **Pause sales**.

**Result:** all new sales return `409 AGENT_PAUSED` until resumed. Useful if a
demo step starts going sideways.

## What to say when asked

**"Is the oil real?"** The auditor signs the stock count; the demo warehouse and
auditor are simulated. We prove what was attested and what moved, not that the
drums are full today. Production adds spot audits, sensors and insurance.

**"Can the platform print tokens?"** Only inside the latest signed stock ceiling.
The same rule runs in the API and the browser. Try it: the under-backed demo
pauses sales.

**"Is tUSDT real?"** No. It is a test token. Real USDT and Tunisian currency rules
are unsolved and need a licensed partner.

**"What happens if the warehouse never hands over?"** The redemption has a
deadline; after it, the operator can return the locked tokens. Production needs
a bond or insurance.

**"Why Hedera?"** Native finite-supply tokens, atomic multi-party transfers,
consensus timestamps, predictable fees and free public reads. The core flow
needs no custom contract.

## Recovery

| Problem | Action |
| --- | --- |
| API down | `bun run dev:api`, check `/api/v1/health` |
| Web down | `bun run dev:web` |
| Database down | `bun run db:up`, then `bun run seed` |
| State confusing | `curl -X POST .../demo/reset`, reload the app |
| Hedera slow | Keep talking; the UI shows backend state while records catch up |
| Phone cannot reach the app | Use the LAN IP in `APP_BASE_URL` / `VITE_API_BASE`, or show the passport on the laptop |
| Everything fails | Play the backup recording and use the E2E test output as evidence |

## After the demo

```bash
bun run test
bun run test:api
bun run test:e2e
```

`test:api` and `test:e2e` reset the demo database, leaving a fresh run for the
next rehearsal.
