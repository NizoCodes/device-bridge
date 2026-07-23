# Lab Machine Integration — Go-Live Runbook

Step-by-step to take a facility's analyzer from "captured" to "results flowing
into the EHR, locked." Written for an **offline LAN facility** (e.g. Mchukwi).
Run the server steps over SSH on that facility's server.

Reference: `../ehr/docs/nhif-lab-device-integration-plan.md`.

Legend: 🖥️ = on the LAN server (SSH) · 💻 = in the EHR web app · 🔬 = at the analyzer

---

## 0. Prerequisites (once)

- 🖥️ Bridge deployed at `~/nizomed/device-bridge` and running under PM2
  (`pm2 status` shows `device-bridge` online).
- 🖥️ ehr-servers running (offline EHR on port **6090**).
- 🔬 Analyzer already talks to the bridge in log-only mode (you have a real
  capture in `logs/…`). If not, do the capture first (see `README.md`).

---

## 1. Point the bridge at the EHR ingest 🖥️

Edit `~/nizomed/device-bridge/.env`:

```ini
EHR_INGEST_URL=http://127.0.0.1:6090/lab/device-results/ingest
SECURITY_KEY=<paste the SAME value as ehr-servers SECURITY_KEY>
```

Get the ehr-servers key (must match exactly, or ingest returns 403):

```bash
# whichever your setup uses:
doppler secrets get SECURITY_KEY --plain     # if Doppler
grep -E '^SECURITY_KEY=' ~/nizomed/ehr/.env  # if a plain .env on the backend clone
```

> `127.0.0.1`, never `localhost` (offline DNS rule). Leave `EHR_INGEST_URL`
> unset to fall back to log-only mode.

---

## 2. Restart both services 🖥️

```bash
cd ~/nizomed/device-bridge && npm run restart:production
cd ~/nizomed/ehr           && pm2 restart offline-ehr     # or your ehr-servers process name
pm2 status                                                # both online
```

(Restarting ehr-servers loads the new endpoints, schema fields, and mounts.)

---

## 3. Map the test to the machine 💻

EHR → **Laboratory → Test Registration** → find the CBC test
(**FULL BLOOD PICTURE | FBP | CBC**) → click **Machine**:

1. Pick **Genrui KT-6610** from the machine dropdown.
2. For each of your parameters, choose the matching machine parameter
   (e.g. *WBC Count (Total)* → `WBC — White Blood Cell`).
3. Leave manual-only params as "— not from machine —".
4. **Save Mapping** (coverage chip shows how many are mapped).

Do this once per test per facility. Unmapped machine values simply won't post.

---

## 4. Smoke-test the pipe (no patient needed) 🖥️

Confirm the bridge → EHR link works end-to-end using a made-up accession — it
will land in the **unmatched** queue (expected), proving the pipe is live:

```bash
node ~/nizomed/device-bridge/tools/simulate.js --file \
  ~/nizomed/device-bridge/tools/fixtures/genrui-kt6610-sample.hl7
pm2 logs device-bridge --lines 20      # look for:  ingest → 200 {"status":"unmatched",...}
```

- `ingest → 200` = bridge reached the EHR and the key is correct. ✅
- `403` = `SECURITY_KEY` mismatch — fix step 1.
- `ECONNREFUSED` = ehr-servers not up / wrong port.

Then 💻 check **Laboratory → Machine Results** — the simulated result appears
there. **Dismiss** it (it's a test).

---

## 5. Real end-to-end run 🔬💻

1. 💻 Bill a CBC for a test patient → **Sample Collection** → collect →
   note the **accession number** (Sample ID).
2. 🔬 Run the sample, entering that **accession number** as the analyzer's
   **Sample ID**. Validate the result so it transmits.
3. 💻 Open the patient's **Results Entry** for CBC — the mapped values are
   filled in, each showing a **"Machine · locked"** badge (staff can't edit).
4. A lab user still **authenticates** the result as usual.

### If it lands in "Machine Results" instead
That means the Sample ID didn't match an open order. Go to
**Laboratory → Machine Results**, find the entry, and:
- **wrong/blank Sample ID** → type the correct accession → **Attach**.
- reason says **"Test not mapped"** → finish step 3 (mapping) → **Attach**.
- a control/QC run → **Dismiss**.

---

## 6. Verify & sign off ✅

- [ ] `pm2 logs device-bridge` shows `ingest → 200 {"status":"ok",...}` for a real run.
- [ ] Results appear in Results Entry with the locked badge.
- [ ] A tech confirms they cannot edit a machine value.
- [ ] Live queue (Sample Collection / Patient Queue) updates without refresh.
- [ ] Unmatched flow works (attach + dismiss).

Then schedule the NHIF final UAT for findings **#1** (device integration),
**#7** (direct transmission), and **#6** (result locking).

---

## Troubleshooting quick table

| Symptom | Likely cause | Fix |
|---|---|---|
| `403` on ingest | `SECURITY_KEY` mismatch | Make bridge `.env` key == ehr-servers `SECURITY_KEY` |
| `ECONNREFUSED` on ingest | ehr-servers down / wrong port | `pm2 status`; confirm port 6090 |
| Everything goes to "unmatched", reason `no-mapping` | Test not mapped | Map the test (step 3) |
| Everything `no-order` | Tech isn't typing the accession as Sample ID | Fix SOP; use Attach meanwhile |
| Machine shows "Network communication failure" | Wrong LIS IP/port or cabling | LIS IP = server IP, port 9100; check RJ45 + subnet |
| No connection in `pm2 logs` at all | Machine not reaching bridge | `ping` machine from server; firewall 9100 to LAN |
