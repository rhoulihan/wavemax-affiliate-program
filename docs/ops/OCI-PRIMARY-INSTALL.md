# OCI Ampere — Install Runbook (WaveMAX web app)

> Repeatable runbook for standing up an **OCI Phoenix Ampere** box as a web-app node,
> co-located with the Oracle ADB. The web tier runs **dual-AZ active-active** — oci1
> `161.153.71.201` (PHX-AD-2) + oci2 `144.24.4.202` (PHX-AD-1), behind a Cloudflare LB
> (round-robin). Run this runbook once per box. Captures the real gotchas from the
> 2026-05-23 bare-metal build. **Living doc** — sections marked TODO are completed as
> the build-out proceeds.

## Why OCI Phoenix
Co-locate the **Node web app** with the Oracle ADB (`us-phoenix-1`) for sub-ms DB
latency (the app is DB-chatty). Both OCI boxes are app-only; **Ultahost is mail-only**
(its web tier is off) and stays single-homed as the SMTP host.

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
- The four crypto secrets **must be byte-identical** across hosts (`JWT_SECRET`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `CSRF_SECRET`) + same `MONGODB_URI`, or sessions/JWTs/encrypted fields break when the LB sends a request to the other box.
- **Mail relay:** prod mail is sent **through the Ultahost box by IP**, but the TLS `servername` **must** be `mail.crhsent.com` (that's the cert CN) — pinning it elsewhere fails the handshake silently. Match the live `.env` mail vars; don't substitute defaults.

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
Confirmed 2026-05-23: 4 cluster workers online, `Connected to MongoDB`, `Oracle cursor diagnostics attached`. Startup also runs the default-account init (`scripts/setup/init-admin.js` + `init-defaults.js`, invoked from `server.js`) — idempotent, safe to repeat per box.
- **Health probe:** the app forces HTTPS, so plain HTTP redirects. Spoof the proxy header to test locally: `curl -H "X-Forwarded-Proto: https" http://localhost:3000/health` → `{"status":"UP",...}`. (`/api/health` path differs; `/health` is the simple liveness route.)
- **Direct ADB reachability test** (isolates ACL from app): `openssl s_client -connect <db-host>:27017 -servername <db-host>` → expect `Verify return code: 0 (ok)`.
- **Pre-existing finding (NOT OCI-specific):** `Cannot find module './server/services/dataRetentionService'` repeats in `error.log` — the file was deleted in `01645cd` but `server.js:161` still requires it; it's caught, so non-fatal, but the GDPR data-retention job never initializes. Present on the live Ultahost box too. Track + fix separately.

## 6. nginx + TLS (Cloudflare origin cert) — ✅ DONE
Don't hand-write the vhosts — **bundle the prod nginx tree and rewrite only the cert paths** (the one origin cert covers all 12 SANs, so every vhost uses it):
```bash
# on the leader (prod): tar the config tree (dereference symlinks with -h)
ssh prod 'tar -C / -chf - etc/nginx/snippets etc/nginx/conf.d/wavemax-gate.conf \
  etc/nginx/conf.d/00-stapling.conf etc/nginx/sites-available/crhsent.com \
  etc/nginx/sites-enabled/{atxwashateria.com,atxwashdryfold.com,runberglaundry.com,rundberglaundry.com,wavemax,crhsent.com} \
  etc/letsencrypt/options-ssl-nginx.conf etc/letsencrypt/ssl-dhparams.pem' > /tmp/nginx-bundle.tar
# on OCI: backup, extract, drop default site, rewrite LE->CF-origin cert paths
sudo cp -a /etc/nginx /etc/nginx.bak.$(date +%s); sudo mkdir -p /etc/letsencrypt /var/www/letsencrypt
sudo tar -C / -xf /tmp/nginx-bundle.tar; sudo rm -f /etc/nginx/sites-enabled/default
sudo sed -i -E 's#/etc/letsencrypt/live/[^/]+/fullchain.pem#/etc/ssl/cloudflare/origin.pem#g;
                s#/etc/letsencrypt/live/[^/]+/privkey.pem#/etc/ssl/cloudflare/origin.key#g' \
  /etc/nginx/sites-enabled/* /etc/nginx/sites-available/crhsent.com
sudo nginx -t && sudo systemctl reload nginx
```
- The `options-ssl-nginx.conf` + `ssl-dhparams.pem` are generic (not LE-specific) — copying them to the same `/etc/letsencrypt/` paths lets the `include`/`ssl_dhparam` lines work unchanged. The acme webroot `/var/www/letsencrypt` just needs to exist.
- **OCSP stapling:** CF origin certs have no OCSP responder — keep stapling OFF (already is, see `00-stapling.conf`); harmless behind CF anyway.
- **Verify with `--resolve` to localhost** (firewall not open yet). First hit of `/austin-tx/` may `000` on cold start (server-side reviews call warming) — re-probe. Confirmed 2026-05-23 byte-for-byte parity with prod: Austin `/`→200, `/charlotte-nc`→302 corporate, `www`→301 apex, `wavemax.promo`→301 rundberglaundry.

## 7. OCI security list: allow Cloudflare on 80/443 — TODO
Add ingress for 80/443 from the **Cloudflare IP ranges** so the CF Load Balancer/proxy can reach this origin (Cloudflare-only origin).

## 8. Mail — RESOLVED: stays single-homed on Ultahost
Mail did **not** move to OCI. Both hard OCI mail prereqs — outbound TCP 25 blocked by
default on every OCI tenancy, and FCrDNS/PTR requiring a reserved static IP — made an
active OCI mail node not worth it. **Ultahost remains the mail host.** The OCI app boxes
relay outbound through it (see §3: by IP, with TLS `servername` pinned to
`mail.crhsent.com`). No Mailcow on OCI.

## 9. Data replication — RESOLVED: handled by Oracle ADB, no DRBD
No DRBD. Both OCI boxes are stateless app nodes pointing at the same **Oracle ADB**
(Mongo API), which owns durability/replication; there's no local DB to mirror. HA is the
**Cloudflare LB round-robin** across the two AZs (no app-level failover arbiter needed).

## OCI operational caveats (learned)
- **Auth:** session token (`oci session authenticate`), ~1 h; refresh with `oci session refresh --profile DEFAULT` (re-auth if the refresh window lapsed). It expires mid-build — expect to refresh.
- **Free tier:** idle-reclamation risk (→ upgrade to **PAYG**, free within Always-Free limits, to exempt + ease capacity); **don't hard-STOP** the instance (capacity risk on restart; reboots are fine); launch capacity contention (retry loop).
- ARM is a non-issue for Node and Mailcow; the only ARM caveat is the rspamd cache on mail migration.
