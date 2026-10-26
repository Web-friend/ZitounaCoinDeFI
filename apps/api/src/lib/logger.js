import pino from "pino";
import { config } from "../config.js";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (config.env === "test" ? "silent" : "info"),
  base: { service: "zitounadefi-api", mode: config.ledgerMode },
});
