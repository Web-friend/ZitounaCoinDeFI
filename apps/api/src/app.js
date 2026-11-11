import fs from "node:fs";
import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import swaggerUi from "swagger-ui-express";
import { config } from "./config.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./lib/errors.js";
import { openapi } from "./openapi.js";
import lotsRouter from "./routes/lots.js";
import redemptionsRouter from "./routes/redemptions.js";
import walletRouter from "./routes/wallet.js";
import mirrorRouter from "./routes/mirror.js";
import demoRouter from "./routes/demo.js";
import healthRouter from "./routes/health.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin: config.corsOrigin.split(",").map((origin) => origin.trim()),
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = req.headers["x-request-id"] ?? crypto.randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
    }),
  );

  app.get("/", (_req, res) => {
    res.json({
      name: "ZitounaDeFi API",
      version: "0.1.0",
      mode: config.ledgerMode,
      docs: "/docs",
      health: "/api/v1/health",
    });
  });

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: "ZitounaDeFi API" }));
  app.get("/openapi.json", (_req, res) => res.json(openapi));

  app.use("/api/v1", healthRouter);
  app.use("/api/v1/lots", lotsRouter);
  app.use("/api/v1/redemptions", redemptionsRouter);
  app.use("/api/v1/mirror", mirrorRouter);
  app.use("/api/v1/demo", demoRouter);
  app.use("/api/v1", walletRouter);

  const dist = path.join(config.repoRoot, "apps/web/dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { maxAge: "1h", index: false }));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/docs")) return next();
      res.sendFile(path.join(dist, "index.html"));
    });
  }

  app.use((req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}`, requestId: req.id },
    });
  });
  app.use((error, req, res, next) => {
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({
        error: { code: "INVALID_JSON", message: "Request body is not valid JSON", requestId: req.id },
      });
    }
    return errorHandler(error, req, res, next);
  });

  return app;
}
