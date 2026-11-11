import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../../..");

dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env.local"), override: true });

function int(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value, fallback = false) {
  if (value == null) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

const mode = (process.env.LEDGER_MODE ?? "stub").toLowerCase();

export const config = {
  repoRoot,
  env: process.env.NODE_ENV ?? "development",
  port: int(process.env.PORT, 4000),
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:5173",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  ledgerMode: mode === "hedera" ? "hedera" : "stub",
  databaseUrl: process.env.DATABASE_URL,
  hedera: {
    network: process.env.HEDERA_NETWORK ?? "testnet",
    operatorId: process.env.HEDERA_OPERATOR_ID ?? "",
    operatorKey: process.env.HEDERA_OPERATOR_KEY ?? "",
    operatorPublicKey: process.env.HEDERA_OPERATOR_PUBLIC_KEY ?? "",
    treasuryAccountId: process.env.TREASURY_ACCOUNT_ID ?? "",
    agentTopicId: process.env.AGENT_TOPIC_ID ?? "",
    tokens: {
      tUSDT: process.env.TUSDT_TOKEN_ID ?? "",
      DGZ: process.env.DGZ_TOKEN_ID ?? "",
      TZT: process.env.TZT_TOKEN_ID ?? "",
      LOT_NFT: process.env.LOT_NFT_TOKEN_ID ?? "",
    },
  },
  mirrorBase: (process.env.MIRROR_BASE ?? "https://testnet.mirrornode.hedera.com/api/v1").replace(/\/$/, ""),
  hashscanBase: (process.env.HASHSCAN_BASE ?? "https://hashscan.io/testnet").replace(/\/$/, ""),
  policy: {
    attestationStaleSeconds: int(process.env.ATTESTATION_STALE_SECONDS, 2_592_000),
    demoStaleSeconds: int(process.env.DEMO_STALE_SECONDS, 60),
    pauseAgent: bool(process.env.PAUSE_AGENT, false),
    tndPerUsdCents: int(process.env.TND_PER_USD_CENTS, 310),
    redemptionDeadlineSeconds: int(process.env.REDEMPTION_DEADLINE_SECONDS, 604_800),
    lowStockBps: int(process.env.LOW_STOCK_BPS, 1_000),
  },
  keys: {
    auditorPrivatePath: path.resolve(repoRoot, process.env.AUDITOR_PRIVATE_KEY_PATH ?? "keys/auditor-private.jwk.json"),
    accountsPath: path.resolve(repoRoot, process.env.ACCOUNTS_KEY_PATH ?? "keys/hedera-accounts.json"),
  },
};

export function isHedera() {
  return config.ledgerMode === "hedera";
}

export function hashscanTopic(topicId) {
  return `${config.hashscanBase}/topic/${topicId}`;
}

export function hashscanToken(tokenId) {
  return `${config.hashscanBase}/token/${tokenId}`;
}

export function hashscanTx(txId) {
  return `${config.hashscanBase}/transaction/${txId}`;
}
