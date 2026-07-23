"use strict";

// Device profile for the Genrui KT-6610 Auto Hematology Analyzer (CBC).
//
// ✅ VERIFIED against a real capture from the Mchukwi facility on 2026-07-23
// (see tools/fixtures/genrui-kt6610-sample.hl7). The machine sends an ORU^R01
// where:
//   - MSH-3/4 = "Genrui"/"KT-6610"
//   - the operator-entered Sample ID is in PID-3
//   - each result is an OBX with the code in the SECOND component of OBX-3
//     ("^WBC^"), value in OBX-5, units in OBX-6, reference range in OBX-7,
//     and an abnormal flag in OBX-8 (L/H, plus Genrui "R"/"RH" review flags).
//   - value type NM = numeric result, IS = metadata, ED = histogram bitmap.
//
// Only NM observations are ingested. IS (Blood Mode, Age, ...) and ED (bitmaps)
// are ignored for result entry.
//
// NOTE: `ehrParam` names below are the canonical CBC names. The ACTUAL link at
// ingest time is machine-code -> the facility's registered parameterId, which is
// per-facility (parameters are registered per center). Confirm these against the
// facility's "FULL BLOOD PICTURE | FBP | CBC" test parameters during Phase 3.

module.exports = {
  model: "genrui-kt6610",
  displayName: "Genrui KT-6610 Hematology Analyzer",
  transport: "hl7-mllp-tcp",

  // Where the operator-typed Sample ID lands. For auto-matching to an EHR order,
  // the technician must enter the EHR accession number here when running the
  // sample (the machine otherwise fills its own counter, e.g. "23132-401").
  sampleIdField: "PID-3",

  // Only these OBX value types become lab results.
  ingestValueTypes: ["NM"],

  // Machine code (first non-empty component of OBX-3) -> canonical EHR parameter.
  paramMap: {
    WBC: "White Blood Cells",
    "Neu#": "Neutrophils (Absolute)",
    "Lym#": "Lymphocytes (Absolute)",
    "Mon#": "Monocytes (Absolute)",
    "Eos#": "Eosinophils (Absolute)",
    "Bas#": "Basophils (Absolute)",
    "Neu%": "Neutrophils %",
    "Lym%": "Lymphocytes %",
    "Mon%": "Monocytes %",
    "Eos%": "Eosinophils %",
    "Bas%": "Basophils %",
    RBC: "Red Blood Cells",
    HGB: "Haemoglobin",
    HCT: "Haematocrit",
    MCV: "MCV",
    MCH: "MCH",
    MCHC: "MCHC",
    "RDW-CV": "RDW-CV",
    "RDW-SD": "RDW-SD",
    PLT: "Platelets",
    MPV: "MPV",
    PDW: "PDW",
    PCT: "PCT",
    "P-LCC": "P-LCC",
    "P-LCR": "P-LCR",
  },

  // Non-result codes the machine also sends (IS type) — documented so they are
  // knowingly skipped rather than silently dropped.
  metadataCodes: ["Blood Mode", "Test Mode", "Ref Group", "Age", "Remarks"],
};
