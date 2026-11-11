const rawBase = import.meta.env.VITE_API_BASE ?? "";
const API_BASE = `${String(rawBase).replace(/\/$/, "")}/api/v1`;

export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.error?.message ?? `Request failed with ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = payload?.error?.code ?? "UNKNOWN";
    this.details = payload?.error?.details;
    this.requestId = payload?.error?.requestId;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, { method = "GET", body, signal, retries = 0 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        signal,
        headers: body ? { "content-type": "application/json", accept: "application/json" } : { accept: "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await response.text();
      const payload = text ? safeJson(text) : null;
      if (!response.ok) throw new ApiError(response.status, payload);
      return payload;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      if (error instanceof ApiError) throw error;
      lastError = error;
      if (attempt < retries) await sleep(400 * (attempt + 1));
    }
  }
  throw new Error(
    lastError?.message === "Failed to fetch"
      ? "Cannot reach the ZitounaDeFi API. Is the backend running on port 4000?"
      : (lastError?.message ?? "Network request failed"),
  );
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text.slice(0, 200) } };
  }
}

export const api = {
  base: API_BASE,

  health: () => request("/health", { retries: 2 }),
  lots: () => request("/lots"),
  lot: (id) => request(`/lots/${encodeURIComponent(id)}`),
  createLot: (body) => request("/lots", { method: "POST", body }),
  list: (id, body) => request(`/lots/${encodeURIComponent(id)}/list`, { method: "POST", body }),
  attest: (id, body) => request(`/lots/${encodeURIComponent(id)}/attest`, { method: "POST", body }),
  nextAttestation: (id) => request(`/lots/${encodeURIComponent(id)}/next-attestation`),
  buy: (id, body) => request(`/lots/${encodeURIComponent(id)}/buy`, { method: "POST", body }),
  transfer: (id, body) => request(`/lots/${encodeURIComponent(id)}/transfer`, { method: "POST", body }),
  agentCheck: (id) => request(`/lots/${encodeURIComponent(id)}/agent-check`, { method: "POST" }),

  accounts: () => request("/accounts"),
  balances: (ref) => request(`/accounts/${encodeURIComponent(ref)}/balances`),
  wallet: (ref) => request(`/wallets/${encodeURIComponent(ref)}`),

  redemptions: (accountId) =>
    request(`/redemptions${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`),
  redemption: (id) => request(`/redemptions/${encodeURIComponent(id)}`),
  requestRedemption: (body) => request("/redemptions", { method: "POST", body }),
  handover: (id, body) => request(`/redemptions/${encodeURIComponent(id)}/handover`, { method: "POST", body }),
  returnRedemption: (id, body) =>
    request(`/redemptions/${encodeURIComponent(id)}/return`, { method: "POST", body }),

  demoState: () => request("/demo/state"),
  seed: () => request("/demo/seed", { method: "POST" }),
  reset: () => request("/demo/reset", { method: "POST" }),
  underbacked: (body) => request("/demo/underbacked", { method: "POST", body }),
  stale: (seconds) => request("/demo/stale", { method: "POST", body: { seconds } }),
  clearStale: () => request("/demo/stale", { method: "DELETE" }),
  pause: (paused) => request("/demo/pause", { method: "POST", body: { paused } }),

  topicMessages: (topicId) => request(`/mirror/topics/${encodeURIComponent(topicId)}/messages`),
  tokenInfo: (tokenId) => request(`/mirror/tokens/${encodeURIComponent(tokenId)}`),
};

export function idempotencyKey(prefix = "ui") {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}
