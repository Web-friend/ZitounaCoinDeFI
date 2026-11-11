import { verifyAttestationChain } from "@zitouna/rules";

/**
 * Browser-side verification of a lot's HCS audit trail.
 *
 * The public passport must be checkable without trusting the API's verdict, so
 * this re-parses the raw `zc1` records and re-verifies every P-256 signature
 * and the SHA-256 hash chain in the browser.
 */
export async function verifyLotChain(lot) {
  const messages = Array.isArray(lot?.messages) ? lot.messages : [];
  const genesis = messages.find((message) => message.type === "GENESIS");
  if (!genesis) {
    return {
      status: "error",
      ok: false,
      errors: [{ code: "I0", message: "No genesis message found on the lot topic." }],
      attestationCount: 0,
    };
  }

  const attestations = (lot.attestations ?? []).map((attestation) => ({
    text: attestation.text,
    signature: attestation.signature,
  }));

  try {
    const result = await verifyAttestationChain({
      genesisText: genesis.payload,
      attestations,
      auditorPublicKeyHex: lot.auditorPublicKey ?? undefined,
    });
    const validAttestations = result.valid.length;
    const ok = result.errors.length === 0;
    return {
      status: ok ? "valid" : "invalid",
      ok,
      errors: result.errors,
      attestationCount: validAttestations,
      genesis: result.genesis,
      lastSeq: result.valid.at(-1)?.parsed?.fields?.seq ?? null,
      lastLitres: result.valid.at(-1)?.parsed?.fields?.litresRemaining ?? null,
      lastTs: result.valid.at(-1)?.parsed?.fields?.ts ?? null,
    };
  } catch (error) {
    return {
      status: "error",
      ok: false,
      errors: [{ code: "I0", message: error.message }],
      attestationCount: 0,
    };
  }
}
