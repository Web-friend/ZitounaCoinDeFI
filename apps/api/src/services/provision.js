import fs from "node:fs";
import { config, isHedera } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { ledger } from "../ledger/index.js";
import { setEnvLocal, writePrivateJson } from "../lib/env-file.js";
import { ensureAuditor } from "./auditor.js";

const env = (key, fallback = "") => process.env[key] || fallback;

function loadSecrets() {
  try {
    return JSON.parse(fs.readFileSync(config.keys.accountsPath, "utf8"));
  } catch {
    return {};
  }
}

function saveSecret(key, value) {
  if (!value) return;
  const secrets = loadSecrets();
  secrets[key] = value;
  writePrivateJson(config.keys.accountsPath, secrets);
  setEnvLocal(key, value);
}

async function ensureAccount({ role, label, keyEnvVar, hederaAccountId = "" }) {
  const knownId =
    hederaAccountId || (isHedera() && keyEnvVar ? env(keyEnvVar.replace(/_KEY$/, "_ACCOUNT_ID")) : "");
  let account = await prisma.account.findFirst({ where: { role, label } });
  if (account && isHedera() && knownId && account.hederaAccountId !== knownId) {
    account = await prisma.account.update({
      where: { id: account.id },
      data: { hederaAccountId: knownId },
    });
  }
  if (account) return account;

  let accountId = knownId;
  let publicKey = null;
  if (!accountId) {
    const created = await ledger().createAccount({ label });
    accountId = created.hederaAccountId;
    publicKey = created.publicKey;
    if (created.privateKeyDer && keyEnvVar && isHedera()) saveSecret(keyEnvVar, created.privateKeyDer);
    if (keyEnvVar && isHedera()) setEnvLocal(keyEnvVar.replace(/_KEY$/, "_ACCOUNT_ID"), accountId);
  }

  account = await prisma.account.create({
    data: {
      role,
      label,
      hederaAccountId: accountId,
      keyEnvVar: keyEnvVar || null,
      publicKey,
    },
  });
  return account;
}

async function demoBuyer({ label, envPrefix, fallbackId }) {
  // Buyers are replaced by demo reset, so an existing row (with its generation
  // scoped key) always wins over the fixed bootstrap IDs.
  const existing = await prisma.account.findFirst({ where: { role: "BUYER", label } });
  if (existing) return existing;
  const keyEnvVar = `${envPrefix}_KEY`;
  return ensureAccount({
    role: "BUYER",
    label,
    keyEnvVar,
    hederaAccountId: isHedera() ? env(`${envPrefix}_ACCOUNT_ID`) : fallbackId,
  });
}

async function ensureToken({ kind, series = null, name, symbol, maxSupply, treasuryAccountId }) {
  const existing = await prisma.token.findFirst({ where: { symbol } });
  if (existing) return existing;

  const envId = isHedera()
    ? symbol === "tUSDT"
      ? env("TUSDT_TOKEN_ID")
      : symbol === "DGZ"
        ? env("DGZ_TOKEN_ID")
        : symbol === "TZT"
          ? env("TZT_TOKEN_ID")
          : symbol === "ZLOT"
            ? env("LOT_NFT_TOKEN_ID")
            : ""
    : "";

  if (envId) {
    return prisma.token.create({
      data: { kind, series: series ?? undefined, name, symbol, tokenId: envId, decimals: kind === "NFT" ? 0 : 2, maxSupply, treasuryAccountId },
    });
  }

  const token =
    kind === "NFT"
      ? await ledger().createNftCollection({ name, symbol, maxSupply, treasuryAccountId })
      : await ledger().createFungibleToken({ series, name, symbol, maxSupply, treasuryAccountId });

  const envName =
    symbol === "tUSDT"
      ? "TUSDT_TOKEN_ID"
      : symbol === "DGZ"
        ? "DGZ_TOKEN_ID"
        : symbol === "TZT"
          ? "TZT_TOKEN_ID"
          : symbol === "ZLOT"
            ? "LOT_NFT_TOKEN_ID"
            : null;
  if (envName && isHedera()) setEnvLocal(envName, token.tokenId);
  return token;
}

async function associateAll(account, tokens) {
  for (const token of tokens) {
    if (token.kind !== "FUNGIBLE") continue;
    if (token.treasuryAccountId === account.hederaAccountId) continue;
    try {
      await ledger().associateToken(account.id, token.tokenId);
    } catch (error) {
      const message = String(error?.message ?? "");
      if (!message.includes("TOKEN_ALREADY_ASSOCIATED") && !message.includes("already associated")) throw error;
    }
  }
}

