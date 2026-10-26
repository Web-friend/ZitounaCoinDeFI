import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

const ENV_LOCAL = path.join(config.repoRoot, ".env.local");

export function readEnvLocal() {
  try {
    return fs.readFileSync(ENV_LOCAL, "utf8");
  } catch {
    return "";
  }
}

export function setEnvLocal(key, value) {
  const lines = readEnvLocal().split(/\r?\n/);
  const rendered = `${key}=${formatValue(value)}`;
  let replaced = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      replaced = true;
      return rendered;
    }
    return line;
  });
  if (!replaced) {
    if (next.length && next[next.length - 1] === "") next.pop();
    next.push(rendered);
  }
  writeEnv(next.join("\n") + "\n");
  process.env[key] = String(value);
}

export function setEnvLocalMany(values) {
  for (const [key, value] of Object.entries(values)) {
    if (value != null) setEnvLocal(key, value);
  }
}

function formatValue(value) {
  const text = String(value);
  return /^[A-Za-z0-9_./:@+-]+$/.test(text) ? text : JSON.stringify(text);
}

function writeEnv(text) {
  fs.mkdirSync(path.dirname(ENV_LOCAL), { recursive: true });
  fs.writeFileSync(ENV_LOCAL, text, { mode: 0o600 });
  try {
    fs.chmodSync(ENV_LOCAL, 0o600);
  } catch {
    // best effort on non-POSIX filesystems
  }
}

export function writePrivateJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // best effort
  }
}
