"use strict";

// Test harness: pretends to be a lab analyzer. Connects to the bridge, sends an
// MLLP-framed HL7 ORU^R01 CBC result, prints the ACK it receives, and exits.
// Lets us prove the bridge works end-to-end WITHOUT the physical machine.
//
// Usage:
//   node tools/simulate.js [host] [port] [sampleId]
//   node tools/simulate.js 127.0.0.1 9100 2607220001
//   node tools/simulate.js --file path/to/captured.hl7   (replay a real capture)

const net = require("net");
const fs = require("fs");
const { MllpParser, frame } = require("../lib/mllp");
const { hl7Now } = require("../lib/hl7");

const args = process.argv.slice(2);
let host = "127.0.0.1";
let port = 9100;
let sampleId = "2607220001";
let fileMessage = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--file") {
    fileMessage = fs.readFileSync(args[++i], "utf8");
  } else if (i === 0) host = args[i];
  else if (i === 1) port = Number(args[i]);
  else if (i === 2) sampleId = args[i];
}

// A representative Genrui-style CBC ORU^R01. NOTE: the exact OBX codes/field
// placement here are a stand-in — replace with a real capture (--file) once the
// analyzer is available. Segments are CR-separated per HL7.
function sampleMessage() {
  const now = hl7Now();
  const seg = [
    `MSH|^~\\&|KT-6610|LAB|NIZOMED_EHR|LAB|${now}||ORU^R01|${Date.now()}|P|2.3.1`,
    `PID|1||${sampleId}||MWANGA^OMBENI||19951101|M`,
    `OBR|1||${sampleId}|CBC^Complete Blood Count|||${now}`,
    `OBX|1|NM|WBC^White Blood Cell|1|9.18|10^9/L|4-10|N|||F`,
    `OBX|2|NM|HGB^Hemoglobin|1|9.8|g/dL|13-17|L|||F`,
    `OBX|3|NM|HCT^Hematocrit|1|25.2|%|40-50|L|||F`,
    `OBX|4|NM|PLT^Platelets|1|573|10^9/L|100-300|H|||F`,
    `OBX|5|NM|MCV^Mean Corpuscular Volume|1|81.2|fL|80-100|N|||F`,
    `OBX|6|NM|NEU%^Neutrophils Percent|1|81.7|%|45-75|H|||F`,
    `OBX|7|NM|LYM%^Lymphocytes Percent|1|9.5|%|20-40|L|||F`,
  ].join("\r");
  return seg;
}

const message = fileMessage || sampleMessage();

const client = net.createConnection({ host, port }, () => {
  console.log(`→ connected to ${host}:${port}, sending ${message.length} bytes`);
  client.write(frame(message));
});

const parser = new MllpParser();
client.on("data", (chunk) => {
  parser.push(chunk, (ack) => {
    console.log("← ACK received:\n" + ack.replace(/\r/g, "\n"));
    client.end();
  });
});

client.on("error", (err) => {
  console.error("simulator error:", err.message);
  process.exit(1);
});
client.on("close", () => process.exit(0));
