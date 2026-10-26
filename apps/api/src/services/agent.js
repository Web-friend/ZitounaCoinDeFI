import { buildVerdict, explainVerdict, VERDICTS } from "@zitouna/rules";
import { config } from "../config.js";
import { prisma } from "../lib/prisma.js";
import { ledger } from "../ledger/index.js";
import { emitLotEvent } from "./events.js";
import { evaluateLot, nextTopicSeq, updateLotStatus } from "./lots.js";

export function statusForVerdict(verdict, lot) {
  if (verdict === VERDICTS.INVALID || verdict === VERDICTS.UNDERBACKED || verdict === VERDICTS.STALE) {
    return "PAUSED";
  }
  if (verdict === VERDICTS.LOW_STOCK) return "LOW_STOCK";
  if (lot.remainingMl <= 0) return "DEPLETED";
  if (lot.listing?.active) return "ACTIVE";
  return "LISTED";
}

export function explanationFor(evaluation) {
  const base = explainVerdict(evaluation);
  return `${base} Circulating supply is ${evaluation.supplyLitres.toFixed(2)} L against ${evaluation.attestedLitres.toFixed(
    0,
  )} L attested (${(evaluation.ratioBps / 100).toFixed(1)}% cover).`;
}

export async function runAgent(lotId, { writeMessage = true } = {}) {
  const bundle = await evaluateLot(lotId);
  const explanation = explanationFor(bundle.evaluation);
  const reasons = bundle.evaluation.reasons;

  let decisionSeq = null;
  if (writeMessage && bundle.lot.topicId) {
    const text = buildVerdict({
      lotId: bundle.lot.code,
      seq: await nextTopicSeq(bundle.lot.topicId),
      ts: Date.now(),
      verdict: bundle.evaluation.verdict,
      ratioBps: bundle.evaluation.ratioBps,
      supplyCt: bundle.supplyCt,
      attestedLitres: Math.round(bundle.evaluation.attestedLitres),
      reasons,
    });
    const message = await ledger().submitMessage(bundle.lot.topicId, text, "VERDICT", bundle.lot.id);
    decisionSeq = message.seq;
  }

  const verdict = await prisma.agentVerdict.create({
    data: {
      lotId: bundle.lot.id,
      verdict: bundle.evaluation.verdict,
      reasons,
      explanation,
      ratioBps: bundle.evaluation.ratioBps,
      supplyCt: bundle.supplyCt,
      attestedLitres: Math.round(bundle.evaluation.attestedLitres),
      attestationSeq: bundle.lot.attestations.at(-1)?.seq ?? null,
      decisionSeq,
    },
  });

  const status = statusForVerdict(bundle.evaluation.verdict, bundle.lot);
  if (status !== bundle.lot.status) await updateLotStatus(bundle.lot.id, status);

  emitLotEvent(bundle.lot.id, {
    type: "agent.verdict",
    verdict: bundle.evaluation.verdict,
    decisionSeq,
  });

  return {
    verdict: verdict.verdict,
    reasons,
    explanation,
    ratioBps: verdict.ratioBps,
    supplyCt: verdict.supplyCt,
    attestedLitres: verdict.attestedLitres,
    decisionSeq,
    status,
    evaluation: bundle.evaluation,
  };
}

export function assertSaleAllowed(evaluation, { paused = false } = {}) {
  if (config.policy.pauseAgent || paused) {
    return { ok: false, code: "AGENT_PAUSED", message: "The reserve agent is paused by the operator" };
  }
  if (!evaluation.allowsSales) {
    return {
      ok: false,
      code: `RESERVE_${evaluation.verdict}`,
      message: `Reserve verdict ${evaluation.verdict} blocks new sales`,
      reasons: evaluation.reasonText,
    };
  }
  return { ok: true };
}

export async function latestVerdict(lotId) {
  return prisma.agentVerdict.findFirst({
    where: { lotId },
    orderBy: { createdAt: "desc" },
  });
}
