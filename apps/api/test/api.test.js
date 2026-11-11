/**
 * API integration tests.
 *
 * Run with `bun run test:api` from the repo root. The suite runs against the
 * configured PostgreSQL database in stub ledger mode and resets the demo state
 * before and after it runs, so do not point it at data you care about.
 *
 * Set NODE_ENV=test and LEDGER_MODE=stub before importing the app so the
 * runtime configuration is deterministic even when a real .env is present.
 */
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.LEDGER_MODE = "stub";

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import request from "supertest";
import { verifyAttestationChain } from "@zitouna/rules";
import { createApp } from "../src/app.js";
import { resetDemo } from "../src/services/seed.js";
import { prisma } from "../src/lib/prisma.js";
import { ledger } from "../src/ledger/index.js";

const app = createApp();
const api = request(app);

const state = {
  buyerA: null,
  buyerB: null,
  buy: null,
  buyKey: null,
  transfer: null,
  redemption: null,
};

function expectError(response, status, code) {
  expect(response.status).toBe(status);
  expect(response.body.error?.code).toBe(code);
}

async function wallet(accountId) {
  const response = await api.get(`/api/v1/wallets/${accountId}`).expect(200);
  return response.body;
}

beforeAll(async () => {
  await resetDemo({ freshBuyers: true });
  const response = await api.get("/api/v1/accounts").expect(200);
  state.buyerA = response.body.accounts.find((account) => account.label === "Buyer A");
  state.buyerB = response.body.accounts.find((account) => account.label === "Buyer B");
  expect(state.buyerA?.role).toBe("BUYER");
  expect(state.buyerB?.role).toBe("BUYER");
});

afterAll(async () => {
  // Leave a clean, freshly seeded demo behind.
  await resetDemo({ freshBuyers: true });
  await prisma.$disconnect();
  await ledger().close?.();
});

describe("health and demo state", () => {
  test("reports stub mode and a reachable database", async () => {
    const response = await api.get("/api/v1/health").expect(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.mode).toBe("stub");
    expect(response.body.database).toBe("up");
  });

  test("resets to two funded buyers and two certified lots", async () => {
    const response = await api.get("/api/v1/demo/state").expect(200);
    expect(response.body.mode).toBe("stub");
    expect(response.body.lots.map((lot) => lot.id)).toEqual(["LOT-0001", "LOT-0002"]);
    const buyers = response.body.accounts.filter((account) => account.role === "BUYER");
    expect(buyers).toHaveLength(2);
    expect(buyers.map((buyer) => buyer.label).sort()).toEqual(["Buyer A", "Buyer B"]);
  });
});

describe("lot passport", () => {
  test("exposes the signed auditor trail and reserve evaluation", async () => {
    const response = await api.get("/api/v1/lots/LOT-0001").expect(200);
    const lot = response.body.lot;
    expect(lot.series).toBe("DGZ");
    expect(lot.litres.certified).toBe(10_000);
    expect(lot.litres.perToken).toBe(10);
    expect(lot.listing.active).toBe(true);
    expect(lot.status).toBe("BACKED");
    expect(lot.reserve.verdict).toBe("BACKED");
    expect(lot.attestations).toHaveLength(1);
    expect(lot.auditorPublicKey).toMatch(/^04[0-9a-f]+$/i);

    const genesis = lot.messages.find((message) => message.type === "GENESIS");
    expect(genesis).toBeTruthy();
    const chain = await verifyAttestationChain({
      genesisText: genesis.payload,
      attestations: lot.attestations.map(({ text, signature }) => ({ text, signature })),
      auditorPublicKeyHex: lot.auditorPublicKey,
    });
    expect(chain.errors).toEqual([]);
    expect(chain.valid).toHaveLength(1);
  });

  test("rejects an unknown lot", async () => {
    const response = await api.get("/api/v1/lots/LOT-9999");
    expectError(response, 404, "LOT_NOT_FOUND");
  });
});

