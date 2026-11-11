import {
  AccountBalanceQuery,
  AccountCreateTransaction,
  AccountId,
  Client,
  Hbar,
  Long,
  PrivateKey,
  TokenAssociateTransaction,
  TokenBurnTransaction,
  TokenCreateTransaction,
  TokenId,
  TokenInfoQuery,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  TokenUpdateNftsTransaction,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TransferTransaction,
} from "@hiero-ledger/sdk";
import { sha256Hex } from "@zitouna/rules";
import { config, isHedera } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { AppError, notFound } from "../lib/errors.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parsePrivateKey(value, label) {
  if (!value) throw new AppError(500, "HEDERA_KEY_MISSING", `${label} private key is not configured`);
  try {
    return PrivateKey.fromStringDer(value);
  } catch {
    try {
      return PrivateKey.fromString(value);
    } catch {
      throw new AppError(500, "HEDERA_KEY_INVALID", `${label} private key could not be parsed`);
    }
  }
}

function txIdString(response) {
  return response.transactionId?.toString?.() ?? String(response.transactionId ?? "unknown");
}

export class HederaLedger {
  mode = "hedera";

  constructor() {
    if (!isHedera()) throw new Error("HederaLedger constructed in stub mode");
    if (!config.hedera.operatorId || !config.hedera.operatorKey) {
      throw new AppError(
        500,
        "HEDERA_NOT_CONFIGURED",
        "LEDGER_MODE=hedera requires HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY in .env",
      );
    }
    this.client =
      config.hedera.network === "mainnet" ? Client.forMainnet() : Client.forTestnet();
    this.operatorKey = parsePrivateKey(config.hedera.operatorKey, "Operator");
    this.client.setOperator(AccountId.fromString(config.hedera.operatorId), this.operatorKey);
    this.client.setDefaultMaxTransactionFee(new Hbar(20));
    this.client.setDefaultMaxQueryPayment(new Hbar(5));
  }

  operatorAccountId() {
    return AccountId.fromString(config.hedera.operatorId);
  }

  accountKey(account) {
    if (!account) throw notFound("Account not found", "ACCOUNT_NOT_FOUND");
    if (account.hederaAccountId === config.hedera.operatorId) return this.operatorKey;
    const envName = account.keyEnvVar;
    const value = envName ? process.env[envName] : null;
    if (!value) {
      throw new AppError(
        500,
        "HEDERA_KEY_MISSING",
        `No private key found for ${account.label}. Run bun run setup:hedera or set ${envName ?? "the key"} in .env.`,
      );
    }
    return parsePrivateKey(value, account.label);
  }

  async signAndExecute(transaction, { keys = [], signers = [] } = {}) {
    const all = [this.operatorKey, ...keys, ...signers].filter(Boolean);
    const seen = new Set();
    const frozen = await transaction.freezeWith(this.client);
    for (const key of all) {
      const fingerprint = key.toStringDer();
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      frozen.sign(key);
    }
    try {
      return await frozen.execute(this.client);
    } catch (error) {
      throw new AppError(502, "HEDERA_TRANSACTION_FAILED", error.message ?? "Hedera transaction failed");
    }
  }

  async createAccount({ label, initialBalanceHbar = 20 }) {
    const key = PrivateKey.generateED25519();
    const response = await this.signAndExecute(
      new AccountCreateTransaction()
        .setKeyWithoutAlias(key.publicKey)
        .setInitialBalance(new Hbar(initialBalanceHbar))
        .setMaxAutomaticTokenAssociations(20),
    );
    const receipt = await response.getReceipt(this.client);
    if (!receipt.accountId) throw new AppError(502, "HEDERA_ACCOUNT_CREATE_FAILED", "No account ID returned");
    return {
      hederaAccountId: receipt.accountId.toString(),
      privateKeyDer: key.toStringDer(),
      publicKey: key.publicKey.toStringRaw(),
      label,
      hbar: initialBalanceHbar,
      txId: txIdString(response),
    };
  }

  async createTopic(memo) {
    const response = await this.signAndExecute(
      new TopicCreateTransaction().setTopicMemo(memo).setSubmitKey(this.operatorKey.publicKey),
    );
    const receipt = await response.getReceipt(this.client);
    if (!receipt.topicId) throw new AppError(502, "HEDERA_TOPIC_CREATE_FAILED", "No topic ID returned");
    return { topicId: receipt.topicId.toString(), memo, txId: txIdString(response) };
  }