async function ensureAgentTopic() {
  const existing = isHedera() ? env("AGENT_TOPIC_ID") : "";
  if (existing) return existing;
  const setting = await prisma.systemSetting.findUnique({ where: { key: "agentTopicId" } });
  if (setting?.value) {
    if (isHedera()) setEnvLocal("AGENT_TOPIC_ID", setting.value);
    return setting.value;
  }
  const topic = await ledger().createTopic("ZitounaDeFi reserve agent audit trail");
  await prisma.systemSetting.upsert({
    where: { key: "agentTopicId" },
    create: { key: "agentTopicId", value: topic.topicId },
    update: { value: topic.topicId },
  });
  if (isHedera()) setEnvLocal("AGENT_TOPIC_ID", topic.topicId);
  return topic.topicId;
}

export async function provision() {
  if (isHedera() && (!config.hedera.operatorId || !config.hedera.operatorKey)) {
    throw new Error(
      "Hedera mode needs HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY in .env. " +
        "Create a testnet account at https://portal.hedera.com/ and fund it from the faucet.",
    );
  }

  const operatorId = isHedera() ? config.hedera.operatorId : "0.0.100000";
  const operator = await ensureAccount({
    role: "OPERATOR",
    label: "Operator",
    keyEnvVar: null,
    hederaAccountId: operatorId,
  });

  const treasury = await ensureAccount({
    role: "TREASURY",
    label: "Treasury",
    keyEnvVar: "TREASURY_KEY",
    hederaAccountId: isHedera() ? env("TREASURY_ACCOUNT_ID") : "0.0.100001",
  });
  const producer = await ensureAccount({
    role: "PRODUCER",
    label: "Producer",
    keyEnvVar: "PRODUCER_KEY",
    hederaAccountId: isHedera() ? env("PRODUCER_ACCOUNT_ID") : "0.0.100002",
  });
  const buyerA = await demoBuyer({ label: "Buyer A", envPrefix: "BUYER_A", fallbackId: "0.0.100003" });
  const buyerB = await demoBuyer({ label: "Buyer B", envPrefix: "BUYER_B", fallbackId: "0.0.100004" });

  const auditor = await ensureAuditor();

  const tUSDT = await ensureToken({
    kind: "FUNGIBLE",
    name: "Test USD Tether",
    symbol: "tUSDT",
    maxSupply: 500_000_000,
    treasuryAccountId: treasury.hederaAccountId,
  });
  const dgz = await ensureToken({
    kind: "FUNGIBLE",
    series: "DGZ",
    name: "DigaZitoun",
    symbol: "DGZ",
    maxSupply: 100_000,
    treasuryAccountId: treasury.hederaAccountId,
  });
  const tzt = await ensureToken({
    kind: "FUNGIBLE",
    series: "TZT",
    name: "TornataZite",
    symbol: "TZT",
    maxSupply: 100_000,
    treasuryAccountId: treasury.hederaAccountId,
  });
  const lotNft = await ensureToken({
    kind: "NFT",
    name: "ZitounaDeFi Lot Passport",
    symbol: "ZLOT",
    maxSupply: 10_000,
    treasuryAccountId: treasury.hederaAccountId,
  });

  const accounts = [treasury, producer, buyerA, buyerB];
  for (const account of accounts) await associateAll(account, [tUSDT, dgz, tzt]);
  await associateAll(operator, [tUSDT, dgz, tzt]);

  const agentTopicId = await ensureAgentTopic();

  return {
    operator,
    treasury,
    producer,
    buyerA,
    buyerB,
    auditor,
    tokens: { tUSDT, dgz, tzt, lotNft },
    agentTopicId,
    mode: config.ledgerMode,
  };
}

export async function createFreshBuyer({ label, keyEnvVar }) {
  const buyer = await ensureAccount({
    role: "BUYER",
    label,
    keyEnvVar,
    hederaAccountId: isHedera() ? env(keyEnvVar.replace(/_KEY$/, "_ACCOUNT_ID")) : "",
  });
  const tokens = await prisma.token.findMany({ where: { kind: "FUNGIBLE" } });
  await associateAll(buyer, tokens);
  return buyer;
}

export async function fundWithTusdt(account, amountCents) {
  const token = await prisma.token.findFirst({ where: { symbol: "tUSDT" } });
  if (!token) throw new Error("tUSDT token not provisioned");
  const treasury = await prisma.account.findFirst({ where: { role: "TREASURY" } });
  if (!treasury) throw new Error("Treasury account not provisioned");
  await ledger().mintFungible(token.tokenId, amountCents);
  await ledger().transferTokens(
    [{ tokenId: token.tokenId, fromAccountId: treasury.id, toAccountId: account.id, amountCt: amountCents }],
    `ZitounaDeFi demo funds for ${account.label}`,
  );
  return account;
}
