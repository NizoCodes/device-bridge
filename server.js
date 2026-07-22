"use strict";

// NizoMed EHR — Lab Device Bridge (Phase 2: listen + ACK + parse + log).
//
// Boots one TCP (MLLP) listener per machine defined in config/machines.json.
// For every HL7 message an analyzer sends it: (1) saves the raw message to disk,
// (2) parses it, (3) logs a human-readable summary, and (4) replies with an MLLP
// ACK so the analyzer marks the transmission successful.
//
// It does NOT yet write to the EHR — that is Phase 3. Right now this doubles as
// the capture tool for pinning down each analyzer's real HL7 format.

const net = require("net");
const fs = require("fs");
const path = require("path");

const { MllpParser, frame } = require("./lib/mllp");
const hl7 = require("./lib/hl7");
const log = require("./lib/logger");

loadDotEnv();

const ACK_APP = process.env.ACK_APP || "NIZOMED_EHR";
const ACK_FACILITY = process.env.ACK_FACILITY || "LAB";

function loadDotEnv() {
  // Tiny zero-dependency .env loader (avoids needing `npm install` on an
  // offline LAN server). Lines like KEY=value; ignores blanks and #comments.
  const file = path.join(__dirname, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const val = m[2].replace(/^["']|["']$/g, "");
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}

function loadMachines() {
  const cfg = JSON.parse(
    fs.readFileSync(path.join(__dirname, "config", "machines.json"), "utf8")
  );
  return (cfg.machines || []).filter((m) => m.enabled !== false);
}

function loadProfile(model) {
  try {
    return require(`./profiles/${model}`);
  } catch {
    return null;
  }
}

function handleMessage(machine, message) {
  const savedPath = log.saveRaw(machine.name, message);

  let parsed;
  try {
    parsed = hl7.parse(message);
  } catch (err) {
    log.warn(`[${machine.name}] failed to parse HL7:`, err.message, `(raw saved: ${savedPath})`);
    return null; // still ACK below to keep the analyzer happy
  }

  const obsCount = parsed.observations.length;
  log.info(
    `[${machine.name}] ${parsed.messageType || "message"} ` +
      `ctrl=${parsed.controlId || "?"} segments=[${parsed.segmentNames.join(",")}] ` +
      `observations=${obsCount}`
  );
  log.info(`[${machine.name}] Sample ID candidates:`, JSON.stringify(parsed.sampleIdCandidates));
  if (obsCount) {
    for (const o of parsed.observations) {
      log.info(
        `    ${o.code.padEnd(8)} = ${String(o.value).padEnd(10)} ${o.units}` +
          `${o.abnormalFlag ? `  [${o.abnormalFlag}]` : ""}` +
          `${o.referenceRange ? `  (ref ${o.referenceRange})` : ""}`
      );
    }
  }
  log.info(`[${machine.name}] raw saved: ${savedPath}`);

  // Phase 3 will map parsed.observations via the profile and POST to ehr-servers
  // keyed by the Sample ID / accession. For now we only observe.
  return parsed;
}

function startListener(machine) {
  const profile = loadProfile(machine.model);
  const server = net.createServer((socket) => {
    const peer = `${socket.remoteAddress}:${socket.remotePort}`;
    log.info(`[${machine.name}] connection from ${peer}`);
    const parser = new MllpParser();

    socket.on("data", (chunk) => {
      parser.push(chunk, (message) => {
        const parsed = handleMessage(machine, message);
        // Always ACK so the analyzer does not retry / error out.
        const ack = hl7.buildAck(parsed || {}, { app: ACK_APP, facility: ACK_FACILITY });
        socket.write(frame(ack));
      });
    });

    socket.on("error", (err) => log.warn(`[${machine.name}] socket error from ${peer}:`, err.message));
    socket.on("close", () => log.info(`[${machine.name}] connection closed ${peer}`));
  });

  server.on("error", (err) => log.warn(`[${machine.name}] server error:`, err.message));
  server.listen(machine.listenPort, () => {
    log.info(
      `[${machine.name}] listening on :${machine.listenPort} ` +
        `(model=${machine.model}${profile ? "" : ", NO PROFILE"})`
    );
  });
  return server;
}

function main() {
  const machines = loadMachines();
  if (!machines.length) {
    log.warn("No enabled machines in config/machines.json — nothing to listen on.");
    return;
  }
  log.info(`Device Bridge starting — ${machines.length} machine(s). Logs → ${log.LOG_DIR}`);
  machines.forEach(startListener);
}

main();
