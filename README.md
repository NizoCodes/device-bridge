# NizoMed EHR — Lab Device Bridge

On-site service that connects lab analyzers to the NizoMed EHR. Analyzers send
results as **HL7 v2 over MLLP/TCP**; the EHR is not itself a LIS, so this bridge
plays the LIS role: it listens on the LAN, ACKs the machine, parses the message,
and (Phase 3) forwards results to `ehr-servers` keyed by the **accession / Sample
ID**. Closes NHIF findings **#1** (lab device integration) and **#7** (direct
results transmission). See `../ehr/docs/nhif-lab-device-integration-plan.md`.

Zero npm dependencies — runs on plain Node ≥ 18, so no `npm install` is needed on
an offline LAN server.

## Current status: Phase 2 (listen + ACK + parse + log)

It receives HL7, replies with an ACK, and **logs every raw message to `logs/`**.
It does **not** yet write to the EHR. Right now it doubles as the **capture tool**
for pinning down each analyzer's real HL7 format.

## Run it

```bash
cd ~/Projects/nizomed/device-bridge
node server.js            # or: npm start   /   npm run dev (auto-reload)
```

It listens per `config/machines.json` (default: Genrui KT-6610 on port `9100`).

## Test without the machine

In a second terminal:

```bash
npm run simulate                              # sends a demo CBC to 127.0.0.1:9100
node tools/simulate.js 127.0.0.1 9100 2607220001   # custom host/port/Sample ID
node tools/simulate.js --file logs/xxx.hl7    # replay a real captured message
```

The server terminal will print the parsed observations + Sample ID candidates and
save the raw message under `logs/<machine>/`.

## Capture the real analyzer format (the Phase 2 goal)

1. Give the analyzer a static LAN IP; plug in Ethernet.
2. On the analyzer: **Comm. Protocol = HL7**, **LIS IP = this server's IP**,
   **LIS port = 9100**, enable **Auto Comm** + **ACK**.
3. Run a control/sample. The bridge logs the raw HL7 to `logs/`.
4. Inspect it to confirm: which field carries the Sample ID, and the exact OBX
   codes → then finalize `profiles/genrui-kt6610.js` for Phase 3.

## Configuration

- `config/machines.json` — one entry per analyzer (`name`, `model`, `listenPort`).
  Multiple machines = multiple listeners in one process.
- `profiles/<model>.js` — per-model Sample ID field + OBX→EHR parameter map.
  ⚠️ The KT-6610 map is a **tentative guess** until verified against a capture.
- `.env` (copy from `.env.example`) — ACK identifiers now; EHR ingest URL +
  security key later (Phase 3).

## Deploy (offline LAN server)

```bash
pm2 start ecosystem.config.js && pm2 save
```

Firewall port `9100` to the LAN only. The bridge talks TCP directly to the
analyzer — it is **not** fronted by Apache.
