import { prisma } from "./prisma.js";

export function newId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function pickupCode() {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

export async function nextCode(model, prefix, width = 4) {
  const rows = await prisma[model].findMany({ select: { code: true } });
  let max = 0;
  for (const row of rows) {
    const match = /^([A-Z]+)-(\d+)$/.exec(row.code ?? "");
    if (match && match[1] === prefix) max = Math.max(max, Number(match[2]));
  }
  return `${prefix}-${String(max + 1).padStart(width, "0")}`;
}

export function shortHash(value, length = 10) {
  if (!value) return "";
  return `${value.slice(0, length)}…${value.slice(-4)}`;
}
