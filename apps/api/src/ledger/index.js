import { config } from "../config.js";
import { StubLedger } from "./stub.js";
import { HederaLedger } from "./hedera.js";

let instance;

export function ledger() {
  if (!instance) {
    instance = config.ledgerMode === "hedera" ? new HederaLedger() : new StubLedger();
  }
  return instance;
}

export function resetLedgerForTests() {
  instance = undefined;
}