  async submitMessage(topicId, text, type, lotId = null) {
    const response = await this.signAndExecute(
      new TopicMessageSubmitTransaction().setTopicId(TopicId.fromString(topicId)).setMessage(text),
    );
    const receipt = await response.getReceipt(this.client);
    if (!receipt.status || !receipt.status.toString().includes("SUCCESS")) {
      throw new AppError(502, "HEDERA_MESSAGE_FAILED", "HCS message was not accepted");
    }
    const txId = txIdString(response);
    const found = await this.waitForMirrorMessage(topicId, text, txId);
    const consensusTs = found ? this.mirrorTimestampToDate(found.consensus_timestamp) : new Date();
    const seq = found
      ? Number(found.sequence_number)
      : ((
          await prisma.ledgerMessage.aggregate({ where: { topicId }, _max: { seq: true } })
        )._max.seq ?? 0) + 1;
    const hash = await sha256Hex(text);
    await prisma.ledgerMessage.upsert({
      where: { topicId_seq: { topicId, seq } },
      create: { topicId, seq, type, lotId, payload: text, hash, consensusTs },
      update: { payload: text, hash, type, lotId },
    });
    return {
      seq,
      hash,
      consensusTs,
      consensusTimestamp: found?.consensus_timestamp ?? this.dateToMirrorTimestamp(consensusTs),
      txId,
      mirrored: Boolean(found),
    };
  }

