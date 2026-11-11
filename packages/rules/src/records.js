/**
 * zc1 record codec. The wire format is deliberately tiny and boring so the
 * firmware, backend, auditor CLI and browser can all parse it.
 *
 *   zc1|G|lotId|series|grade|litres|warehouse|auditorKey|producer|year
 *   zc1|A|lotId|seq|ts|litresRemaining|labHash|receiptHash|prev
 *   zc1|L|lotId|seq|ts|pricePerLitreCents|litresOffered|currency
 *   zc1|S|lotId|seq|ts|buyer|litresMl|tokensCt|amountCents
 *   zc1|T|lotId|seq|ts|from|to|tokensCt|memo
 *   zc1|R|lotId|seq|ts|rid|holder|tokensCt|litresMl
 *   zc1|H|lotId|seq|ts|rid|source|pickupHash
 *   zc1|B|lotId|seq|ts|rid|tokensCt
 *   zc1|V|lotId|seq|ts|verdict|ratioBps|supplyCt|attestedLitres|reasons
 */

export const RECORD_PREFIX = "zc1";

export const RECORD_TYPES = Object.freeze({
  GENESIS: "G",
  ATTESTATION: "A",
  LISTING: "L",
  SALE: "S",
  TRANSFER: "T",
  REDEMPTION: "R",
  HANDOVER: "H",
  BURN: "B",
  VERDICT: "V",
});

const TYPE_TO_NAME = Object.freeze(
  Object.fromEntries(Object.entries(RECORD_TYPES).map(([name, code]) => [code, name])),
);

