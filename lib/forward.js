"use strict";

const http = require("http");
const https = require("https");
const { URL } = require("url");

// Zero-dependency JSON POST with a hard timeout. Used to forward parsed analyzer
// results to the EHR ingest endpoint. On an offline LAN server the target is
// http://127.0.0.1:6090 — always an IP, never "localhost".
function postJson(urlStr, body, headers = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === "https:" ? https : http;
    const data = Buffer.from(JSON.stringify(body));
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data.length,
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        let chunks = "";
        res.on("data", (c) => (chunks += c));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(chunks);
          } catch {
            parsed = chunks;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("request timeout")));
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

/**
 * Forward one parsed HL7 result message to the EHR ingest endpoint. Sends only
 * the value types the profile marks for ingest (NM), each as a raw {code,value,
 * units,referenceRange,abnormalFlag}. The EHR maps codes -> parameters itself.
 */
async function forwardResults({ url, securityKey, model, machineName, parsed, profile }) {
  const sampleIdField = (profile && profile.sampleIdField) || "PID-3";
  const sampleId =
    (parsed.sampleIdCandidates && parsed.sampleIdCandidates[sampleIdField]) || "";
  const ingestTypes = (profile && profile.ingestValueTypes) || ["NM"];

  const results = parsed.observations
    .filter((o) => ingestTypes.includes(o.valueType))
    .map((o) => ({
      code: o.code,
      value: o.value,
      units: o.units,
      referenceRange: o.referenceRange,
      abnormalFlag: o.abnormalFlag,
    }));

  // machineName identifies the specific unit (config machines.json `name`), so
  // two analyzers of the same model can be told apart in the EHR.
  const body = { model, machineName, sampleId, controlId: parsed.controlId, results };
  return postJson(url, body, { "x-security-key": securityKey || "" });
}

module.exports = { forwardResults, postJson };
