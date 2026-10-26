import fs from "node:fs";
import { config } from "../config.js";
import { setEnvLocal, writePrivateJson } from "../lib/env-file.js";
import { buildAttestation, generateAuditorKeyPair, signRecord } from "@zitouna/rules";

/**
 * The auditor is a P-256 key, not a Hedera account. Its private JWK stays in
 * keys/ (gitignored); the public key is the trust anchor written into the lot
 * genesis message.
 */
export async function ensureAuditor() {
  if (fs.existsSync(config.keys.auditorPrivatePath)) {
    const stored = JSON.parse(fs.readFileSync(config.keys.auditorPrivatePath, "utf8"));
    if (stored.privateJwk && stored.publicKeyHex) {
      process.env.AUDITOR_PUBLIC_KEY = stored.publicKeyHex;
      return stored;
    }
  }
  const { privateJwk, publicKeyHex } = await generateAuditorKeyPair();
  const stored = { createdAt: new Date().toISOString(), publicKeyHex, privateJwk };
  writePrivateJson(config.keys.auditorPrivatePath, stored);
  setEnvLocal("AUDITOR_PUBLIC_KEY", publicKeyHex);
  return stored;
}

export function loadAuditor() {
  if (!fs.existsSync(config.keys.auditorPrivatePath)) {
    throw new Error("Auditor key missing. Run `bun run seed` or `bun run setup:hedera` first.");
  }
  return JSON.parse(fs.readFileSync(config.keys.auditorPrivatePath, "utf8"));
}

export async function signAttestation({ lot, seq, litresRemaining, labHash, receiptHash, prev, ts = Date.now() }) {
  const auditor = loadAuditor();
  const text = buildAttestation({
    lotId: lot.code,
    seq,
    ts,
    litresRemaining,
    labHash,
    receiptHash,
    prev,
  });
  const signature = await signRecord(text, auditor.privateJwk);
  return { text, signature, publicKeyHex: auditor.publicKeyHex, ts };
}
