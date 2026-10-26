import { sha256Hex } from "@zitouna/rules";
import { prisma } from "../lib/prisma.js";
import { AppError, notFound } from "../lib/errors.js";

/**
 * Deterministic local ledger used for development and automated tests.
 * It mirrors the small subset of Hedera the demo needs: HCS topics, HTS
 * fungible supply, balances, NFT serials and real transaction-shaped IDs.
 */
export class StubLedger {
  mode = "stub";

  async nextId() {
    const rows = await prisma.$queryRaw`
      INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
      VALUES ('stub:id', '900000', now())
      ON CONFLICT ("key") DO UPDATE
        SET "value" = (CAST("SystemSetting"."value" AS INTEGER) + 1)::text,
            "updatedAt" = now()
      RETURNING "value";
    `;
    return Number(rows[0].value);
  }

  async createTopic(memo) {
    const id = await this.nextId();
    return { topicId: `0.0.${id}`, memo, txId: `stub-topic-${id}` };
  }

  async ensureTopic(topicId) {
    return { topicId };
  }

  async submitMessage(topicId, text, type, lotId = null) {
    const max = await prisma.ledgerMessage.aggregate({
      where: { topicId },
      _max: { seq: true },
    });
    const seq = (max._max.seq ?? 0) + 1;
    const hash = await sha256Hex(text);
    const consensusTs = new Date();
    await prisma.ledgerMessage.create({
      data: { topicId, seq, type, lotId, payload: text, hash, consensusTs },
    });
    return {
      seq,
      hash,
      consensusTs,
      consensusTimestamp: `${Math.floor(consensusTs.getTime() / 1000)}.${String(
        (consensusTs.getTime() % 1000) * 1_000_000,
      ).padStart(9, "0")}`,
      txId: `stub-msg-${topicId}-${seq}`,
    };
  }

  async createAccount({ label }) {
    const id = await this.nextId();
    return {
      hederaAccountId: `0.0.${id}`,
      privateKeyDer: null,
      publicKey: null,
      label,
      hbar: 1_000,
    };
  }

  async createFungibleToken({ series = null, name, symbol, maxSupply, decimals = 2, treasuryAccountId }) {
    const existing = await prisma.token.findFirst({ where: { symbol } });
    if (existing) return existing;
    const id = await this.nextId();
    return prisma.token.create({
      data: {
        kind: "FUNGIBLE",
        series: series ?? undefined,
        name,
        symbol,
        tokenId: `0.0.${id}`,
        decimals,
        maxSupply,
        treasuryAccountId,
      },
    });
  }

  async createNftCollection({ name, symbol, maxSupply = 10_000, treasuryAccountId }) {
    const existing = await prisma.token.findFirst({ where: { symbol } });
    if (existing) return existing;
    const id = await this.nextId();
    return prisma.token.create({
      data: {
        kind: "NFT",
        name,
        symbol,
        tokenId: `0.0.${id}`,
        decimals: 0,
        maxSupply,
        treasuryAccountId,
      },
    });
  }

