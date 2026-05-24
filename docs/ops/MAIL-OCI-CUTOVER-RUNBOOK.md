# Mail → OCI Cutover Runbook

> Migrating live mail (Mailcow, 6 domains) from **Ultahost** (`158.62.198.7`, hostname `mail.crhsent.com`) to **OCI Ampere** (`161.153.71.201`, hostname `mx1.crhsent.com`).
> Status as of **2026-05-24**: data migrated + outbound relay validated end-to-end. The actual MX/`mail.*` flip is **GATED** on two Oracle service requests clearing. Nothing below changes live mail routing until "THE FLIP".

---

## 0. Current validated state (DONE — pre-flip)

| Item | State |
|:--|:--|
| OCI Mailcow installed | `/opt/mailcow-dockerized`, hostname `mx1.crhsent.com`, HTTP 8080 / HTTPS 8443 bound `127.0.0.1`, 16 containers up |
| Data restored to OCI | **6 domains, 9 mailboxes, 17 aliases, 6 DKIM keypairs** (from version-matched 2026-05b zstd backup). rspamd data skipped (x86→aarch64 arch mismatch — expected; DKIM lives in redis, not rspamd) |
| Outbound relay (OCI→Ultahost) | relayhost id=1 `158.62.198.7:587`, auth `no-reply@wavemax.promo`, assigned to all 6 domains. TLS policy override `encrypt` for `158.62.198.7[:587]`. **PROVEN**: OCI→Ultahost (TLS+SASL) → Gmail `status=sent 250 OK` |
| OCI SMTP cert | **self-signed snakeoil** (mailcow default) — must be replaced before THE FLIP (see §2) |
| App mail sending | still via Ultahost (`EMAIL_HOST=158.62.198.7:587`) — repoint to OCI at THE FLIP |

**Gating Oracle SRs (CSI 125694830):**
- PTR `161.153.71.201` → `mx1.rundberglaundry.com` — **#4-0002859947** (ACTIVE)
- PTR `161.153.71.201` → `mx1.crhsent.com` — **#4-0002859970** (ACTIVE) ← canonical PTR (matches HELO)
- Outbound port-25 unblock — **#CAM-266605** (ACTIVE)

The relay (OCI→Ultahost:587 authed) sidesteps BOTH the blocked outbound 25 and the missing PTR, so mail can flip to OCI for **inbound + queue** as soon as the **PTR** clears; outbound stays on the relay until **port-25** clears, then goes direct (§5).

---

## 1. DNS facts (Cloudflare-authoritative) — confirmed 2026-05-24

Per domain (crhsent.com shown; same pattern for the other 5):
- `MX crhsent.com` → `mail.crhsent.com` (pri 10)
- `A mail.crhsent.com` → **158.62.198.7** (Ultahost) ← the record THE FLIP repoints to OCI
- `A mx1.crhsent.com` → **161.153.71.201** (OCI) — PTR forward record, already live, DNS-only
- `TXT crhsent.com` (SPF) → `v=spf1 a mx ip4:158.62.198.7 ~all`
- `TXT dkim._domainkey.crhsent.com` → matches restored key (unchanged post-flip ✓)
- `TXT _dmarc.crhsent.com` → `v=DMARC1; p=quarantine; rua=mailto:admin@crhsent.com; pct=100`

**SPF survives both phases without edits:** during relay the Ultahost IP (`ip4:158.62.198.7`) is the visible sender (pass); after direct cutover, `mx` auto-covers OCI once `mail.*` A → `161.153.71.201` (pass). Optional belt-and-suspenders for direct phase: add `ip4:161.153.71.201`.

**DKIM needs no DNS change** — OCI signs with the same keys restored from Ultahost's redis.

---

## 2. Pre-flip: publicly-trusted SMTP cert for `mx1.crhsent.com`

OCI Mailcow presents a self-signed cert. A single-name cert for `mx1.crhsent.com` is sufficient — it's the HELO/PTR name postfix & dovecot present on 25/465/587/993/995 (the `mail.*` web vhosts on :443 use the Cloudflare origin cert, unrelated to SMTP).

**Not strictly required to flip.** Inbound mail uses *opportunistic* TLS — Gmail/Outlook/etc. accept a self-signed cert for delivery; a self-signed cert does **not** block inbound mail. A publicly-trusted cert only becomes mandatory if we publish **MTA-STS** or **DANE/TLSA**. So this is a quality upgrade, deferrable.

**HTTP-01 does NOT work here (confirmed 2026-05-24):** OCI's `:80` is firewalled at the OCI Security List to **Cloudflare IP ranges only** (web-origin hardening, task #92), but `mx1.crhsent.com` is — and must stay — **DNS-only** (it's the PTR/HELO name; can't be CF-proxied). So Let's Encrypt's validators can't reach `:80`. acme log: "Confirmed A record … but HTTP validation failed." A loopback→8080 acme-challenge nginx proxy was tried and reverted — the SL block defeats it regardless. Do **not** open `:80` to the world (undoes the CF-only origin posture).

**Use DNS-01 (Cloudflare).** Two designs (security tradeoff — pick per §"cert decision"):
- **(A, recommended) Issue off-host, push the cert in.** From a trusted box that already holds the CF token (the dev/WSL box), `acme.sh --issue --dns dns_cf -d mx1.crhsent.com`, then copy `fullchain`+`key` to OCI `/opt/mailcow-dockerized/data/assets/ssl/cert.pem`+`key.pem`, set `SKIP_LETS_ENCRYPT=y` in `mailcow.conf`, and `docker compose restart postfix-mailcow dovecot-mailcow nginx-mailcow`. Keeps the broad CF token **off** the internet-facing mail host. Renewal (~60d) is a recurring off-host task.
- **(B) acme.sh on OCI with a *scoped* CF token** (Zone:DNS:Edit on the 6 zones only). Auto-renews on-box, but a DNS-editing token then lives on the mail host. Only if (A)'s manual renewal is unacceptable.