describe("primary sale", () => {
  test("buys litres and mints series tokens", async () => {
    state.buyKey = `test-buy-${crypto.randomUUID()}`;
    const response = await api
      .post("/api/v1/lots/LOT-0001/buy")
      .send({ accountId: state.buyerA.id, litresMl: 12_500, idempotencyKey: state.buyKey })
      .expect(201);
    state.buy = response.body;
    expect(response.body.litres).toBe(12.5);
    expect(response.body.tokens).toBe(1.25);
    expect(response.body.amount).toBe(52.5);
    expect(response.body.hcsSeq).toBeGreaterThan(0);
    expect(response.body.swapTxId).toMatch(/^stub-/);

    const after = await wallet(state.buyerA.id);
    expect(after.balances.DGZ).toBe(1.25);
    expect(after.balances.tUSDT).toBe(24_947.5);
  });

  test("replays the same idempotency key without double-charging", async () => {
    const response = await api
      .post("/api/v1/lots/LOT-0001/buy")
      .send({ accountId: state.buyerA.id, litresMl: 12_500, idempotencyKey: state.buyKey })
      .expect(201);
    expect(response.body.tradeId).toBe(state.buy.tradeId);
    expect(response.body.hcsSeq).toBe(state.buy.hcsSeq);

    const after = await wallet(state.buyerA.id);
    expect(after.balances.DGZ).toBe(1.25);
    expect(after.balances.tUSDT).toBe(24_947.5);
  });

  test("rejects a reused key for a different operation", async () => {
    const response = await api
      .post("/api/v1/lots/LOT-0001/transfer")
      .send({
        fromId: state.buyerA.id,
        toId: state.buyerB.id,
        tokensCt: 10,
        idempotencyKey: state.buyKey,
      });
    expectError(response, 409, "IDEMPOTENCY_CONFLICT");
  });

  test("rejects purchases above the attested reserve", async () => {
    const response = await api
      .post("/api/v1/lots/LOT-0001/buy")
      .send({
        accountId: state.buyerB.id,
        litresMl: 10_000_000,
        idempotencyKey: `test-huge-${crypto.randomUUID()}`,
      });
    expect(response.status).toBe(409);
    expect(["LISTING_EXHAUSTED", "RESERVE_HEADROOM"]).toContain(response.body.error.code);
  });
});

describe("peer transfer", () => {
  test("moves tokens between demo accounts", async () => {
    const response = await api
      .post("/api/v1/lots/LOT-0001/transfer")
      .send({
        fromId: state.buyerA.id,
        toId: state.buyerB.id,
        tokensCt: 20,
        memo: "integration test",
        idempotencyKey: `test-transfer-${crypto.randomUUID()}`,
      })
      .expect(201);
    state.transfer = response.body;
    expect(response.body.tokens).toBe(0.2);
    expect(response.body.litres).toBe(2);
    expect(response.body.hcsSeq).toBeGreaterThan(0);

    expect((await wallet(state.buyerA.id)).balances.DGZ).toBe(1.05);
    expect((await wallet(state.buyerB.id)).balances.DGZ).toBe(0.2);
  });

  test("refuses to send more than the balance", async () => {
    const response = await api
      .post("/api/v1/lots/LOT-0001/transfer")
      .send({
        fromId: state.buyerB.id,
        toId: state.buyerA.id,
        tokensCt: 1_000,
        idempotencyKey: `test-overdraw-${crypto.randomUUID()}`,
      });
    expectError(response, 409, "INSUFFICIENT_TOKEN_BALANCE");
  });
});