  async associateToken() {
    return { associated: true };
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

  async adjustBalance(tx, token, accountId, delta) {
    const current = await tx.tokenBalance.findUnique({
      where: { tokenDbId_accountId: { tokenDbId: token.id, accountId } },
    });
    const next = (current?.amount ?? 0) + delta;
    if (next < 0) {
      throw new AppError(409, "INSUFFICIENT_TOKEN_BALANCE", "Account does not hold enough tokens", {
        token: token.symbol,
        accountId,
        balance: current?.amount ?? 0,
        requested: Math.abs(delta),
      });
    }
    return tx.tokenBalance.upsert({
      where: { tokenDbId_accountId: { tokenDbId: token.id, accountId } },
      create: { tokenDbId: token.id, accountId, amount: next },
      update: { amount: next },
    });
  }

  async mintFungible(tokenId, amountCt) {
    if (!Number.isInteger(amountCt) || amountCt <= 0) {
      throw new AppError(400, "BAD_AMOUNT", "Mint amount must be a positive integer");
    }
    const token = await this.getToken(tokenId);
    const treasury = await this.treasuryAccount(token);
    const tx = await prisma.$transaction(async (db) => {
      const supply = await db.tokenBalance.aggregate({
        where: { tokenDbId: token.id },
        _sum: { amount: true },
      });
      const total = (supply._sum.amount ?? 0) + amountCt;
      if (token.maxSupply != null && total > token.maxSupply) {
        throw new AppError(409, "MAX_SUPPLY_EXCEEDED", "Mint would exceed the token's finite supply", {
          maxSupply: token.maxSupply,
          total,
        });
      }
      await this.adjustBalance(db, token, treasury.id, amountCt);
      return total;
    });
    return { txId: `stub-mint-${token.symbol}-${Date.now()}`, totalSupply: tx };
  }

  async burnFungible(tokenId, amountCt) {
    if (!Number.isInteger(amountCt) || amountCt <= 0) {
      throw new AppError(400, "BAD_AMOUNT", "Burn amount must be a positive integer");
    }
    const token = await this.getToken(tokenId);
    const treasury = await this.treasuryAccount(token);
    await prisma.$transaction(async (db) => {
      await this.adjustBalance(db, token, treasury.id, -amountCt);
    });
    return { txId: `stub-burn-${token.symbol}-${Date.now()}` };
  }

  async transferTokens(legs, memo = "") {
    if (!Array.isArray(legs) || legs.length === 0) {
      throw new AppError(400, "NO_LEGS", "A transfer needs at least one leg");
    }
    await prisma.$transaction(async (db) => {
      for (const leg of legs) {
        const token = await db.token.findUnique({ where: { tokenId: leg.tokenId } });
        if (!token) throw notFound(`Unknown token ${leg.tokenId}`, "TOKEN_NOT_FOUND");
        if (leg.amountCt <= 0) throw new AppError(400, "BAD_AMOUNT", "Transfer amount must be positive");
        await this.adjustBalance(db, token, leg.fromAccountId, -leg.amountCt);
        await this.adjustBalance(db, token, leg.toAccountId, leg.amountCt);
      }
    });
    return { txId: `stub-transfer-${Date.now()}-${Math.floor(Math.random() * 1_000)}`, memo };
  }

  async mintNft(collectionTokenId, metadata, ownerAccountId) {
    const settingKey = `stub:nftSerial:${collectionTokenId}`;
    const rows = await prisma.$queryRaw`
      INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
      VALUES (${settingKey}, '1', now())
      ON CONFLICT ("key") DO UPDATE
        SET "value" = (CAST("SystemSetting"."value" AS INTEGER) + 1)::text,
            "updatedAt" = now()
      RETURNING "value";
    `;
    return {
      serial: Number(rows[0].value),
      txId: `stub-nft-${collectionTokenId}-${rows[0].value}`,
      ownerAccountId,
      metadata,
    };
  }

  async updateNftMetadata(collectionTokenId, serial, metadata) {
    return { txId: `stub-nft-update-${collectionTokenId}-${serial}`, metadata };
  }

  async getTokenBalance(accountDbId, tokenId) {
    const token = await this.getToken(tokenId);
    const row = await prisma.tokenBalance.findUnique({
      where: { tokenDbId_accountId: { tokenDbId: token.id, accountId: accountDbId } },
    });
    return row?.amount ?? 0;
  }

  async getTotalSupply(tokenId) {
    const token = await this.getToken(tokenId);
    const row = await prisma.tokenBalance.aggregate({
      where: { tokenDbId: token.id },
      _sum: { amount: true },
    });
    return row._sum.amount ?? 0;
  }

  async getHbarBalance() {
    return 1_000;
  }

  async getTopicRecords(topicId) {
    const rows = await prisma.ledgerMessage.findMany({
      where: { topicId },
      orderBy: { seq: "asc" },
    });
    return rows.map((row) => ({
      seq: row.seq,
      text: row.payload,
      hash: row.hash,
      consensusTs: row.consensusTs,
      consensusTimestamp: `${Math.floor(row.consensusTs.getTime() / 1000)}.${String(
        (row.consensusTs.getTime() % 1000) * 1_000_000,
      ).padStart(9, "0")}`,
    }));
  }

  async getTopicMessagesRaw(topicId, { limit = 100, order = "asc" } = {}) {
    const rows = await prisma.ledgerMessage.findMany({
      where: { topicId },
      orderBy: { seq: order === "desc" ? "desc" : "asc" },
      take: limit,
    });
    return {
      messages: rows.map((row) => ({
        topic_id: row.topicId,
        sequence_number: row.seq,
        consensus_timestamp: `${Math.floor(row.consensusTs.getTime() / 1000)}.${String(
          (row.consensusTs.getTime() % 1000) * 1_000_000,
        ).padStart(9, "0")}`,
        message: Buffer.from(row.payload, "utf8").toString("base64"),
      })),
      links: { next: null },
    };
  }

  async getTokenInfoRaw(tokenId) {
    const token = await this.getToken(tokenId);
    const supply = await this.getTotalSupply(tokenId);
    return {
      token_id: token.tokenId,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      total_supply: String(supply),
      max_supply: token.maxSupply == null ? null : String(token.maxSupply),
      type: token.kind === "NFT" ? "NON_FUNGIBLE_UNIQUE" : "FUNGIBLE_COMMON",
    };
  }

  async close() {}
}
