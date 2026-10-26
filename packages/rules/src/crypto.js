const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex) {
  if (typeof hex !== "string" || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
    throw new Error("Invalid hex string");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToBase64Url(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += BASE64URL[a >> 2];
    out += BASE64URL[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b === undefined) break;
    out += BASE64URL[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c === undefined) break;
    out += BASE64URL[c & 63];
  }
  return out;
}

export function base64UrlToBytes(value) {
  if (typeof value !== "string") throw new Error("Invalid base64url value");
  const clean = value.replace(/=+$/, "");
  if (/[^A-Za-z0-9\-_]/.test(clean)) throw new Error("Invalid base64url value");
  const out = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const index = BASE64URL.indexOf(char);
    if (index < 0) throw new Error("Invalid base64url character");
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

const subtle = () => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("WebCrypto is required (Node 20+, Bun, or a modern browser)");
  }
  return globalThis.crypto.subtle;
};

export async function sha256Hex(text) {
  const digest = await subtle().digest("SHA-256", new TextEncoder().encode(text));
  return bytesToHex(new Uint8Array(digest));
}

export function publicKeyHexFromRaw(raw) {
  return bytesToHex(raw);
}

export async function generateAuditorKeyPair() {
  const pair = await subtle().generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const privateJwk = await subtle().exportKey("jwk", pair.privateKey);
  const raw = new Uint8Array(await subtle().exportKey("raw", pair.publicKey));
  return { privateJwk, publicKeyHex: bytesToHex(raw) };
}

export async function importPublicKeyHex(publicKeyHex) {
  const raw = hexToBytes(publicKeyHex);
  if (raw.length !== 65 || raw[0] !== 4) {
    throw new Error("Auditor public key must be an uncompressed P-256 point (65 bytes, starting 04)");
  }
  return subtle().importKey("raw", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}

export async function importPrivateJwk(privateJwk) {
  return subtle().importKey(
    "jwk",
    { ...privateJwk, key_ops: ["sign"], ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/** ECDSA P-256 / SHA-256 over the record text; returns raw r||s base64url. */
export async function signRecord(text, privateJwk) {
  const key = await importPrivateJwk(privateJwk);
  const signature = await subtle().sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(text),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function verifyRecord(text, signature, publicKeyHex) {
  try {
    const key = await importPublicKeyHex(publicKeyHex);
    const sig = base64UrlToBytes(signature);
    if (sig.length !== 64) return false;
    return await subtle().verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      sig,
      new TextEncoder().encode(text),
    );
  } catch {
    return false;
  }
}
