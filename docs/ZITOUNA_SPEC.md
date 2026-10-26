# ZitounaCoin – Tokenized Olive Oil on Hedera

Oct 18, 2026 · @Motaz · Reframed from ProofPay

## Concept overview

ZitounaCoin turns certified Tunisian olive oil into fractional tokens: a buyer pays USDT for tokens, the producer is paid at once, and any holder can swap the tokens back for real oil from a named warehouse.

**Pitch in one sentence:** ZitounaCoin lets anyone own a slice of a certified lot of Tunisian olive oil, trade it like a token and redeem it for the real oil, while the producer is paid in USDT on day one.

**The problem (thesis to test in interviews)**

- Producers and cooperatives hold cash in stock while they wait for large buyers, and most Tunisian oil leaves in bulk. ONAGRI reports 381,200 tonnes worth 4,780.4 million TND for November 2025 to August 2026, and packaged oil was only 14.5% of that volume and 19.3% of the value ([La Presse](https://www.lapresse.tn/2026/09/23/huile-dolive-la-tunisie-exporte-vers-plus-de-82-pays/)).
- Small buyers (restaurants, shops, diaspora families, small importers) cannot buy a 20-tonne lot, so they cannot reach producer prices.
- Nobody outside the warehouse can check that the oil exists, what grade it is, or how much is left.

**What ZitounaCoin does**

- Each oil lot (grade, litres, mill, lab report hash, warehouse) is certified by an auditor key and recorded on the Hedera Consensus Service (HCS). The lot is also an HTS NFT, so it has a public passport.
- Two token series on the Hedera Token Service (HTS), one token per litre: **DigaZitoun** (10,000 units) and **TornataZite** (1,000,000 units). Both split into fractions.
- A buyer pays USDT and receives tokens in one atomic swap. The producer receives the USDT in the same transaction.
- Tokens move freely between wallets.
- To redeem, the holder sends tokens back, the warehouse hands over the oil, the handover is signed, and the tokens are burned.
- A reserve agent checks that tokens in circulation never exceed the certified litres in stock, and writes its verdict and reasoning to HCS.
- Anyone scans a QR code to see the lot, the supply, the reserve ratio and every signature.

**The two series (assumption: 1 token = 1 litre, change it if you meant otherwise)**

|  | DigaZitoun (DGZ) | TornataZite (TZT) |
| --- | --- | --- |
| Maximum supply | 10,000 tokens | 1,000,000 tokens |
| One token | 1 litre | 1 litre |
| Decimals | 2 (smallest piece 0.01 L) | 2 |
| Lot type | Premium packaged extra virgin oil | Wholesale and bulk lots |
| Typical buyer | Restaurants, shops, diaspora, individuals | Importers, traders, distributors |
| Minimum redemption | 5 tokens (one 5 L tin) | 1,000 tokens (one IBC tank) |
| Lot value at the August 2026 export average | about 132,000 TND | about 13.2 million TND |

Value check: 10,000 L x about 0.916 kg per litre x 14.42 TND per kg (ONAGRI August 2026 average) is about 132,087 TND. That average is for bulk exports, so a premium packaged lot will price higher. The seller sets the price, not this number. Confirm the density with a lab sheet.

**Scope rule:** one lot, one series (DigaZitoun), working end to end: certify, sell for USDT, transfer, redeem, burn. TornataZite runs on the same code with a pre-seeded wholesale lot. Everything else is roadmap.

## Track fit

ZitounaCoin covers three of the four thematic areas on the 4HACKS page with one demo, and each area maps to a visible moment on stage.

| Thematic area (event page) | How ZitounaCoin uses it | What judges see |
| --- | --- | --- |
| Real-World Assets Tokenization (provenance, supply chains, verifiable asset records) | Each lot is an HTS NFT and each series is an HTS token backed by certified litres | Lot passport with signed attestations; supply and reserve ratio change as tokens are sold and redeemed |
| DeFi (payments, stablecoins, new ways of transferring value) | Atomic USDT-for-token swap, fractional ownership, peer transfers | The producer's USDT balance rises while the buyer's token balance rises, in one transaction |
| AI x Web3 Agents (agents, automated transactions, trusted data, auditable AI services) | A reserve agent checks that supply never exceeds certified stock and logs its reasoning | Agent verdict card with a link to its HCS audit message |
| Decentralized Identity (optional stretch) | Verified-producer credential on the lot | Only if everything else is finished; not in the 14-day scope |

**Read the prize rules before choosing a strategy.** The event page says one overall winning team represents IHEC Sousse at the International Final, where finalists compete for the TND 15,000 pool. The first goal is to be the single best project at IHEC Sousse, so depth on one clear story beats breadth. Projects outside the listed areas can also qualify if they use Hedera in a meaningful way.

**Real Hedera usage (not a wrapper app):** an HCS topic per lot and one agent audit topic, an HTS NFT per lot with a metadata key, two finite-supply HTS fungible tokens plus a USDT stand-in, atomic multi-party transfers, and Mirror Node queries for the public passport.

## Token design

1. **Backed one to one.** No token exists without a litre of certified oil behind it. The latest valid auditor attestation sets the ceiling for minting.
2. **Mint on sale, burn on redemption.** Supply always equals litres sold and not yet redeemed. The maximum supply (10,000.00 and 1,000,000.00) is a hard cap set at token creation.
3. **Burning works through the treasury.** HTS burns only from the treasury account, so a redeeming holder first sends tokens to the treasury with the redemption ID in the memo, and the burn happens after handover.
4. **Keys.** A supply key (held by the mint service, limited by agent policy), a pause key for emergencies, and a KYC key that stays unused in the demo and switches on in a regulated phase. No wipe key and no freeze key, so nobody can take tokens from a holder. Say this on stage.
5. **Price.** The token is not pegged to a currency. The seller posts a price in USDT per litre for the primary sale, and after that holders set it by trading. Show the ONAGRI average as a reference only.
6. **Liquidity is a goal, not a property.** Fractions and free transfers make liquidity possible. The demo shows peer transfers; a simple order board is a stretch; a pool on a Hedera DEX is the mainnet answer, and it still needs buyers.
7. **USDT.** The demo uses a testnet stand-in called tUSDT. On day 2, check which USDT exists on Hedera and its token ID (USDC is the fallback) before any slide says real USDT.

## Lot and token lifecycle

A lot moves through eight steps, and only the redemption outcome branches.

1. **Certify.** The auditor signs an attestation (lot ID, litres, grade, lab report hash, warehouse receipt hash). The backend creates the lot topic, writes the genesis message with the auditor's public key and mints the lot NFT with status Active.
2. **List.** The producer picks a series, a price in USDT per litre and the litres on offer (never more than the certified litres).
3. **Buy.** The buyer chooses an amount, fractions allowed, and approves the USDT payment.
4. **Check.** The reserve agent checks that supply after this sale stays at or below the attested litres remaining.
5. **Swap.** The service mints the tokens to the treasury, then one atomic transaction moves USDT from buyer to producer and tokens from treasury to buyer. If the swap fails, the minted tokens are burned. A sale message goes to HCS.
6. **Hold and trade.** Holders transfer tokens freely. The passport shows supply and reserve ratio live.
7. **Redeem.** The holder sends at least the minimum amount to the treasury with a redemption ID. The warehouse prepares the oil. The handover is a signed event (the vault box button, or a signed operator confirmation), and the buyer enters a pickup code.
8. **Close.** The treasury burns the tokens, the lot NFT status is updated, the agent re-checks the reserve and a burn message goes to HCS. If the warehouse has not handed over by the deadline, the tokens return to the holder.

**Lot and redemption states**

| State | Trigger | Tokens | Producer's USDT |
| --- | --- | --- | --- |
| Certified | Valid attestation, lot NFT minted | None minted | None |
| Listed | Price and litres posted | None minted | None |
| Sold | Atomic swap confirmed | Minted to buyer | Received |
| Redemption requested | Tokens sent to treasury with an ID | Locked in treasury | Unchanged |
| Handed over | Signed handover plus pickup code | Locked until burn | Unchanged |
| Burned | Burn confirmed | Supply reduced | Unchanged |
| Returned | Deadline passed with no handover | Back to the holder | Unchanged |

The producer is paid at the sale, not at redemption. That is the product, and it is also the main trust risk, which is why the oil must already be certified in stock before a single token is minted.

## System architecture

The auditor signs the stock, the backend can only mint inside that signed limit, and the passport page checks everything against the public ledger.

&#91;embedded content: system architecture · auditor tool, backend and agent, Hedera services, vault box, public passport\]

**Trust boundaries**

- The auditor's key signs every attestation, so the backend cannot invent stock.
- The mint service can create tokens only up to the latest valid attested litres, and the agent enforces it.
- The swap is atomic: the producer cannot receive USDT without the tokens leaving, and the buyer cannot receive tokens without paying.
- Holder tokens cannot be wiped or frozen because those keys do not exist.
- Public reads go to the Mirror Node, so a viewer does not have to trust our servers.
- **Honest limit:** a token is only as good as the warehouse and the auditor. We prove what was attested and what moved, not that the drums are full today.

## Backend and Hedera spec

The backend is a thin, honest service: it verifies attestations, enforces the mint ceiling, runs the swap and redemption flow and writes everything to the ledger. Fees come from the Hedera fee table of October 2026 (testnet is the same, paid in free test HBAR); recheck them on day 12.

**Stack.** Node.js 20 with TypeScript, Fastify, SQLite (better-sqlite3), the Hedera JavaScript SDK (confirm on day 2 whether the package is now `@hiero-ledger/sdk`) and the Hedera Agent Kit. Run it on the demo laptop behind a Cloudflare Tunnel or ngrok, with a cloud copy as a backup.

| Object | Type | Purpose | Fee (USD) |
| --- | --- | --- | --- |
| Operator account | Account | Pays all fees | Free test HBAR |
| Producer, treasury and buyer accounts | Accounts | The parties in the demo | 0.05 each to create |
| Lot topic (one per lot) | HCS topic, submit key held by the backend | Genesis, attestations, listings, sales, redemptions, burns | 0.01 per topic |
| Agent audit topic (one in total) | HCS topic | Agent Kit audit hook logs every agent action | 0.01 |
| ZitounaCoin Lot collection | HTS NFT, supply key and metadata key | One NFT per lot, status in metadata | 1.00 to create, 0.02 per mint, 0.001 per update |
| DigaZitoun (DGZ) | HTS fungible, 2 decimals, finite supply 10,000.00 | Retail series | 1.00 to create, about 0.001 per mint or burn |
| TornataZite (TZT) | HTS fungible, 2 decimals, finite supply 1,000,000.00 | Wholesale series | 1.00 to create, about 0.001 per mint or burn |
| tUSDT | HTS fungible, 2 decimals | Testnet stand-in for USDT | 1.00 to create |
| Token associations | TokenAssociate | Each account that holds a token must associate first | 0.05 each |
| Swap desk v1 | Backend-run transfers, test accounts | Atomic swap and redemption flow | 0.001 per transfer |
| Swap desk v2 (stretch) | Solidity contract | Same flow with the rules in code | 1.00 to deploy |

A sale costs about 0.003 USD in ledger fees (mint, transfer, one message) and a redemption stays well under 0.01 USD. Date these figures on any slide.

**HCS message rules**

- The first message of every lot topic is a genesis record: `zc1|G|lotId|series|grade|litres|warehouse|auditorPublicKeyHex|producerAccount|harvestYear`.
- Attestations are written by the auditor tool as `record|signature`: `zc1|A|lotId|seq|ts|litresRemaining|labHash|receiptHash|prev`. The signature is ECDSA P-256 over the SHA-256 of the record text, 64 raw bytes (r then s) in base64url, so the browser verifies it with WebCrypto. All numbers are integers, and `prev` links to the previous attestation's chain hash so a gap or edit shows.
- Platform messages are written by the backend with the topic's submit key: L (listing), S (sale), R (redemption request), H (handover), B (burn), V (agent verdict).
- A message is one chunk of at most 1,024 bytes. A 250-byte message costs about 0.0009 USD.
- Readers get messages from the Mirror Node.

**Lot NFT design.** One collection, one serial per lot, minted to the producer. Metadata is capped at 100 bytes (HIP-17), so it holds a pointer and a status letter: `zc1|LOT-0001|0.0.7000001|A`, where A is active, L is low stock (under 10% of certified litres left) and D is depleted. The status changes with a TokenUpdateNfts transaction signed by the metadata key (HIP-657). Do a one-hour spike on day 4: mint, update, read back from the Mirror Node.

**REST API**

| Method and path | Caller | Purpose |
| --- | --- | --- |
| POST /api/v1/lots | Operator | Create topic, mint lot NFT, write genesis |
| POST /api/v1/lots/:id/attest | Auditor tool | Submit a signed attestation |
| POST /api/v1/lots/:id/list | Producer | Post price and litres |
| POST /api/v1/lots/:id/buy | Buyer | Check, mint, atomic swap |
| POST /api/v1/redemptions | Holder | Open a redemption and lock tokens |
| POST /api/v1/redemptions/:id/handover | Vault box or operator | Signed handover, then burn |
| GET /api/v1/lots, /lots/:id, /wallets/:account | Dashboard and passport | State, supply, reserve ratio, balances |
| GET /api/v1/lots/:id/stream | Dashboard | Server-sent events for live updates |
| POST /api/v1/demo/reset | Operator | Fresh lots for the next run |
| GET /api/v1/health | Everyone | Database and Hedera reachable |

Buy and redemption calls are safe to repeat (each has an idempotency key), and every rejected request is logged with a reason.

**Mirror Node reads** (base `https://testnet.mirrornode.hedera.com/api/v1`): `/topics/{topicId}/messages` for history, `/tokens/{tokenId}/nfts/{serial}` for lot status, `/tokens/{tokenId}` for supply, `/tokens/{tokenId}/balances` for holders. Link every transaction to HashScan. The Mirror Node can lag a few seconds, so the dashboard shows backend state first and confirms against the ledger. Keep keys in a `.env` file listed in `.gitignore` and top up test HBAR the day before the demo.

## Reserve agent

Rules decide, the AI explains, and every action is logged to HCS where anyone can check it.

- **Rules engine.** A deterministic, unit-tested TypeScript function in a shared package that the passport page can re-run. Input: the lot's verified attestations, token supply and open redemptions. Output: a verdict, reason codes and the attestation range used. Reserve ratio is litres remaining in the latest attestation divided by total token supply, and the target is 100% or more.
- **Explainer.** One LLM call turns the verdict into a three-sentence explanation. If it fails or takes more than 5 seconds, a template sentence is used. The LLM never changes a verdict or an amount.
- **Executor.** The Hedera Agent Kit submits the verdict message and performs mint and burn. Check the plugin list on day 5 and call the SDK directly where a tool is missing.

| Verdict | Effect | Reason codes |
| --- | --- | --- |
| BACKED | Sales and redemptions continue | None |
| LOW STOCK | Lot NFT set to L, sales continue to the cap | S1 under 10% of certified litres left |
| UNDERBACKED | Minting paused for the lot, alert shown | U1 supply above attested litres, U2 new attestation shows less stock than supply |
| STALE | New sales paused, redemptions continue | T1 no valid attestation in 30 days (demo: 60 seconds) |
| INVALID | Lot paused | I1 bad signature, I2 sequence gap or broken chain |

**Guardrails**

1. The Agent Kit audit hook (`HcsAuditTrailHook`) logs every tool call to the audit topic.
2. `MaxRecipientsPolicy` and `RejectToolPolicy` limit the agent: no token creation, no deletion, no key changes.
3. The agent may mint only to the treasury, only within attested headroom, and may burn only what the treasury received for a redemption.
4. Each sale and each redemption settles once, recorded in the database and on HCS.
5. A `PAUSE_AGENT` switch stops all minting. An operator override is logged as its own message.

**What is AI here, honestly.** The agent acts alone within hard limits and writes down why. A transparent formula protects the reserve. Pitch it as an accountable agent with a public audit trail, not a black-box model.

**Production path.** Hedera announced Agent Accounts on October 8, 2026, with on-chain spending limits and approved recipient lists. Limited testnet access starts in Q4 2026 and mainnet is targeted for Q2 2027, so mention them on the roadmap only ([Hedera announcement](https://hedera.com/blog/introducing-hedera-agent-accounts/)).

## Vault box (hardware, scaled down)

The box now does two jobs: it signs the HANDOVER event when oil leaves the warehouse, and it logs storage condition on the demo drum. Token flows work without it, so it is never on the critical path.

| Part | Purpose |
| --- | --- |
| ESP32 DevKit x2 | Controller and WiFi; flash both and keep one as the demo spare |
| DS18B20 probe + 4.7 kΩ resistor | Storage temperature |
| Reed switch + magnet | Drum or tank hatch opened |
| Push button | HANDOVER event (the pickup moment) |
| SSD1306 OLED, green and red LEDs, buzzer | Status visible from the back of the room |
| Power bank, small drum or bottle, heat pack | Demo rig; tape the probe to the container |

Suggested pins: DS18B20 on GPIO4, I2C on GPIO21 and GPIO22, reed switch on GPIO27, button on GPIO26 (both INPUT\_PULLUP), green LED GPIO25, red LED GPIO33, buzzer GPIO32. Avoid GPIO0, 2, 12 and 15. Use PlatformIO with the Arduino-ESP32 framework, OneWire, DallasTemperature, Adafruit SSD1306, ArduinoJson, LittleFS and mbedtls.

**Signed records** (same signing scheme as the attestations, integers only, chained with `prev`):

```text
Heartbeat: zc1|H|lot|seq|ts|n|tmin|tavg|tmax|open|flags|prev
Event:     zc1|E|lot|seq|ts|code|t|open|flags|prev|rid
```

Event codes: HANDOVER (carries the redemption ID in `rid`), HARD, BUDGET, LID, FAULT, BOOT. Temperature is x100.

**Storage profile** (illustrative; replace with the producer's spec sheet): extra virgin oil safe at 10 to 25 °C, hard limit above 30 °C, budget 120 minutes cumulative above 25 °C. In demo mode the budget shrinks to 15 seconds. A storage breach never freezes anyone's money: it flips the Lot health badge to Warning and is logged, because holders can redeem now. Handling spoilage claims is roadmap, with insurers.

**Fault filter.** A reading of exactly 85.0 °C or -127 °C, or a jump over 5 °C in 2 seconds, is a suspected sensor fault and never counts toward the budget.

**Fallback.** If the box fails, the dashboard HANDOVER button works with a signed operator confirmation, labelled as such.

**Acceptance tests.** Ice water reads within 1 °C of a reference thermometer. Three shared test vectors (record, hash, signature) verify in firmware, Node and the browser. A 2-hour soak test shows no reboot or sequence gap. After 5 minutes without WiFi, buffered records arrive in order. The box runs 4 hours on a power bank.

## Frontend spec

Two surfaces: an operator and buyer dashboard for the stage, and a public lot passport that opens from the QR code on a phone. Both read the same lot JSON.

**Stack.** React with Vite and TypeScript, Tailwind CSS, Recharts, the `qrcode` package and WebCrypto for signature checks. Design the passport for a phone first. Build against fixture files from day 3 (a sale run, a redemption run, an underbacked run) so the frontend never waits for the backend or hardware. The same fixtures power replay mode on demo day.

| Screen | Audience | Must show |
| --- | --- | --- |
| Market | Buyers | Lots with series, price per litre, litres left, health badge |
| Lot detail | Operator, on the projector | Reserve gauge (supply against certified litres), token supply, attestation timeline with consensus times, vault box readings, NFT badge with HashScan link, agent verdict card |
| Buy | Buyer | Amount with fractions, USDT total, Buy button, swap result |
| Wallet | Holder | DGZ, TZT and tUSDT balances, Send, Redeem |
| Redemption tracker | Holder, producer | Status steps, pickup code, signed handover |
| Passport, `/l/:id` (QR target) | Judges, buyers | Banner (Backed, Low stock, Underbacked), key facts, supply and reserve ratio, the line Signatures verified in your browser: n of n, HashScan links |
| Create lot and demo panel | Operator | Lot form, auditor attestation, reset, replay, demo thresholds |

```json
{
  "id": "LOT-0001",
  "series": "DGZ",
  "status": "BACKED",
  "grade": "extra_virgin",
  "litres": { "certified": 10000, "remaining": 9988, "unit": "L" },
  "price": { "value": 1450, "token": "tUSDT", "per": "L" },
  "supply": { "tokenId": "0.0.x", "circulating": 9.5, "max": 10000 },
  "topicId": "0.0.x",
  "nft": { "tokenId": "0.0.x", "serial": 1, "status": "A" },
  "attestations": [ { "seq": 3, "text": "zc1|A|...", "sig": "base64url", "consensusTs": "seconds.nanos" } ],
  "agent": { "verdict": "BACKED", "reasons": [], "explanation": "...", "decisionSeq": 21 }
}
```

**In-browser verification.** The passport reads HCS messages straight from the public Mirror Node, takes the auditor key from the genesis message, checks every attestation signature with WebCrypto, recomputes the chain and re-runs the reserve rule. It keeps working if our backend is down.

**Design rules.** Green is backed, amber is low stock or stale, red is underbacked or invalid, and these colours mean nothing else. Banners use at least 24 px text on a light background for the projector. A live indicator pulses on each new record. Label every simulated part (tUSDT, demo auditor key, demo warehouse) in small text.

## Live demo script

The demo is 3 minutes and ends with a producer paid and a holder collecting real oil. Everything before the first line is prepared in advance.

| Time | Presenter | Audience sees | Behind the scenes |
| --- | --- | --- | --- |
| 0:00 to 0:20 | Pitch lead: a cooperative near Sousse has 10,000 L of certified extra virgin oil in a warehouse | Lot passport: 10,000 L certified, 0 tokens, reserve gauge at 100% | Lot created and attested before the pitch |
| 0:20 to 1:00 | Pitch lead hands a judge a phone and asks them to buy 12.5 DigaZitoun | Judge scans the QR, buys with tUSDT, the producer's balance rises, supply shows 12.5 | Check, mint, atomic swap, S message |
| 1:00 to 1:20 | Judge sends 2 tokens to a friend | Both balances change, supply unchanged | Plain HTS transfer |
| 1:20 to 2:10 | Hardware lead: the holder redeems 5 tokens, then presses HANDOVER on the box | Redemption tracker moves to Handed over, tokens burn, supply falls to 7.5, remaining oil falls by 5 L | R, H and B messages, TokenBurn, lot NFT update |
| 2:10 to 2:40 | Backend lead shows the agent card | Verdict BACKED, reserve ratio, explanation, link to the HCS audit message | Rules engine, V message |
| 2:40 to 2:50 | Backend lead switches to the pre-seeded TornataZite wholesale lot | Same passport, 1,000,000 L series, all signatures valid | Pre-seeded lot |
| 2:50 to 3:00 | Backend lead: every step is on Hedera, scan it yourself | HashScan lot topic page | None |

Bonus if time allows (20 seconds): the auditor submits an attestation showing less stock than supply, and the agent flips the lot to UNDERBACKED and pauses minting.

**Before going on stage:** test venue WiFi (use a phone hotspot if needed), pre-create and fund the buyer accounts, associate every account to every token, check test HBAR, charge the power bank, flash the spare ESP32, and open the dashboard, passport, HashScan and the offline backup video in advance.

**Fallbacks.** Hedera slow: keep talking, the dashboard shows backend state while records catch up. Box fails: use the signed operator HANDOVER button, or replay mode, and say so. Everything fails: play the backup video.

**Honesty rule.** Always say what is simulated: tUSDT, the demo auditor and the demo warehouse. Judges forgive simulation and punish hidden simulation.

## Pitch chapters (10 minutes)

| # | Chapter | Time | Content | Speaker |
| --- | --- | --- | --- | --- |
| 1 | Problem | 1.0 min | A small restaurant and a cooperative with cash tied up in stock cannot reach each other; one sourced number (packaged oil 14.5% of volume, 19.3% of value) | Pitch lead |
| 2 | Solution | 1.0 min | One sentence, then five steps: certify, sell for USDT, trade, redeem, burn | Pitch lead |
| 3 | Live demo | 3.0 min | The script above | Hardware lead, backend lead narrating |
| 4 | Architecture | 1.5 min | Auditor signs stock, mint capped by it, atomic swap, browser verification | Backend lead |
| 5 | Why Hedera | 1.0 min | Fixed USD fees (about 0.003 USD per sale), native token service with no custom contract, atomic transfers, consensus timestamps, free public reads | Backend lead |
| 6 | Market and business model | 1.5 min | Who pays and how much, with sourced numbers and the honest size of the wedge | Pitch lead |
| 7 | Roadmap and team | 1.0 min | Pilot with one cooperative, contract desk and regulated USDT, export redemption, the ask | Pitch lead |

**Pitch rules.** Start with the cooperative and buyer story. Use only sourced numbers. Say Hedera network or public ledger, not blockchain, as the Hedera docs ask. Fact-check the finality time and fee figures before slides. Say clearly that a token is a claim on oil held by a custodian.

## Business model and market

ZitounaCoin earns a small share of the oil it moves, and ledger cost per sale is under 0.01 USD, so small sales are profitable. The ranges below are hypotheses to test in interviews, not facts.

| Stream | Payer | Hypothesis | Phase |
| --- | --- | --- | --- |
| Primary-sale fee | Producer | 0.5% to 1.5% of USDT raised, taken in the swap | Pilot |
| Redemption fee | Holder | Flat fee per redemption order | Pilot |
| Lot certification and listing | Cooperative or mill | Fee per lot for audit coordination and passport | Pilot |
| Secondary transfer fee | Traders | Optional HTS custom fee on transfers | 2 |
| SaaS dashboard | Cooperatives, exporters | Monthly fee for lots, attestations and reports | 2 |
| Insurance and finance partners | Insurers, lenders | Fee for a verified stock and condition feed | 3 |

**Unit economics (illustrative; replace with interview data).** A 10,000 L lot is about 132,087 TND at the August 2026 bulk export average. A 1% sale fee is about 1,321 TND. A premium packaged lot priced above that average earns proportionally more.

| Layer | Number | Source |
| --- | --- | --- |
| Tunisia olive oil exports, November 2025 to August 2026 | 381,200 tonnes worth 4,780.4 million TND | ONAGRI, via La Presse |
| Packaged oil share | 14.5% of volume and 19.3% of value, about 923 million TND | Same source; the value is our calculation |
| Reach | More than 82 destination countries; the EU takes 56.6% of volume | Same source |
| Diaspora and small-buyer demand | Open: needs interviews or national statistics | To do |

These figures come from your ProofPay file. Recheck them against the source before they go on a slide.

**The honest size of the first wedge.** A 1% fee on all of Tunisia's packaged oil exports (about 923 million TND) would be roughly 9.2 million TND a year if every exporter used ZitounaCoin. That is a modest pool and full adoption is unrealistic, so say so and show the path: diaspora and small importers, other Tunisian commodities, regional producers, then SaaS and insurance.

**Go-to-market.** This week, interview a mill or cooperative near Sousse, a restaurant or importer who buys oil, and a lawyer or bank contact about the rules. Pilot with one cooperative, one lot and about 10 buyers with real pickups. Then add a licensed payment partner and an insurer.

**Interview questions.** How long does it take to turn stock into cash today? Who would trust a token for oil and what would they need to see? How small a quantity would you buy? Who audits stock now? Would you pay a percentage or a flat fee?

## Risks and fallbacks

| Risk | Likelihood | Effect | Prevention and fallback | Owner |
| --- | --- | --- | --- | --- |
| Warehouse fails to deliver or oil is missing | Medium | Tokens lose their backing | Signed attestations, independent auditor, redemption deadline with token return, pilot with one trusted cooperative; roadmap: bond or insurance | Pitch |
| Tunisian exchange-control, crypto or securities-style rules | High | Pilot cannot go live | Testnet only; talk to a lawyer and a licensed provider before any real money | Pitch |
| Name clash (Zitouna Bank) and the word Coin | Medium | Trademark or perception problem | Check the name before the pitch; consider ZitounaToken | Pitch |
| USDT not available on Hedera testnet | High | No USDT on stage | tUSDT stand-in, labelled; confirm real token IDs on day 2 | Backend |
| Thin liquidity | High | Tokens hard to resell | Say it honestly; order board as a stretch; DEX pool on the roadmap | Pitch |
| Atomic swap or burn flow fails | Medium | Sale or redemption stuck | Mint then swap with burn on failure; idempotency keys; one-hour spike on day 4 | Backend |
| Sensor misreads or WiFi drops | Medium | False storage warning, no live data | Fault filter, offline buffer, operator HANDOVER button, replay mode | Hardware |
| Hedera testnet slow or down | Medium | Delayed records | Outbox with retry, replay mode, backup video | Backend |
| Scope creep | High | Missed freeze | Feature freeze on day 11; stretch list only after two clean runs | All |
| Judges see another RWA token | Medium | Looks unoriginal | Lead with the Tunisian oil story, real redemption on stage, proof of reserve in the browser | Pitch |

## Judge Q&A

Judges will attack trust, custody and regulation first. Rehearse each answer to under 30 seconds and say what is not solved.

| Question | Strong answer |
| --- | --- |
| How do we know the oil exists? | An auditor key signs periodic attestations of litres, grade, lab report hash and warehouse receipt hash, recorded on the public ledger. We prove what was attested. We do not prove the drums are full today, and the roadmap adds sensors, spot audits and insurers. |
| Who guarantees I get oil? | The warehouse is the custodian and the redemption has a deadline; if they miss it, tokens return to you. In a pilot we use one trusted cooperative. A bond or insurance is the next step. |
| Can the platform print tokens from nothing? | No. Minting is capped by the latest valid signed attestation, a public rule checks it, and anyone can re-run it in the browser. |
| Is this a security? | We do not know yet and will not pretend to. It is testnet, and we will take legal advice and use a licensed partner before any real money. |
| Is it really liquid? | Fractions and free transfers make liquidity possible, but liquidity needs buyers. The demo shows transfers, and a DEX pool is the mainnet plan. |
| Why not a normal marketplace? | A marketplace holds the orders and the stock record. Here the stock record is public and signed, ownership is a token the holder controls, and payment settles in the same transaction. |
| What about oil quality over months? | The vault box logs storage condition and the lot shows a health badge. We do not yet handle spoilage claims; that is for insurers in phase 3. |
| What does a sale cost on Hedera? | About 0.003 USD in ledger fees (mint, transfer, one message), from the October 2026 fee table. |
| Why Hedera? | Native token service with finite supply and burn, atomic transfers, fixed USD fees, consensus timestamps and free public reads, so the core flow needs no custom contract. |
| Why USDT and what about Tunisian currency rules? | Buyers abroad need a dollar asset. The demo uses a test token. Currency and capital-flow rules are unsolved and will be validated with a bank or licensed provider. |

## Team work division and timeline

About 100 hours over 14 days: 28 for the hardware and attestation lead, 38 for the backend lead and 34 for the frontend and pitch lead.

**Hardware and attestation lead (you), 28 hours**

- Wire the ESP32 with DS18B20, reed switch, button, OLED, LEDs and buzzer, calibrate in ice water (6 h).
- Record builder, chain hash, P-256 signing and the three shared test vectors (5 h).
- Auditor attestation tool: a script that signs a lot attestation and submits it (4 h).
- WiFi, NTP, HTTPS upload, offline buffer and backfill (5 h).
- On-device storage profile, HANDOVER event, OLED and LED states (3 h).
- Demo rig, spare unit, soak test, dry runs (5 h).

**Backend lead, 38 hours**

- Accounts, keys, SDK, configuration (2 h).
- HCS lot topics, genesis, queued submit with retry (4 h).
- HTS: lot NFT collection and status update, DGZ, TZT and tUSDT, associations (6 h).
- Mint, atomic swap, burn, redemption flow, idempotency (8 h).
- Attestation checks, SQLite, REST and live stream (6 h).
- Reserve agent: rules, Agent Kit, audit hook, policies, LLM explanation (7 h).
- Mirror Node reads, HashScan links, deployment, health check, reset (5 h).

**Frontend, pitch and business lead, 34 hours**

- Market, lot detail, wallet and redemption tracker, on fixtures then live (13 h).
- Passport page with in-browser signature, chain and reserve check (7 h).
- Create lot form and demo panel (2 h).
- Deck, storytelling, backup video, Q&A drill (8 h).
- Business model, sourced numbers, 2 to 3 interviews (4 h).

**Repo layout.** `/firmware`, `/backend`, `/frontend`, `/packages/rules` (reserve rules and record parser shared by backend and frontend), `/tools/auditor`, `/fixtures`, `/docs`. In the first three days, hold one one-hour meeting to freeze the record format, lot JSON and test vectors.

**Stretch goals** (only after two clean full runs): Solidity swap desk v2 (10 h), order board for secondary sales (6 h), cash-out redemption in USDT (4 h), re-run the verdict in the browser (2 h), verified-producer credential (8 h).

| Day | Date | Hardware and attestation | Backend | Frontend and pitch |
| --- | --- | --- | --- | --- |
| 1 | Sat Oct 17 | Done: idea shortlist | Done | Done |
| 2 | Sun Oct 18 (today) | Lock ZitounaCoin, order parts, check name and USDT options | Create testnet accounts, send one HCS message | Create repo and scaffold |
| 3 | Mon Oct 19 | Wire ESP32, DS18B20, OLED | HCS spike | Fixtures and skeleton. Joint one-hour meeting to freeze formats |
| 4 | Tue Oct 20 | Sensor loop, reed switch, button | Lot NFT mint and update spike (1 h), burn spike | Market and lot layouts |
| 5 | Wed Oct 21 | Chain hash, signing, test vectors | DGZ, TZT, tUSDT, associations, mint and atomic swap | Reserve gauge, browser signature check |
| 6 | Thu Oct 22 | Auditor attestation tool | Attestation checks and ingest API | Passport layout and QR |
| 7 | Fri Oct 23 | WiFi, upload, offline buffer | Outbox worker, redemption flow, live stream | Wallet and redemption tracker. **Checkpoint A: certified lot, tUSDT sale and wallet balance on the dashboard** |
| 8 | Sat Oct 24 | Storage profile, HANDOVER, LEDs | Rules package, agent skeleton. **Gate: if A passed, start the agent and v2; if not, cut to the floor** | Create form and demo panel |
| 9 | Sun Oct 25 | Integration 1 | Integration 1 | Integration 1 |
| 10 | Mon Oct 26 | Tune thresholds | Agent explanation, V messages, redemption end to end | Agent card and verdict banner |
| 11 | Tue Oct 27 | Handover and offline test on the rig | Deploy, tunnel, reset. **Checkpoint B: full flow twice without touching code. Feature freeze** | Final passport |
| 12 | Wed Oct 28 | Final rig, 2-hour soak test | Recheck fees, bug fixes only | Polish, deck draft, backup video |
| 13 | Thu Oct 29 | Pack list | Q&A drill | Final deck and video, Q&A drill |
| 14 | Fri Oct 30 | Three timed rehearsals, venue network test | Same | Same |
| Buffer | Sat Oct 31 | Submission and fixes | Submission and fixes | Submission and fixes |

The submission deadline was not in the original file. Check the exact date and time on the event page and post it in the team chat today.

**Cut order if you fall behind:** drop swap desk v2, then the LLM explanation (keep the template), then the order board, then the vault box (use the operator HANDOVER button), then the Agent Kit executor (call the SDK directly). The floor is a certified lot NFT, a tUSDT sale with fractional tokens, redemption with burn, and the QR passport.

## Definition of done

Every box ticked, the last one at least 3 hours before the deadline.

- [ ] The full flow (certify, buy, transfer, redeem, burn) runs twice in a row without code changes.
- [ ] TornataZite lot is pre-seeded and opens in the same passport.
- [ ] The passport opens from a printed QR on a phone and shows all signatures valid.
- [ ] Replay mode works and the backup video (under 3 minutes) plays offline.
- [ ] Operator account has enough test HBAR, a second funded operator exists, and HashScan links open.
- [ ] The agent audit topic shows the agent's tool calls, and no keys or `.env` file are in the repository.
- [ ] The vault box passed the 2-hour soak test, and the spare ESP32 is flashed.
- [ ] Three timed 10-minute rehearsals done, every number on a slide has a source and date, and the fee and finality claims are fact-checked.
- [ ] The repository has a README, the architecture diagram and setup steps, the deck is exported as a PDF, and the submission form is filled in at least 3 hours before the deadline.

## What changed from ProofPay, and what to confirm

**Kept:** HCS topics per record stream, an HTS NFT with a metadata key, signed and chained records verified in the browser, the rules-decide and AI-explains agent, the demo structure, the roles and the 14-day plan.

**Changed:** the core is now a backed token and a redemption instead of a shipment and a damage refund. The sensor box is now supporting evidence and the HANDOVER signer, not the payout trigger. The agent protects the reserve instead of judging cargo.

**Decisions to confirm**

1. Do DigaZitoun and TornataZite mean two series where one token is one litre, as assumed here, or something else (for example fractions of one master token)?
2. Name: Zitouna is also a well-known Tunisian bank, and Coin suggests a currency. Check this before the pitch.
3. Which USDT, if any, exists on Hedera, and is tUSDT acceptable for the demo?
4. Who plays the auditor and the warehouse on stage, and is there a real cooperative willing to pilot?
5. Is the first pilot redemption inside Tunisia only? Export shipping, customs and labelling are roadmap.
