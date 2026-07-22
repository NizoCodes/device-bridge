"use strict";

const fs = require("fs");
const path = require("path");

// Every raw HL7 message is written verbatim to disk. In Phase 2 this is the
// whole point — it is our capture tool for pinning down the analyzer's exact
// message format. It also gives an audit trail and lets us re-process a message
// later (e.g. if the EHR ingest was down when it arrived).

const LOG_DIR = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.join(__dirname, "..", "logs");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/** Append a timestamped console line. */
function info(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function warn(...args) {
  console.warn(`[${new Date().toISOString()}]`, ...args);
}

/**
 * Persist a raw message to logs/<machine>/<timestamp>.hl7 and return the path.
 */
function saveRaw(machineName, message) {
  const dir = path.join(LOG_DIR, machineName.replace(/[^\w.-]/g, "_"));
  ensureDir(dir);
  const file = path.join(dir, `${ts()}.hl7`);
  fs.writeFileSync(file, message, "utf8");
  return file;
}

module.exports = { info, warn, saveRaw, LOG_DIR };
