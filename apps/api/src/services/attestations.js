import { parseRecord, sha256Hex, verifyRecord } from "@zitouna/rules";
import { prisma } from "../lib/prisma.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { ledger } from "../ledger/index.js";
import { emitLotEvent } from "./events.js";
import { signAttestation } from "./auditor.js";
import { genesisMessage, nextTopicSeq, requireLot } from "./lots.js";

export async function latestAttestation(lotId) {
  return prisma.attestation.findFirst({
    where: { lotId },
    orderBy: { seq: "desc" },
  });
}

export async function nextAttestation(lotId) {
  const lot = await requireLot(lotId);
  const genesis = await genesisMessage(lot);
  if (!genesis) throw notFound("Lot genesis is missing", "GENESIS_MISSING");
  const last = await latestAttestation(lot.id);
  const prev = last?.chainHash ?? (await sha256Hex(genesis.payload));
  return {
    lot,
    seq: (last?.seq ?? 0) + 1,
    prev,
    genesis: genesis.payload,
    last,
  };
}

export async function submitAttestation(input) {
  const lot = await requireLot(input.lotId);
  const next = await nextAttestation(lot.id);

  let recordText = input.recordText;
  let signature = input.signature;

  if (!recordText) {
    if (input.litresRemaining == null) {
      throw badRequest("litresRemaining is required when recordText is not supplied", "MISSING_LITRES");
    }
    const signed = await signAttestation({
      lot,
      seq: next.seq,
      litresRemaining: Number(input.litresRemaining),
      labHash: input.labHash ?? "lab-demo",
      receiptHash: input.receiptHash ?? "receipt-demo",
      prev: next.prev,
      ts: input.ts ?? Date.now(),
    });
    recordText = signed.text;
    signature = signed.signature;
  }

  if (!signature) throw badRequest("signature is required", "MISSING_SIGNATURE");

  let parsed;
  try {
    parsed = parseRecord(recordText);
  } catch (error) {
    throw badRequest(`Attestation record is not valid: ${error.message}`, "INVALID_RECORD");
  }
  if (parsed.name !== "ATTESTATION") throw badRequest("Record must be an attestation", "INVALID_RECORD");
  const fields = parsed.fields;
  if (fields.lotId !== lot.code) {
    throw badRequest(`Attestation belongs to ${fields.lotId}, not ${lot.code}`, "WRONG_LOT");
  }
  if (fields.seq !== next.seq) {
    throw conflict(`Attestation sequence must be ${next.seq}`, "BAD_SEQUENCE", { expected: next.seq });
  }
  if (fields.prev !== next.prev) {
    throw conflict("Attestation prev hash does not match the chain head", "BROKEN_CHAIN");
  }
  if (fields.litresRemaining > lot.certifiedMl / 1_000) {
    throw badRequest("Attestation cannot exceed the certified litres", "OVER_CERTIFIED");
  }
  const signatureOk = await verifyRecord(recordText, signature, lot.auditorPublicKey);
  if (!signatureOk) throw badRequest("Attestation signature is invalid", "BAD_SIGNATURE");

  const duplicate = await prisma.attestation.findUnique({
    where: { lotId_seq: { lotId: lot.id, seq: fields.seq } },
  });
  if (duplicate) throw conflict("Attestation already exists", "DUPLICATE_ATTESTATION");

  const chainHash = await sha256Hex(recordText);
  const message = await ledger().submitMessage(lot.topicId, recordText, "ATTESTATION", lot.id);
  const attestation = await prisma.attestation.create({
    data: {
      lotId: lot.id,
      seq: fields.seq,
      litresRemaining: fields.litresRemaining,
      labHash: fields.labHash,
      receiptHash: fields.receiptHash,
      recordText,
      signature,
      chainHash,
      consensusTs: message.consensusTs,
    },
  });

  await prisma.lot.update({
    where: { id: lot.id },
    data: {
      remainingMl: fields.litresRemaining * 1_000,
      certifiedAt: lot.certifiedAt ?? new Date(),
    },
  });

  emitLotEvent(lot.id, { type: "attestation", seq: message.seq, txId: message.txId });
  return { attestation, message };
}

export async function attestWithAuditor({ lotId, litresRemaining, labHash, receiptHash }) {
  return submitAttestation({ lotId, litresRemaining, labHash, receiptHash });
}

export async function attestationContext(lotId) {
  const next = await nextAttestation(lotId);
  return {
    lotId: next.lot.code,
    series: next.lot.series,
    seq: next.seq,
    prev: next.prev,
    certifiedLitres: next.lot.certifiedMl / 1_000,
    nextTopicSeq: await nextTopicSeq(next.lot.topicId),
  };
}
