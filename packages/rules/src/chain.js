import { parseRecord } from "./records.js";
import { sha256Hex, verifyRecord } from "./crypto.js";

/**
 * Verify a genesis + attestation stream.
 *
 * Trust anchor: the auditor public key inside the genesis HCS message. The
 * genesis message itself is written with the topic submit key; the audit trail
 * proves the *stock attestations*, not the genesis. That limit is stated in the
 * UI and the docs.
 */
export async function verifyAttestationChain({ genesisText, attestations, auditorPublicKeyHex }) {
  const errors = [];
  const valid = [];
  let genesis;

  try {
    genesis = parseRecord(genesisText);
    if (genesis.name !== "GENESIS") throw new Error("first record is not GENESIS");
  } catch (error) {
    return { valid, errors: [{ code: "I0", message: `Genesis unreadable: ${error.message}` }], genesis: null };
  }

  if (auditorPublicKeyHex && genesis.fields.auditorPublicKeyHex !== auditorPublicKeyHex) {
    errors.push({ code: "I1", message: "Genesis auditor key does not match the expected key" });
  }

  const key = auditorPublicKeyHex || genesis.fields.auditorPublicKeyHex;
  let expectedPrev = await sha256Hex(genesisText);
  let expectedSeq = 1;

  const ordered = [...attestations].sort((a, b) => {
    const seqA = safeSeq(a.text);
    const seqB = safeSeq(b.text);
    return seqA - seqB;
  });

  for (const item of ordered) {
    let parsed;
    try {
      parsed = parseRecord(item.text);
      if (parsed.name !== "ATTESTATION") throw new Error("not an attestation");
    } catch (error) {
      errors.push({ code: "I0", message: `Attestation unreadable: ${error.message}` });
      continue;
    }
    const f = parsed.fields;
    if (f.lotId !== genesis.fields.lotId) {
      errors.push({ code: "I2", message: `Attestation ${f.seq} belongs to lot ${f.lotId}` });
      continue;
    }
    if (f.seq !== expectedSeq) {
      errors.push({ code: "I2", message: `Sequence gap: expected ${expectedSeq}, got ${f.seq}` });
      continue;
    }
    if (f.prev !== expectedPrev) {
      errors.push({ code: "I2", message: `Broken chain at attestation ${f.seq}` });
      continue;
    }
    const signatureOk = await verifyRecord(item.text, item.signature, key);
    if (!signatureOk) {
      errors.push({ code: "I1", message: `Bad signature at attestation ${f.seq}` });
      continue;
    }
    const hash = await sha256Hex(item.text);
    valid.push({ ...item, parsed, hash });
    expectedPrev = hash;
    expectedSeq += 1;
  }

  return { valid, errors, genesis };
}

function safeSeq(text) {
  try {
    return parseRecord(text).fields.seq ?? 0;
  } catch {
    return 0;
  }
}