  async waitForMirrorMessage(topicId, text, txId) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        const data = await this.mirrorGet(`/topics/${topicId}/messages?limit=5&order=desc`);
        const match = (data.messages ?? []).find(
          (message) => Buffer.from(message.message, "base64").toString("utf8") === text,
        );
        if (match) return match;
      } catch {
        // mirror lag or transient outage; keep trying
      }
      await sleep(600);
    }
    return null;
  }

  async createFungibleToken({ series = null, name, symbol, maxSupply, decimals = 2, treasuryAccountId }) {
    const existing = await prisma.token.findFirst({ where: { symbol } });
    if (existing) return existing;
    const treasury = await prisma.account.findUnique({ where: { hederaAccountId: treasuryAccountId } });
    if (!treasury) throw notFound("Treasury account not found", "TREASURY_NOT_FOUND");
    const treasuryKey = this.accountKey(treasury);
    const response = await this.signAndExecute(
      new TokenCreateTransaction()
        .setTokenName(name)
        .setTokenSymbol(symbol)
        .setDecimals(decimals)
        .setInitialSupply(0)
        .setMaxSupply(maxSupply)
        .setSupplyType(TokenSupplyType.Finite)
        .setTreasuryAccountId(AccountId.fromString(treasuryAccountId))
        .setSupplyKey(this.operatorKey.publicKey)
        .setAdminKey(this.operatorKey.publicKey)
        .setTokenMemo(`ZitounaDeFi ${symbol}`),
      { keys: [treasuryKey] },
    );
    const receipt = await response.getReceipt(this.client);
    if (!receipt.tokenId) throw new AppError(502, "HEDERA_TOKEN_CREATE_FAILED", "No token ID returned");
    return prisma.token.create({
      data: {
        kind: "FUNGIBLE",
        series: series ?? undefined,
        name,
        symbol,
        tokenId: receipt.tokenId.toString(),
        decimals,
        maxSupply,
        treasuryAccountId,
      },
    });
  }

  async createNftCollection({ name, symbol, maxSupply = 10_000, treasuryAccountId }) {
    const existing = await prisma.token.findFirst({ where: { symbol } });
    if (existing) return existing;
    const treasury = await prisma.account.findUnique({ where: { hederaAccountId: treasuryAccountId } });
    if (!treasury) throw notFound("Treasury account not found", "TREASURY_NOT_FOUND");
    const response = await this.signAndExecute(
      new TokenCreateTransaction()
        .setTokenName(name)
        .setTokenSymbol(symbol)
        .setTokenType(TokenType.NonFungibleUnique)
        .setSupplyType(TokenSupplyType.Finite)
        .setMaxSupply(maxSupply)
        .setTreasuryAccountId(AccountId.fromString(treasuryAccountId))
        .setSupplyKey(this.operatorKey.publicKey)
        .setMetadataKey(this.operatorKey.publicKey)
        .setAdminKey(this.operatorKey.publicKey)
        .setTokenMemo("ZitounaDeFi lot passports"),
      { keys: [this.accountKey(treasury)] },
    );
    const receipt = await response.getReceipt(this.client);
    if (!receipt.tokenId) throw new AppError(502, "HEDERA_TOKEN_CREATE_FAILED", "No NFT token ID returned");
    return prisma.token.create({
      data: {
        kind: "NFT",
        name,
        symbol,
        tokenId: receipt.tokenId.toString(),
        decimals: 0,
        maxSupply,
        treasuryAccountId,
      },
    });
  }

  async associateToken(accountDbId, tokenId) {
    const account = await prisma.account.findUnique({ where: { id: accountDbId } });
    if (!account) throw notFound("Account not found", "ACCOUNT_NOT_FOUND");
    if (account.hederaAccountId === config.hedera.operatorId) return { associated: true };
    const response = await this.signAndExecute(
      new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(account.hederaAccountId))
        .setTokenIds([TokenId.fromString(tokenId)]),
      { keys: [this.accountKey(account)] },
    );
    await response.getReceipt(this.client);
    return { associated: true, txId: txIdString(response) };
  }

  async getToken(tokenId) {
    const token = await prisma.token.findUnique({ where: { tokenId } });
    if (!token) throw notFound(`Unknown token ${tokenId}`, "TOKEN_NOT_FOUND");
    return token;
  }

  async treasuryAccount(token) {
    const account = await prisma.account.findUnique({
      where: { hederaAccountId: token.treasuryAccountId ?? "" },
    });
    if (!account) throw notFound("Treasury account is not configured", "TREASURY_NOT_FOUND");
    return account;
  }

  async adjustDbBalance(token, accountId, delta) {
    const current = await prisma.tokenBalance.findUnique({
      where: { tokenDbId_accountId: { tokenDbId: token.id, accountId } },
    });
    const next = (current?.amount ?? 0) + delta;
    if (next < 0) {
      throw new AppError(409, "INSUFFICIENT_TOKEN_BALANCE", "Account does not hold enough tokens");
    }
    await prisma.tokenBalance.upsert({
      where: { tokenDbId_accountId: { tokenDbId: token.id, accountId } },
      create: { tokenDbId: token.id, accountId, amount: next },
      update: { amount: next },
    });
  }

  async mintFungible(tokenId, amountCt) {
    const token = await this.getToken(tokenId);
    const response = await this.signAndExecute(
      new TokenMintTransaction().setTokenId(TokenId.fromString(tokenId)).setAmount(amountCt),
    );
    await response.getReceipt(this.client);
    const treasury = await this.treasuryAccount(token);
    await this.adjustDbBalance(token, treasury.id, amountCt);
    return { txId: txIdString(response) };
  }

  async burnFungible(tokenId, amountCt) {
    const token = await this.getToken(tokenId);
    const response = await this.signAndExecute(
      new TokenBurnTransaction().setTokenId(TokenId.fromString(tokenId)).setAmount(amountCt),
    );
    await response.getReceipt(this.client);
    const treasury = await this.treasuryAccount(token);
    await this.adjustDbBalance(token, treasury.id, -amountCt);
    return { txId: txIdString(response) };
  }

  async transferTokens(legs, memo = "") {
    const tx = new TransferTransaction();
    if (memo) tx.setTransactionMemo(memo);
    const signers = [];
    for (const leg of legs) {
      const token = await prisma.token.findUnique({ where: { tokenId: leg.tokenId } });
      if (!token) throw notFound(`Unknown token ${leg.tokenId}`, "TOKEN_NOT_FOUND");
      const from = await prisma.account.findUnique({ where: { id: leg.fromAccountId } });
      const to = await prisma.account.findUnique({ where: { id: leg.toAccountId } });
      if (!from || !to) throw notFound("Transfer account not found", "ACCOUNT_NOT_FOUND");
      tx.addTokenTransfer(TokenId.fromString(leg.tokenId), AccountId.fromString(from.hederaAccountId), -leg.amountCt);
      tx.addTokenTransfer(TokenId.fromString(leg.tokenId), AccountId.fromString(to.hederaAccountId), leg.amountCt);
      signers.push(this.accountKey(from));
    }
    const response = await this.signAndExecute(tx, { signers });
    await response.getReceipt(this.client);
    for (const leg of legs) {
      const token = await this.getToken(leg.tokenId);
      await this.adjustDbBalance(token, leg.fromAccountId, -leg.amountCt);
      await this.adjustDbBalance(token, leg.toAccountId, leg.amountCt);
    }
    return { txId: txIdString(response), memo };
  }

  async mintNft(collectionTokenId, metadata, ownerAccountId) {
    const response = await this.signAndExecute(
      new TokenMintTransaction()
        .setTokenId(TokenId.fromString(collectionTokenId))
        .setMetadata([Buffer.from(metadata)]),
    );
    const receipt = await response.getReceipt(this.client);
    const serial = receipt.serials?.[0];
    if (!serial) throw new AppError(502, "HEDERA_NFT_MINT_FAILED", "No NFT serial returned");
    return { serial: Number(serial), txId: txIdString(response), ownerAccountId, metadata };
  }

  async updateNftMetadata(collectionTokenId, serial, metadata) {
    const response = await this.signAndExecute(
      new TokenUpdateNftsTransaction()
        .setTokenId(TokenId.fromString(collectionTokenId))
        .setSerialNumbers([Long.fromNumber(serial)])
        .setMetadata(Buffer.from(metadata)),
    );
    await response.getReceipt(this.client);
    return { txId: txIdString(response), metadata };
  }

  async getTokenBalance(accountDbId, tokenId) {
    const account = await prisma.account.findUnique({ where: { id: accountDbId } });
    if (!account) throw notFound("Account not found", "ACCOUNT_NOT_FOUND");
    try {
      const balance = await new AccountBalanceQuery()
        .setAccountId(AccountId.fromString(account.hederaAccountId))
        .execute(this.client);
      const value = balance.tokens.get(TokenId.fromString(tokenId));
      return value ? Number(value) : 0;
    } catch {
      return 0;
    }
  }

  async getTotalSupply(tokenId) {
    const info = await new TokenInfoQuery().setTokenId(TokenId.fromString(tokenId)).execute(this.client);
    return Number(info.totalSupply);
  }

  async getHbarBalance(accountId = config.hedera.operatorId) {
    const balance = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(accountId))
      .execute(this.client);
    return balance.hbars.toBigNumber().toNumber();
  }

  async getTopicRecords(topicId) {
    const messages = [];
    let url = `/topics/${topicId}/messages?limit=100&order=asc`;
    for (let page = 0; page < 10 && url; page += 1) {
      const data = await this.mirrorGet(url);
      for (const message of data.messages ?? []) {
        const text = Buffer.from(message.message, "base64").toString("utf8");
        messages.push({
          seq: Number(message.sequence_number),
          text,
          hash: await sha256Hex(text),
          consensusTs: this.mirrorTimestampToDate(message.consensus_timestamp),
          consensusTimestamp: message.consensus_timestamp,
        });
      }
      url = data.links?.next ?? null;
    }
    return messages.sort((a, b) => a.seq - b.seq);
  }

  async getTopicMessagesRaw(topicId, { limit = 100, order = "asc" } = {}) {
    return this.mirrorGet(`/topics/${topicId}/messages?limit=${limit}&order=${order}`);
  }

  async getTokenInfoRaw(tokenId) {
    return this.mirrorGet(`/tokens/${tokenId}`);
  }

  mirrorTimestampToDate(timestamp) {
    if (!timestamp) return new Date();
    const [seconds, nanos] = String(timestamp).split(".");
    return new Date(Number(seconds) * 1_000 + Number(nanos ?? 0) / 1_000_000);
  }

  dateToMirrorTimestamp(date) {
    const ms = date.getTime();
    return `${Math.floor(ms / 1_000)}.${String((ms % 1_000) * 1_000_000).padStart(9, "0")}`;
  }

  async mirrorGet(path) {
    const url = `${config.mirrorBase}${path.startsWith("/") ? path : `/${path}`}`;
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) {
      throw new AppError(502, "MIRROR_NODE_ERROR", `Mirror Node returned ${response.status}`, {
        url,
      });
    }
    return response.json();
  }

  async close() {
    this.client.close();
  }
}