describe("physical redemption", () => {
  test("enforces the minimum redemption size", async () => {
    const response = await api
      .post("/api/v1/redemptions")
      .send({
        lotId: "LOT-0001",
        holderId: state.buyerA.id,
        tokensCt: 10,
        idempotencyKey: `test-min-${crypto.randomUUID()}`,
      });
    expectError(response, 400, "BELOW_MINIMUM");
  });

  test("locks tokens and issues a pickup code", async () => {
    const response = await api
      .post("/api/v1/redemptions")
      .send({
        lotId: "LOT-0001",
        holderId: state.buyerA.id,
        tokensCt: 50,
        idempotencyKey: `test-redeem-${crypto.randomUUID()}`,
      })
      .expect(201);
    state.redemption = response.body.redemption;
    expect(response.body.redemption.status).toBe("REQUESTED");
    expect(response.body.redemption.tokens).toBe(0.5);
    expect(response.body.redemption.litres).toBe(5);
    expect(response.body.redemption.pickupCode).toMatch(/^\d{6}$/);
    expect((await wallet(state.buyerA.id)).balances.DGZ).toBe(0.55);
  });

  test("rejects the wrong pickup code", async () => {
    const wrong = state.redemption.pickupCode === "000000" ? "111111" : "000000";
    const response = await api
      .post(`/api/v1/redemptions/${state.redemption.id}/handover`)
      .send({ pickupCode: wrong });
    expectError(response, 409, "BAD_PICKUP_CODE");
  });

  test("hands over the oil and burns the claim", async () => {
    const response = await api
      .post(`/api/v1/redemptions/${state.redemption.id}/handover`)
      .send({ pickupCode: state.redemption.pickupCode, source: "WAREHOUSE" })
      .expect(200);
    expect(response.body.redemption.status).toBe("BURNED");
    expect(response.body.redemption.handoverSource).toBe("WAREHOUSE");
    expect(response.body.redemption.burnTxId).toMatch(/^stub-/);
    expect(response.body.redemption.burnSeq).toBeGreaterThan(0);

    const lot = (await api.get("/api/v1/lots/LOT-0001").expect(200)).body.lot;
    expect(lot.supply.circulating).toBe(0.75);
    expect(lot.litres.remaining).toBe(9_995);
    const types = lot.messages.map((message) => message.type);
    expect(types).toEqual(
      expect.arrayContaining(["SALE", "TRANSFER", "REDEMPTION", "HANDOVER", "BURN"]),
    );
  });

  test("keeps burned pickups closed", async () => {
    const response = await api
      .post(`/api/v1/redemptions/${state.redemption.id}/handover`)
      .send({ operatorOverride: true });
    expectError(response, 409, "INVALID_REDEMPTION_STATE");
  });
});

describe("reserve agent and fault injection", () => {
  test("re-runs the solvency check and reports BACKED", async () => {
    const response = await api.post("/api/v1/lots/LOT-0001/agent-check").expect(200);
    expect(response.body.verdict).toBe("BACKED");
    expect(response.body.ratioBps).toBe(10_000);
    expect(response.body.reasons).toEqual([]);
    expect(response.body.decisionSeq).toBeGreaterThan(0);
  });

  test("stale attestations pause sales", async () => {
    await api.post("/api/v1/demo/stale").send({ seconds: 1 }).expect(200);
    await new Promise((resolve) => setTimeout(resolve, 1_100));

    const verdict = await api.post("/api/v1/lots/LOT-0001/agent-check").expect(200);
    expect(verdict.body.verdict).toBe("STALE");
    expect(verdict.body.reasons).toContain("T1");

    const sale = await api.post("/api/v1/lots/LOT-0001/buy").send({
      accountId: state.buyerB.id,
      litresMl: 1_000,
      idempotencyKey: `test-stale-${crypto.randomUUID()}`,
    });
    expect(sale.status).toBe(409);
    expect(["LOT_NOT_OPEN", "RESERVE_STALE"]).toContain(sale.body.error.code);
  });

  test("restoring the freshness window unpauses sales", async () => {
    await api.delete("/api/v1/demo/stale").expect(200);
    const lot = (await api.get("/api/v1/lots/LOT-0001").expect(200)).body.lot;
    expect(lot.reserve.verdict).toBe("BACKED");
    expect(lot.lotStatus).toBe("ACTIVE");
  });

  test("an under-backed attestation flips the lot and blocks new sales", async () => {
    const injected = await api.post("/api/v1/demo/underbacked").send({ lotId: "LOT-0001" }).expect(200);
    expect(injected.body.verdict.verdict).toBe("UNDERBACKED");
    expect(["U1", "U2"].some((code) => injected.body.verdict.reasons.includes(code))).toBe(true);

    const lot = (await api.get("/api/v1/lots/LOT-0001").expect(200)).body.lot;
    expect(lot.lotStatus).toBe("PAUSED");
    const sale = await api.post("/api/v1/lots/LOT-0001/buy").send({
      accountId: state.buyerB.id,
      litresMl: 1_000,
      idempotencyKey: `test-underbacked-${crypto.randomUUID()}`,
    });
    expect(sale.status).toBe(409);
    expect(["LOT_NOT_OPEN", "RESERVE_UNDERBACKED"]).toContain(sale.body.error.code);
  });
});
