# OCI Ampere Primary — Install Runbook (WaveMAX full stack)

> Repeatable runbook for standing up the **OCI Phoenix Ampere** box as the full-stack
> **primary** (app + Mailcow + DRBD), co-located with the Oracle ADB. Captures the
> real gotchas from the 2026-05-23 bare-metal build. **Living doc** — sections marked
> TODO are completed as the migration proceeds.

## Why OCI Phoenix
Co-locate the **Node web app** with the Oracle ADB (`us-phoenix-1`) for sub-ms DB
latency (the app is DB-chatty). Mailcow uses its own MySQL (ADB-independent) but rides
along on the same box. Ultahost (Dallas) becomes the HA secondary / DRBD peer behind Cloudflare.

## 0. Provisioning (OCI CLI, session-token auth)
- Shape **`VM.Standard.A1.Flex` (Ampere ARM64)**, 4 OCPU / 24 GB, Ubuntu 22.04, 50 GB boot, public IP.
- Networking: compartment `wavemax-prod`, VCN `10.0.0.0/16`, public subnet `10.0.1.0/24`, internet gateway, route `0.0.0.0/0 → IGW`, security list (SSH :22 from admin IP only).
- **GOTCHA — free Ampere capacity:** Phoenix frequently returns **`Out of host capacity`** across all ADs. Use a **retry loop** (try all 3 ADs every ~90 s); we got it on round 1 on a non-AD-1 AD.
- **GOTCHA — paid x86 on Free Tier:** a `VM.Standard.E4.Flex` launch fails with **`Invalid ratio of memory in GB to OCPUs ... Valid ratio range: 0 – 0`** — this is a **0 service limit** (Free-Tier account), *not* a real parameter error. Use Ampere, or upgrade to Pay-As-You-Go.

## 1. Base packages (ARM64 — all clean)
```bash
sudo apt-get update -qq
sudo apt-get install -y git nginx build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -   # NodeSource has arm64
sudo apt-get install -y nodejs
sudo npm install -g pm2
```
Verified: Node v20.20.2, npm 10.8.2, pm2 7.0.1, nginx 1.18 — no ARM issues.

## 2. App code + deps
```bash
sudo mkdir -p /var/www/wavemax && sudo chown $USER /var/www/wavemax
git clone https://github.com/rhoulihan/wavemax-affiliate-program /var/www/wavemax/wavemax-affiliate-program  # public repo
cd /var/www/wavemax/wavemax-affiliate-program && npm ci      # 520 pkgs, clean on aarch64
```

## 3. Environment (.env)
Relay from the existing box **host-to-host so secrets never hit a terminal/log**:
```bash
sudo ssh wavemax-promo 'cat /var/www/wavemax/wavemax-affiliate-program/.env' \
  | ssh -i ~/.ssh/oci_wavemax ubuntu@<OCI_IP> 'cat > /var/www/wavemax/wavemax-affiliate-program/.env && chmod 600 .../.env'
```
- The four crypto secrets **must be byte-identical** across hosts (`JWT_SECRET`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `CSRF_SECRET`) + same `MONGODB_URI`, or sessions/JWTs/encrypted fields break on failover.
- Set **`RUN_BACKGROUND_JOBS=false`** on every non-leader instance (only the single job-leader runs cron, or payment/reminder jobs double-execute).

## 4. ★★ GOTCHA: ADB Access Control List (the #1 bare-metal blocker)
**Symptom:** the app crash-loops immediately —
```
MongoNetworkError: Client network socket disconnected before secure TLS connection was established
  ... host: '...adb.us-phoenix-1.oraclecloudapps.com', port: 27017, code: 'ECONNRESET'
```
**Cause:** the ADB's **network ACL allow-lists source IPs**; a new host's egress IP is **reset pre-TLS** until it's added.
**Fix:** add the new host's egress IP to the ADB ACL —
> Console → **Autonomous Database → (DB) → Network → Access control list → Edit → Add** the IP → Save.
> **APPEND — keep all existing entries** (e.g. the old box's IP) or you cut off the live site. (CLI: `oci db autonomous-database update --autonomous-database-id <ocid> --whitelisted-ips '[<existing...>, "<new-ip>"]'` — pass the *full* list; it replaces.)
**Find the egress IP** the ADB sees: `curl ifconfig.me` on the box (for an OCI instance with a public IP it's that public IP).

## 5. Start the app (after the ACL is fixed)  — ✅ DONE
```bash
cd /var/www/wavemax/wavemax-affiliate-program
pm2 delete wavemax 2>/dev/null; pm2 start ecosystem.config.js   # clean slate clears any crash-loop counter
pm2 save && pm2 startup    # boot persistence (TODO: run the printed sudo line)
```
**Verify Mongo** — the success line goes to Winston (`logs/combined.log`), *not* pm2 stdout:
```bash
grep -E "Connected to MongoDB|Server running" logs/combined.log | tail
```
Confirmed 2026-05-23: 4 cluster workers online, `Connected to MongoDB`, `Oracle cursor diagnostics attached`, `Background jobs disabled` (correct — Ultahost stays the job leader).
- **Health probe:** the app forces HTTPS, so plain HTTP redirects. Spoof the proxy header to test locally: `curl -H "X-Forwarded-Proto: https" http://localhost:3000/health` → `{"status":"UP",...}`. (`/api/health` path differs; `/health` is the simple liveness route.)
- **Direct ADB reachability test** (isolates ACL from app): `openssl s_client -connect <db-host>:27017 -servername <db-host>` → expect `Verify return code: 0 (ok)`.
- **Pre-existing finding (NOT OCI-specific):** `Cannot find module './server/services/dataRetentionService'` repeats in `error.log` — the file was deleted in `01645cd` but `server.js:161` still requires it; it's caught, so non-fatal, but the GDPR data-retention job never initializes. Present on the live Ultahost box too. Track + fix separately.

## 6. nginx + TLS (Cloudflare origin cert) — TODO
Replicate the Ultahost server blocks; nginx `crhsent.com` root → repo `crhsent/`; install the Cloudflare Origin Certificate; proxy 443 → `localhost:3000`.

## 7. OCI security list: allow Cloudflare on 80/443 — TODO
Add ingress for 80/443 from the **Cloudflare IP ranges** so the CF Load Balancer/proxy can reach this origin (mail ports 25/465/587/993/995 when Mailcow lands).

## 8. Mailcow on ARM — TODO
Docker + `mailcow-dockerized` (multi-arch, ARM-native since 2024). Migrate data from Ultahost via backup/restore — **do NOT copy the rspamd cache** (architecture-specific; let it rebuild).

## 9. DRBD replication to Ultahost — TODO
Loop-file backing device on each box (no extra disk/repartition); DRBD active/passive; **Cloudflare as the failover arbiter** (see `HA-FAILOVER-PLAN.md`).

## OCI operational caveats (learned)
- **Auth:** session token (`oci session authenticate`), ~1 h; refresh with `oci session refresh --profile DEFAULT` (re-auth if the refresh window lapsed). It expires mid-build — expect to refresh.
- **Free tier:** idle-reclamation risk (→ upgrade to **PAYG**, free within Always-Free limits, to exempt + ease capacity); **don't hard-STOP** the instance (capacity risk on restart; reboots are fine); launch capacity contention (retry loop).
- ARM is a non-issue for Node and Mailcow; the only ARM caveat is the rspamd cache on mail migration.
