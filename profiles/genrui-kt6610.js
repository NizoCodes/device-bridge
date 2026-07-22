"use strict";

// Device profile for the Genrui KT-6610 Auto Hematology Analyzer (CBC).
//
// ⚠️ PHASE 2 STATUS: the `paramMap` below is a TENTATIVE guess based on the
// parameters shown on the analyzer screen. It is NOT yet used for anything —
// Phase 2 only listens, ACKs, and logs. Before Phase 3 (writing results into the
// EHR) we MUST replace these codes with the analyzer's REAL OBX identifiers,
// captured from a live message (see the logs/ folder) or from Genrui's HL7/LIS
// interface manual. Do not trust these keys until verified against a capture.
//
// `ehrParam` is the human-readable EHR parameter name; the actual link at Phase 3
// is per-facility (parameters are registered per center), so this is a starting
// point, not the final mapping.

module.exports = {
  model: "genrui-kt6610",
  displayName: "Genrui KT-6610 Hematology Analyzer",
  transport: "hl7-mllp-tcp",

  // Where the operator-typed Sample ID is expected. Confirm against a capture;
  // the parser surfaces all candidates so we can see which one is populated.
  sampleIdField: "OBR-3",

  // TENTATIVE — verify every code against a real captured message.
  paramMap: {
    WBC: "White Blood Cells",
    "NEU#": "Neutrophils (Absolute)",
    "LYM#": "Lymphocytes (Absolute)",
    "MON#": "Monocytes (Absolute)",
    "EOS#": "Eosinophils (Absolute)",
    "BAS#": "Basophils (Absolute)",
    "NEU%": "Neutrophils %",
    "LYM%": "Lymphocytes %",
    "MON%": "Monocytes %",
    "EOS%": "Eosinophils %",
    "BAS%": "Basophils %",
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
};
