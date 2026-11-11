import { describe, expect, test } from "bun:test";
import {
  buildAttestation,
  buildBurn,
  buildGenesis,
  buildHandover,
  buildListing,
  buildRedemption,
  buildSale,
  buildTransfer,
  buildVerdict,
  evaluateReserve,
  evaluateLotFromRecords,
  generateAuditorKeyPair,
  mlToTokensCt,
  parseRecord,
  priceCentsForMl,
  seriesConfig,
  sha256Hex,
  signRecord,
  tokensCtToMl,
  verifyAttestationChain,
  verifyRecord,
  VERDICTS,
} from "../src/index.js";

const genesisInput = {
  lotId: "LOT-0001",
  series: "DGZ",
  grade: "extra_virgin",
  litres: 10_000,
  warehouse: "Sousse Central Warehouse",
  auditorPublicKeyHex: "04" + "ab".repeat(64),
  producerAccount: "0.0.1001",
  harvestYear: 2026,
};

describe("token model", () => {
  test("DGZ: 1 token = 10 L, 2 decimals", () => {
    expect(seriesConfig("DGZ").litresPerToken).toBe(10);
    expect(mlToTokensCt("DGZ", 10_000)).toBe(100);
    expect(tokensCtToMl("DGZ", 100)).toBe(10_000);
    expect(mlToTokensCt("DGZ", 5_000)).toBe(50);
    expect(tokensCtToMl("DGZ", 1)).toBe(100);
  });

  test("TZT: 1 token = 1,000 L", () => {
    expect(mlToTokensCt("TZT", 1_000_000)).toBe(100);
    expect(tokensCtToMl("TZT", 1)).toBe(10_000);
    expect(tokensCtToMl("TZT", 50)).toBe(500_000);
  });

  test("fractional litres are representable", () => {
    expect(mlToTokensCt("DGZ", 12_500)).toBe(125);
    expect(tokensCtToMl("DGZ", 125)).toBe(12_500);
    expect(() => mlToTokensCt("DGZ", 50)).toThrow();
  });

  test("price is integer cents", () => {
    expect(priceCentsForMl(12_500, 420)).toBe(5_250);
    expect(priceCentsForMl(10_000, 420)).toBe(4_200);
    expect(priceCentsForMl(1_000_000, 420)).toBe(420_000);
  });
});

describe("records", () => {
  test("genesis round-trip", () => {
    const text = buildGenesis(genesisInput);
    expect(text).toBe(
      "zc1|G|LOT-0001|DGZ|extra_virgin|10000|Sousse Central Warehouse|" +
        "04" + "ab".repeat(64) + "|0.0.1001|2026",
    );
    const parsed = parseRecord(text);
    expect(parsed.name).toBe("GENESIS");
    expect(parsed.fields.litres).toBe(10_000);
    expect(parsed.fields.series).toBe("DGZ");
  });

  test("all platform records round-trip", () => {
    const records = [
      buildListing({ lotId: "LOT-0001", seq: 2, ts: 1, pricePerLitreCents: 420, litresOffered: 10_000, currency: "tUSDT" }),
      buildSale({ lotId: "LOT-0001", seq: 3, ts: 2, buyer: "0.0.1002", litresMl: 12_500, tokensCt: 125, amountCents: 5_250 }),
      buildTransfer({ lotId: "LOT-0001", seq: 4, ts: 3, from: "0.0.1002", to: "0.0.1003", tokensCt: 20, memo: "gift" }),
      buildRedemption({ lotId: "LOT-0001", seq: 5, ts: 4, rid: "RDM-1", holder: "0.0.1002", tokensCt: 50, litresMl: 5_000 }),
      buildHandover({ lotId: "LOT-0001", seq: 6, ts: 5, rid: "RDM-1", source: "VAULT_BOX", pickupHash: "abc" }),
      buildBurn({ lotId: "LOT-0001", seq: 7, ts: 6, rid: "RDM-1", tokensCt: 50 }),
      buildVerdict({ lotId: "LOT-0001", seq: 8, ts: 7, verdict: "BACKED", ratioBps: 10_000, supplyCt: 125, attestedLitres: 10_000, reasons: [] }),
    ];
    for (const text of records) {
      const parsed = parseRecord(text);
      expect(parsed.text).toBe(text);
    }
    expect(parseRecord(records[6]).fields.reasons).toEqual([]);
  });

  test("rejects pipe injection", () => {
    expect(() => buildGenesis({ ...genesisInput, warehouse: "bad|warehouse" })).toThrow();
  });
});

