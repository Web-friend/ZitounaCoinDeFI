-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('OPERATOR', 'PRODUCER', 'TREASURY', 'BUYER', 'AUDITOR');

-- CreateEnum
CREATE TYPE "Series" AS ENUM ('DGZ', 'TZT');

-- CreateEnum
CREATE TYPE "TokenKind" AS ENUM ('FUNGIBLE', 'NFT');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('CERTIFIED', 'LISTED', 'ACTIVE', 'LOW_STOCK', 'DEPLETED', 'PAUSED');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RedemptionStatus" AS ENUM ('REQUESTED', 'HANDED_OVER', 'BURNED', 'RETURNED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('GENESIS', 'ATTESTATION', 'LISTING', 'SALE', 'TRANSFER', 'REDEMPTION', 'HANDOVER', 'BURN', 'VERDICT');

-- CreateEnum
CREATE TYPE "Verdict" AS ENUM ('BACKED', 'LOW_STOCK', 'UNDERBACKED', 'STALE', 'INVALID');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL,
    "label" TEXT NOT NULL,
    "hederaAccountId" TEXT NOT NULL,
    "publicKey" TEXT,
    "keyEnvVar" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "kind" "TokenKind" NOT NULL,
    "series" "Series",
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 0,
    "maxSupply" INTEGER,
    "treasuryAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "series" "Series" NOT NULL,
    "grade" TEXT NOT NULL DEFAULT 'extra_virgin',
    "certifiedMl" INTEGER NOT NULL,
    "remainingMl" INTEGER NOT NULL,
    "pricePerLitreCents" INTEGER NOT NULL,
    "tndPerUsdCents" INTEGER NOT NULL DEFAULT 310,
    "warehouse" TEXT NOT NULL,
    "harvestYear" INTEGER NOT NULL,
    "status" "LotStatus" NOT NULL DEFAULT 'CERTIFIED',
    "topicId" TEXT,
    "nftTokenId" TEXT,
    "nftSerial" INTEGER,
    "auditorPublicKey" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "certifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attestation" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "litresRemaining" INTEGER NOT NULL,
    "labHash" TEXT NOT NULL,
    "receiptHash" TEXT NOT NULL,
    "recordText" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "chainHash" TEXT NOT NULL,
    "consensusTs" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attestation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "pricePerLitreCents" INTEGER NOT NULL,
    "litresOfferedMl" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "litresMl" INTEGER NOT NULL,
    "tokensCt" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'COMPLETED',
    "mintTxId" TEXT,
    "swapTxId" TEXT,
    "burnTxId" TEXT,
    "failureReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "tokensCt" INTEGER NOT NULL,
    "memo" TEXT,
    "txId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Redemption" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "holderId" TEXT NOT NULL,
    "tokensCt" INTEGER NOT NULL,
    "litresMl" INTEGER NOT NULL,
    "status" "RedemptionStatus" NOT NULL DEFAULT 'REQUESTED',
    "pickupCode" TEXT NOT NULL,
    "requestTxId" TEXT NOT NULL,
    "handoverTxId" TEXT,
    "burnTxId" TEXT,
    "handoverSource" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handoverAt" TIMESTAMP(3),
    "burnedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentVerdict" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "verdict" "Verdict" NOT NULL,
    "reasons" TEXT[],
    "explanation" TEXT NOT NULL,
    "ratioBps" INTEGER NOT NULL,
    "supplyCt" INTEGER NOT NULL,
    "attestedLitres" INTEGER NOT NULL,
    "attestationSeq" INTEGER,
    "decisionSeq" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentVerdict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerMessage" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" "MessageType" NOT NULL,
    "lotId" TEXT,
    "payload" TEXT NOT NULL,
    "consensusTs" TIMESTAMP(3) NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenBalance" (
    "id" TEXT NOT NULL,
    "tokenDbId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_hederaAccountId_key" ON "Account"("hederaAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Token_tokenId_key" ON "Token"("tokenId");

-- CreateIndex
CREATE UNIQUE INDEX "Token_kind_series_key" ON "Token"("kind", "series");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_code_key" ON "Lot"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_topicId_key" ON "Lot"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "Attestation_lotId_seq_key" ON "Attestation"("lotId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_lotId_key" ON "Listing"("lotId");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_idempotencyKey_key" ON "Trade"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_idempotencyKey_key" ON "Transfer"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Redemption_code_key" ON "Redemption"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerMessage_topicId_seq_key" ON "LedgerMessage"("topicId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "TokenBalance_tokenDbId_accountId_key" ON "TokenBalance"("tokenDbId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_key_key" ON "IdempotencyKey"("key");

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attestation" ADD CONSTRAINT "Attestation_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redemption" ADD CONSTRAINT "Redemption_holderId_fkey" FOREIGN KEY ("holderId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentVerdict" ADD CONSTRAINT "AgentVerdict_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerMessage" ADD CONSTRAINT "LedgerMessage_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenBalance" ADD CONSTRAINT "TokenBalance_tokenDbId_fkey" FOREIGN KEY ("tokenDbId") REFERENCES "Token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenBalance" ADD CONSTRAINT "TokenBalance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