Verify either way:
```bash
openssl s_client -connect 127.0.0.1:465 </dev/null 2>/dev/null | openssl x509 -noout -issuer
# issuer should be Let's Encrypt, NOT "O=mailcow"
```

---

## 3. Pre-flip: lower TTLs (do ~1h before THE FLIP)

Via Cloudflare API (token `~/.cf_api_token`), set TTL=120 on each `A mail.<domain>` record (6 domains) so the flip propagates fast. Records are DNS-only (gray cloud) — keep them gray (mail must not be proxied).

---

## 4. THE FLIP (inbound) — when PTR #4-0002859970 clears

Goal: OCI receives inbound mail for all 6 domains; outbound still via relay until §5.

1. **Final data sync** (catch mail/config delta since the 2026-05-24 restore):
   ```bash
   # On Ultahost: fresh backup
   cd /opt/mailcow-dockerized
   sudo MAILCOW_BACKUP_LOCATION=/opt/mailcow-backup ./helper-scripts/backup_and_restore.sh backup all --delete-days 3
   # transfer newest /opt/mailcow-backup/mailcow-* to OCI (scp via host, or pipe)
   # On OCI: restore (folder pick, "0"=all; rspamd auto-skips on arch mismatch)
   cd /opt/mailcow-dockerized && printf "1\n0\n" | sudo MAILCOW_BACKUP_LOCATION=/opt/mailcow-backup ./helper-scripts/backup_and_restore.sh restore
   ```
   NOTE: re-restoring re-imports the relayhost row too — re-verify relayhost id + the `tls_policy_override` rows survive, and re-run the password `UNHEX` fix if needed (§ Appendix A).
2. **Repoint inbound DNS** — Cloudflare: `A mail.<domain>` → **161.153.71.201** for all 6 domains (stay DNS-only/gray).
3. **Verify inbound on OCI**: send a test from an external account to a mailbox on each domain; confirm OCI postfix `status=sent`→dovecot and the message lands. `mail.*` MX now resolves to OCI.
4. **Repoint app mail** → OCI: set `EMAIL_HOST=161.153.71.201` (or `mx1.crhsent.com`) in the app `.env` on both nodes, `pm2 restart wavemax --update-env`. (OCI still relays the app's outbound through Ultahost until §5 — transparent.)
5. Leave Ultahost running as warm fallback (do not decommission yet).

Outbound during this window: OCI → Ultahost relay (already proven). FCrDNS holds because the final internet hop is from Ultahost (PTR-matched).

---

## 5. Direct outbound — when port-25 SR #CAM-266605 clears

1. Confirm OCI outbound 25 open: `nc -zv gmail-smtp-in.l.google.com 25` from OCI.
2. Confirm OCI PTR live: `dig -x 161.153.71.201 +short` → `mx1.crhsent.com.` (and forward matches).
3. **Drop the relay** so OCI sends direct:
   ```bash
   # OCI mailcow: unassign relayhost from domains, deactivate relayhost
   # (UI: Configuration→Routing, or SQL: UPDATE domain SET relayhost=0; UPDATE relayhosts SET active=0 WHERE id=1;)
   ```
4. Optional SPF hardening: add `ip4:161.153.71.201` to each domain's SPF TXT.
5. **Verify FCrDNS + auth**: send to `check-auth@verifier.port25.com` (or Gmail) from each domain; confirm **SPF=pass, DKIM=pass, DMARC=pass**, and HELO=`mx1.crhsent.com` matches PTR.
6. Remove the `tls_policy_override` rows for `158.62.198.7[:587]` (no longer needed).

---

## 6. Rollback (any stage)

- **Inbound:** Cloudflare `A mail.<domain>` → **158.62.198.7** (all 6). Propagates in ≤TTL. Ultahost still authoritative for mailboxes (kept warm).
- **App mail:** revert `.env` `EMAIL_HOST=158.62.198.7`, `pm2 restart wavemax --update-env`.
- **Outbound:** re-activate relayhost (`UPDATE relayhosts SET active=1; UPDATE domain SET relayhost=1;`).

---

## Appendix A — relay re-stage (if a re-restore wipes it)

```sql
-- relayhost (cleartext pw column; or use mailcow API add/relayhost)
INSERT INTO relayhosts (hostname,username,password,active)
  VALUES ('158.62.198.7:587','no-reply@wavemax.promo', UNHEX('<hex of EMAIL_PASS>'), 1);
UPDATE domain SET relayhost = (SELECT id FROM relayhosts WHERE hostname='158.62.198.7:587');
-- TLS policy override (bare-IP on 587 otherwise resolves to no-TLS via postfix-tlspol)
INSERT INTO tls_policy_override (dest,policy,parameters,active) VALUES
  ('158.62.198.7','encrypt','',1), ('158.62.198.7:587','encrypt','',1);
```
mailcow API note: host-side curl is seen as source IP `172.22.1.1` — an API key's `allow_from` must include it. The `api` table column is `access` (enum ro/rw).

## Appendix B — incident reference (2026-05-24)

The 2026-05b update on Ultahost broke live mail ~25 min: rspamd 3.14.3 OOM-looped against the 256 MB cap in `docker-compose.override.yml` → postfix milter-rejected all mail `451`. Fix: raised rspamd `mem_limit 256m→1024m / memswap→1536m`, recreated rspamd. **Apply the same higher caps to OCI's override if one is added there.** Small hosts: re-check caps after every mailcow version bump. See `tasks/lessons.md`.
