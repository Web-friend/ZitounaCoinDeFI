# Vault box — firmware record format

This directory documents the vault-box contract. **Firmware is not implemented
in this repository yet.** The web/API demo signs handovers with the operator's
pickup code; the hardware below is the physical extension described in
[`../docs/ZITOUNA_SPEC.md`](../docs/ZITOUNA_SPEC.md).

The box has two jobs:

1. Sign a `HANDOVER` event when oil leaves the warehouse.
2. Record storage temperature and hatch state on the demo drum.

Token flows must never depend on the box: if it fails, the dashboard handover
with a signed operator confirmation is the fallback.

## Hardware

| Part | Purpose |
| --- | --- |
| ESP32 DevKit ×2 | Controller and spare |
| DS18B20 + 4.7 kΩ | Temperature probe |
| Reed switch + magnet | Hatch/drum opening |
| Push button | Local handover trigger |
| SSD1306 OLED | Status |
| Green / red LED, buzzer | Backed / warning / fault |
| Power bank, demo drum, heat pack | Stage rig |

Suggested pins: DS18B20 GPIO4, I2C SDA/SCL GPIO21/22, reed GPIO27, button GPIO26
(both `INPUT_PULLUP`), green LED GPIO25, red LED GPIO33, buzzer GPIO32. Avoid
GPIO0, 2, 12 and 15.

## Wire format

All records are ASCII, pipe-separated, integers only, and start with `zc1`.
No field may contain `|`. Temperature is Celsius × 100. `ts` is Unix epoch
milliseconds. `prev` is the SHA-256 hex of the previous record, or the SHA-256
of the genesis record for the first device record.

```text
Heartbeat: zc1|H|lot|seq|ts|n|tmin|tavg|tmax|open|flags|prev
Event:     zc1|E|lot|seq|ts|code|t|open|flags|prev|rid
```

| Field | Meaning |
| --- | --- |
| `lot` | Lot code, e.g. `LOT-0001` |
| `seq` | Device-local sequence, starts at 1, no gaps |
| `ts` | Unix epoch milliseconds |
| `n` | Number of samples in the heartbeat window |
| `tmin`, `tavg`, `tmax` | Window temperature statistics × 100 |
| `open` | `0` closed, `1` hatch open during the window |
| `flags` | Comma-separated fault/warning flags, or `-` |
| `code` | Event code |
| `t` | Temperature at the event × 100, or `-12700` if unavailable |
| `rid` | Redemption code for `HANDOVER`, otherwise `-` |
| `prev` | SHA-256 hex of the previous record |

### Event codes

| Code | Trigger |
| --- | --- |
| `HANDOVER` | Operator presses the button with a redemption code present |
| `HARD` | Temperature above the hard limit |
| `BUDGET` | Cumulative time above the soft limit exhausted |
| `LID` | Hatch opened or closed |
| `FAULT` | Sensor or storage fault |
| `BOOT` | Device boot |

### Example

```text
zc1|H|LOT-0001|1|1793052000000|12|1832|1917|2210|0|-|a3f1...
zc1|E|LOT-0001|2|1793052060000|LID|1940|1|LID_OPEN|b70c...|-
zc1|E|LOT-0001|3|1793052120000|HANDOVER|1925|1|-|c91d...|RDM-0001
```

## Signing and chaining

Use the same scheme as the auditor attestations:

1. Build the record text exactly as above.
2. Hash it with SHA-256.
3. Sign the hash with an ECDSA P-256 private key stored in the device's
   protected NVS partition.
4. Encode the 64-byte `r‖s` signature as base64url (no padding).
5. Publish `record|signature` to the lot topic, or buffer it locally until WiFi
   returns.

The browser verifier can be extended to accept device public keys from a
provisioning record. Until then, vault-box records are supporting evidence, not
part of the token contract.

Do not reuse the auditor key on the device. Provision a separate device key and
publish its public key in a provisioning event or an operator allow-list.

## Storage profile

Illustrative defaults, replace with the producer's spec sheet:

| Parameter | Value |
| --- | --- |
| Safe range | 10–25 °C |
| Hard limit | > 30 °C |
| Soft-limit budget | 120 minutes cumulative above 25 °C |
| Demo budget | 15 seconds (for a visible warning on stage) |
| Heartbeat interval | 5 minutes (demo: 5 seconds) |

A breach never freezes money. It flips the lot health badge to **Warning** and
is logged; holders can still redeem.

## Fault filter

Discard a sample when:

- it is exactly `85.0 °C` or `-127 °C` (common sensor sentinel values);
- it jumps more than `5 °C` in 2 seconds;
- the CRC read fails.

Discarded samples never count toward the budget. A `FAULT` event is emitted
instead, with the raw value so the fault is auditable.

## Buffer and upload

- Store unsent records in LittleFS as newline-delimited text.
- Keep a monotonic sequence even across reboots; persist it in NVS.
- On reconnect, upload in sequence order and wait for the HCS receipt before
  deleting the local line.
- If the clock is not synced, buffer records with a boot counter and upload once
  NTP succeeds. Do not invent a `ts`.
- Never rewrite or reorder buffered records; a gap is visible to the verifier.

## Handover flow

1. The holder requests a redemption in the app; the treasury locks the tokens
   and issues a six-digit pickup code.
2. The operator enters the code on the box (or scans it) and presses the button.
3. The box emits `zc1|E|...|HANDOVER|...|RDM-0001`.
4. The operator confirms handover in the app with the same code. The backend
   burns the locked tokens and writes `HANDOVER` + `BURN` to the lot topic.
5. The box record is attached as supporting evidence. In the current demo it is
   not required for the burn.

## Acceptance tests

- Ice water reads within 1 °C of a reference thermometer.
- Three shared test vectors (record, SHA-256, P-256 signature) verify in
  firmware, Bun and the browser.
- A two-hour soak test shows no reboot and no sequence gap.
- After five minutes without WiFi, buffered records arrive in order.
- The unit runs four hours on the power bank.
- A sensor disconnect emits `FAULT` and does not count toward the budget.
- Pressing the button without a redemption code emits an event but does not
  trigger a handover.

## Status

| Item | State |
| --- | --- |
| Record format | Documented here |
| Backend ingest endpoint | Not implemented |
| Device key provisioning | Not implemented |
| Browser verification of device records | Not implemented |
| Stage fallback | App-based operator handover works today |
