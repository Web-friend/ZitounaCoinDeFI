import { createApp } from "./app.js";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { ledger } from "./ledger/index.js";

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      mode: config.ledgerMode,
      docs: `http://localhost:${config.port}/docs`,
      health: `http://localhost:${config.port}/api/v1/health`,
    },
    "ZitounaDeFi API listening",
  );
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    logger.error(`Port ${config.port} is already in use. Set PORT in .env or stop the other process.`);
  } else {
    logger.error({ err: error }, "server error");
  }
  process.exitCode = 1;
});

async function shutdown(signal) {
  logger.info({ signal }, "shutting down");
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    try {
      await ledger().close?.();
    } catch {
      // ignore
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 8_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