describe("crypto + chain", () => {
  test("signs and verifies a record; tampering fails", async () => {
    const { privateJwk, publicKeyHex } = await generateAuditorKeyPair();
    const text = buildGenesis(genesisInput);
    const signature = await signRecord(text, privateJwk);
    expect(await verifyRecord(text, signature, publicKeyHex)).toBe(true);
    expect(await verifyRecord(text + "x", signature, publicKeyHex)).toBe(false);
    expect(await verifyRecord(text, signature, "04" + "cd".repeat(64))).toBe(false);
  });

  test("verifies a genesis + attestation chain and detects edits", async () => {
    const { privateJwk, publicKeyHex } = await generateAuditorKeyPair();
    const genesisText = buildGenesis({ ...genesisInput, auditorPublicKeyHex: publicKeyHex });
    const ts = Date.now();
    const a1 = buildAttestation({
      lotId: "LOT-0001",
      seq: 1,
      ts,
      litresRemaining: 10_000,
      labHash: "lab-1",
      receiptHash: "receipt-1",
      prev: await sha256Hex(genesisText),
    });
    const s1 = await signRecord(a1, privateJwk);
    const a2 = buildAttestation({
      lotId: "LOT-0001",
      seq: 2,
      ts: ts + 1,
      litresRemaining: 9_980,
      labHash: "lab-1",
      receiptHash: "receipt-1",
      prev: await sha256Hex(a1),
    });
    const s2 = await signRecord(a2, privateJwk);

    const good = await verifyAttestationChain({
      genesisText,
      attestations: [
        { text: a1, signature: s1 },
        { text: a2, signature: s2 },
      ],
      auditorPublicKeyHex: publicKeyHex,
    });
    expect(good.errors).toEqual([]);
    expect(good.valid).toHaveLength(2);

    const bad = await verifyAttestationChain({
      genesisText,
      attestations: [
        { text: a1, signature: s1 },
        { text: a2.replace("9980", "9900"), signature: s2 },
      ],
      auditorPublicKeyHex: publicKeyHex,
    });
    expect(bad.errors.some((error) => error.code === "I1")).toBe(true);

    const gap = await verifyAttestationChain({
      genesisText,
      attestations: [{ text: a2, signature: s2 }],
      auditorPublicKeyHex: publicKeyHex,
    });
    expect(gap.errors.some((error) => error.code === "I2")).toBe(true);
  });
});

describe("reserve rules", () => {
  const base = {
    certifiedLitres: 10_000,
    attestedLitres: 10_000,
    supplyLitres: 100,
    latestAttestationTs: Date.now() - 1_000,
    now: Date.now(),
    staleMs: 60_000,
  };

  test("BACKED when cover is full", () => {
    const result = evaluateReserve(base);
    expect(result.verdict).toBe(VERDICTS.BACKED);
    expect(result.ratioBps).toBe(10_000);
    expect(result.allowsMint).toBe(true);
  });

  test("LOW_STOCK under 10% of certified litres", () => {
    const result = evaluateReserve({ ...base, attestedLitres: 900 });
    expect(result.verdict).toBe(VERDICTS.LOW_STOCK);
    expect(result.reasons).toContain("S1");
  });

  test("UNDERBACKED when supply exceeds attestation", () => {
    const result = evaluateReserve({ ...base, attestedLitres: 50, supplyLitres: 100 });
    expect(result.verdict).toBe(VERDICTS.UNDERBACKED);
    expect(result.allowsMint).toBe(false);
  });

  test("STALE outside the freshness window", () => {
    const result = evaluateReserve({ ...base, latestAttestationTs: Date.now() - 120_000 });
    expect(result.verdict).toBe(VERDICTS.STALE);
    expect(result.allowsSales).toBe(false);
    expect(result.allowsRedemptions).toBe(true);
  });

  test("INVALID on a broken chain", () => {
    const result = evaluateReserve({ ...base, chainErrors: [{ code: "I2", message: "gap" }] });
    expect(result.verdict).toBe(VERDICTS.INVALID);
    expect(result.allowsRedemptions).toBe(false);
  });

  test("full evaluation from records", async () => {
    const { privateJwk, publicKeyHex } = await generateAuditorKeyPair();
    const genesisText = buildGenesis({ ...genesisInput, auditorPublicKeyHex: publicKeyHex });
    const ts = Date.now();
    const attestation = buildAttestation({
      lotId: "LOT-0001",
      seq: 1,
      ts,
      litresRemaining: 10_000,
      labHash: "lab",
      receiptHash: "receipt",
      prev: await sha256Hex(genesisText),
    });
    const signature = await signRecord(attestation, privateJwk);
    const result = await evaluateLotFromRecords({
      genesisText,
      attestations: [{ text: attestation, signature }],
      auditorPublicKeyHex: publicKeyHex,
      series: "DGZ",
      supplyCt: 125,
      now: ts + 1_000,
      staleMs: 60_000,
    });
    expect(result.verdict).toBe(VERDICTS.BACKED);
    expect(result.supplyLitres).toBe(12.5);
    expect(result.certifiedLitres).toBe(10_000);
  });
});
