"use strict";

// Minimal HL7 v2 reader — just enough to understand analyzer result messages
// (ORU^R01) without pulling in a heavy dependency. Analyzers vary in exactly
// which fields carry the Sample ID and observation codes, so this parser stays
// lenient and surfaces several candidate fields; the real mapping is pinned per
// machine model in profiles/ once we capture a live message.

/**
 * Format a Date as an HL7 timestamp: YYYYMMDDHHMMSS.
 */
function hl7Now(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

/**
 * Parse a raw HL7 message string into a friendly object.
 * @param {string} raw
 */
function parse(raw) {
  const segments = raw
    .split(/\r\n|\r|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => ({ name: line.slice(0, 3), fields: line.split("|"), raw: line }));

  const seg = (name) => segments.find((s) => s.name === name);
  const segAll = (name) => segments.filter((s) => s.name === name);

  // MSH is special: the field separator is char 4, and MSH-2 holds the encoding
  // characters, so MSH-n === fields[n-1] for n >= 2.
  const mshSeg = seg("MSH");
  const mshF = mshSeg ? mshSeg.fields : [];
  const msh = {
    sendingApp: mshF[2] || "",
    sendingFacility: mshF[3] || "",
    receivingApp: mshF[4] || "",
    receivingFacility: mshF[5] || "",
    messageType: mshF[8] || "",
    controlId: mshF[9] || "",
    version: mshF[11] || "2.3.1",
  };

  // Observations from OBX segments. For non-MSH segments, OBX-n === fields[n].
  // OBX-3 identifier is a coded element: id^text^system.
  const observations = segAll("OBX").map((s) => {
    const f = s.fields;
    // OBX-3 is a coded element (identifier^text^system). Analyzers disagree on
    // which component holds the code: the Genrui KT-6610 sends "^WBC^" (code in
    // the 2nd component, 1st empty), others send "WBC^White Blood Cell". Taking
    // the first NON-EMPTY component gets the code right in both cases.
    const idComps = (f[3] || "").split("^");
    const code = idComps.find((c) => c && c.trim()) || "";
    return {
      valueType: f[2] || "",
      code,
      identifierRaw: f[3] || "",
      value: f[5] || "",
      // Units (OBX-6) are kept verbatim — CBC units legitimately contain "^"
      // (e.g. "10^9/L", "10^12/L"), so we must NOT split on the component sep.
      units: f[6] || "",
      referenceRange: f[7] || "",
      abnormalFlag: f[8] || "",
      status: f[11] || "",
    };
  });

  // Candidate Sample ID fields — analyzers put the operator-typed Sample ID in
  // different places (OBR-3 filler, OBR-2 placer, SPM-2, or PID-3). Capture all.
  const obr = seg("OBR");
  const spm = seg("SPM");
  const pid = seg("PID");
  const sampleIdCandidates = {
    "OBR-2": obr ? (obr.fields[2] || "").split("^")[0] : "",
    "OBR-3": obr ? (obr.fields[3] || "").split("^")[0] : "",
    "SPM-2": spm ? (spm.fields[2] || "").split("^")[0] : "",
    "PID-3": pid ? (pid.fields[3] || "").split("^")[0] : "",
  };

  return {
    msh,
    messageType: msh.messageType,
    controlId: msh.controlId,
    segmentNames: segments.map((s) => s.name),
    observations,
    sampleIdCandidates,
    segments,
  };
}

/**
 * Build an MLLP-ready ACK (application accept) for a parsed message. Swaps the
 * sender/receiver and echoes the original control id in MSA-2.
 */
function buildAck(parsed, { app = "NIZOMED_EHR", facility = "LAB" } = {}) {
  const msh = parsed.msh || {};
  const controlId = msh.controlId || String(Date.now());
  const header =
    `MSH|^~\\&|${app}|${facility}|${msh.sendingApp}|${msh.sendingFacility}` +
    `|${hl7Now()}||ACK^R01|${controlId}|P|${msh.version}`;
  const msa = `MSA|AA|${controlId}`;
  return `${header}\r${msa}\r`;
}

module.exports = { parse, buildAck, hl7Now };