function assertField(value, name) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${name} is required`);
  if (text.includes("|")) throw new Error(`${name} cannot contain "|"`);
  return text;
}

function assertInt(value, name, { min = 0 } = {}) {
  if (!Number.isInteger(value) || value < min) throw new Error(`${name} must be an integer >= ${min}`);
  return value;
}

function assertEnum(value, allowed, name) {
  if (!allowed.includes(value)) throw new Error(`${name} must be one of ${allowed.join(", ")}`);
  return value;
}

export function buildGenesis(input) {
  return [
    RECORD_PREFIX,
    RECORD_TYPES.GENESIS,
    assertField(input.lotId, "lotId"),
    assertEnum(input.series, ["DGZ", "TZT"], "series"),
    assertField(input.grade, "grade"),
    assertInt(input.litres, "litres", { min: 1 }),
    assertField(input.warehouse, "warehouse"),
    assertField(input.auditorPublicKeyHex, "auditorPublicKeyHex"),
    assertField(input.producerAccount, "producerAccount"),
    assertInt(input.harvestYear, "harvestYear", { min: 2000 }),
  ].join("|");
}

export function buildAttestation(input) {
  return [
    RECORD_PREFIX,
    RECORD_TYPES.ATTESTATION,
    assertField(input.lotId, "lotId"),
    assertInt(input.seq, "seq", { min: 1 }),
    assertInt(input.ts, "ts", { min: 1 }),
    assertInt(input.litresRemaining, "litresRemaining", { min: 0 }),
    assertField(input.labHash, "labHash"),
    assertField(input.receiptHash, "receiptHash"),
    assertField(input.prev, "prev"),
  ].join("|");
}

export function buildListing(input) {
  return [
    RECORD_PREFIX,
    RECORD_TYPES.LISTING,
    assertField(input.lotId, "lotId"),
    assertInt(input.seq, "seq", { min: 1 }),
    assertInt(input.ts, "ts", { min: 1 }),
    assertInt(input.pricePerLitreCents, "pricePerLitreCents", { min: 1 }),
    assertInt(input.litresOffered, "litresOffered", { min: 1 }),
    assertEnum(input.currency, ["tUSDT"], "currency"),
  ].join("|");
}

export function buildSale(input) {
  return [
    RECORD_PREFIX,
    RECORD_TYPES.SALE,
    assertField(input.lotId, "lotId"),
    assertInt(input.seq, "seq", { min: 1 }),
    assertInt(input.ts, "ts", { min: 1 }),
    assertField(input.buyer, "buyer"),
    assertInt(input.litresMl, "litresMl", { min: 1 }),
    assertInt(input.tokensCt, "tokensCt", { min: 1 }),
    assertInt(input.amountCents, "amountCents", { min: 0 }),
  ].join("|");
}

export function buildTransfer(input) {
  return [
    RECORD_PREFIX,
    RECORD_TYPES.TRANSFER,
    assertField(input.lotId, "lotId"),
    assertInt(input.seq, "seq", { min: 1 }),
    assertInt(input.ts, "ts", { min: 1 }),
    assertField(input.from, "from"),
    assertField(input.to, "to"),
    assertInt(input.tokensCt, "tokensCt", { min: 1 }),
    assertField(input.memo ?? "-", "memo"),
  ].join("|");
}

export function buildRedemption(input) {
  return [
    RECORD_PREFIX,
    RECORD_TYPES.REDEMPTION,
    assertField(input.lotId, "lotId"),
    assertInt(input.seq, "seq", { min: 1 }),
    assertInt(input.ts, "ts", { min: 1 }),
    assertField(input.rid, "rid"),
    assertField(input.holder, "holder"),
    assertInt(input.tokensCt, "tokensCt", { min: 1 }),
    assertInt(input.litresMl, "litresMl", { min: 1 }),
  ].join("|");
}

export function buildHandover(input) {
  return [
    RECORD_PREFIX,
    RECORD_TYPES.HANDOVER,
    assertField(input.lotId, "lotId"),
    assertInt(input.seq, "seq", { min: 1 }),
    assertInt(input.ts, "ts", { min: 1 }),
    assertField(input.rid, "rid"),
    assertField(input.source, "source"),
    assertField(input.pickupHash, "pickupHash"),
  ].join("|");
}

export function buildBurn(input) {
  return [
    RECORD_PREFIX,
    RECORD_TYPES.BURN,
    assertField(input.lotId, "lotId"),
    assertInt(input.seq, "seq", { min: 1 }),
    assertInt(input.ts, "ts", { min: 1 }),
    assertField(input.rid, "rid"),
    assertInt(input.tokensCt, "tokensCt", { min: 1 }),
  ].join("|");
}

export function buildVerdict(input) {
  const reasons = (input.reasons ?? []).map(String).filter(Boolean).join(",") || "-";
  return [
    RECORD_PREFIX,
    RECORD_TYPES.VERDICT,
    assertField(input.lotId, "lotId"),
    assertInt(input.seq, "seq", { min: 1 }),
    assertInt(input.ts, "ts", { min: 1 }),
    assertEnum(input.verdict, ["BACKED", "LOW_STOCK", "UNDERBACKED", "STALE", "INVALID"], "verdict"),
    assertInt(input.ratioBps, "ratioBps", { min: 0 }),
    assertInt(input.supplyCt, "supplyCt", { min: 0 }),
    assertInt(input.attestedLitres, "attestedLitres", { min: 0 }),
    reasons,
  ].join("|");
}

const NUMERIC_FIELDS = new Set([
  "seq",
  "ts",
  "litres",
  "harvestYear",
  "litresRemaining",
  "pricePerLitreCents",
  "litresOffered",
  "litresMl",
  "tokensCt",
  "amountCents",
  "ratioBps",
  "supplyCt",
  "attestedLitres",
]);

export function parseRecord(text) {
  if (typeof text !== "string") throw new Error("record must be a string");
  const parts = text.split("|");
  if (parts[0] !== RECORD_PREFIX) throw new Error("record must start with zc1");
  const type = parts[1];
  const name = TYPE_TO_NAME[type];
  if (!name) throw new Error(`Unknown record type: ${type}`);
  const body = parts.slice(2);

  const fields = {};
  const keys = FIELDS[name] ?? [];
  if (body.length !== keys.length) {
    throw new Error(`${name} record expects ${keys.length} fields, got ${body.length}`);
  }
  keys.forEach((key, index) => {
    const raw = body[index];
    fields[key] = NUMERIC_FIELDS.has(key) ? Number(raw) : raw;
  });
  if (name === "VERDICT") fields.reasons = fields.reasons === "-" ? [] : fields.reasons.split(",");
  return { type, name, text, fields };
}

const FIELDS = Object.freeze({
  GENESIS: ["lotId", "series", "grade", "litres", "warehouse", "auditorPublicKeyHex", "producerAccount", "harvestYear"],
  ATTESTATION: ["lotId", "seq", "ts", "litresRemaining", "labHash", "receiptHash", "prev"],
  LISTING: ["lotId", "seq", "ts", "pricePerLitreCents", "litresOffered", "currency"],
  SALE: ["lotId", "seq", "ts", "buyer", "litresMl", "tokensCt", "amountCents"],
  TRANSFER: ["lotId", "seq", "ts", "from", "to", "tokensCt", "memo"],
  REDEMPTION: ["lotId", "seq", "ts", "rid", "holder", "tokensCt", "litresMl"],
  HANDOVER: ["lotId", "seq", "ts", "rid", "source", "pickupHash"],
  BURN: ["lotId", "seq", "ts", "rid", "tokensCt"],
  VERDICT: ["lotId", "seq", "ts", "verdict", "ratioBps", "supplyCt", "attestedLitres", "reasons"],
});

export function isGenesis(text) {
  return typeof text === "string" && text.startsWith("zc1|G|");
}

export function isAttestation(text) {
  return typeof text === "string" && text.startsWith("zc1|A|");
}
