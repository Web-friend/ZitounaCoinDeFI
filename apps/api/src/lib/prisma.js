import { PrismaClient } from "@prisma/client";

const globalKey = "__zitouna_prisma__";

export const prisma =
  globalThis[globalKey] ??
  new PrismaClient({
    log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalThis[globalKey] = prisma;
