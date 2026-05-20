# Production Server Lockdown — 2026-05-20

**Scope:** wavemax.promo / rundberglaundry.com / atxwashdryfold.com / atxwashateria.com on origin `158.62.198.7`.
**Trigger:** Rick — "go deep on pen testing our prod server… lock it down hard… no auditor finds anything worth more than a footnote."
**Status:** Phase 0 (recon) complete. Phase 1+ awaits gating confirmation.
**Method:** Three parallel passes — whitebox SSH audit, application-config audit, blackbox external probe (~45 requests, no exploitation). Cross-confirmed all critical findings from at least two of the three vantages.

---

## Headline

The kernel reboot pending since 2026-04-30 has **already been completed** today (uptime 3h 10m). Pending task #49 closes on its own.

Two findings rise to **CRITICAL** at the network/edge layer; the rest are mostly mediums/lows that fit a methodical hardening pass.

| Severity | Count |
|:---|:---:|
| Critical | **1** |
| High | **8** |
| Medium | **17** |
| Low | **15** |
| Info | 9 |

---

## CRITICAL

### C-1. Mailcow admin UI publicly reachable on origin IP (8080 + 8443)

**Confirmed by:** whitebox SSH audit + external blackbox curl from outside.

**External evidence:**
```
curl -kI https://158.62.198.7:8443/ -H 'Host: mail.wavemax.promo'
→ HTTP/2 200, mailcow login page served
```

**Root cause:** Docker manages its own `iptables` DNAT chain (`DOCKER` table, applied before UFW `filter`). UFW shows ports 8080/8443 as denied, but Docker's DNAT rules `tcp dpt:8080 to:172.22.1.5:8080` route public traffic to the mailcow container regardless. `DOCKER-USER` chain is empty.

**Attack chain:** Origin IP recoverable via public DNS (the `mail.*` MX records + SPF `ip4:158.62.198.7` declarations expose it). Once known, the admin login is one curl away.

**Why this is the #1 fix:** Cloudflare WAF + edge rate-limiting + bot management are completely bypassed for the mailcow admin surface. Brute-force / credential-stuffing / vuln exploitation on mailcow admin are wide open.

**Fix options (pick one):**

| Option | Pros | Cons |
|:---|:---|:---|
| **(A)** Bind mailcow to `127.0.0.1` in `mailcow.conf` (`HTTP_BIND=127.0.0.1`, `HTTPS_BIND=127.0.0.1`); rely on the existing `mail.<domain>` nginx reverse-proxy on `localhost:8443`. | Clean, minimal change; preserves admin access via Cloudflare → nginx → mailcow. | Requires brief mailcow recreate; admin access requires DNS + nginx alive. |
| (B) `iptables -I DOCKER-USER -i eth0 -p tcp -m multiport --dports 8080,8443 -j DROP` | Quick. | Lost on docker daemon restart; brittle. |
| (C) UFW + Cloudflare-tunnel only access to mailcow | Strong. | More moving parts. |

**Recommended:** **(A)**. Same outcome, simplest config.

---

## HIGH (8)

### H-1. Origin IP accepts direct connections on 80/443 — Cloudflare bypass

**Confirmed externally:** `curl -skI https://158.62.198.7/ -H 'Host: rundberglaundry.com'` returns the full app response with `server: nginx/1.18.0 (Ubuntu)`.

**Impact:** Cloudflare's WAF, bot fight mode, DDoS protection, edge rate-limiting — all bypassed for any attacker who reaches the origin IP directly.

**Fix:** UFW `allow from <Cloudflare IPs> to any port 80,443 proto tcp` + `deny 80,443`. The CF IP list lives at `https://www.cloudflare.com/ips/` and is already embedded in `/etc/nginx/conf.d/cloudflare-real-ip.conf`. Optional escalation: enable Cloudflare **Authenticated Origin Pulls** (mTLS) and reject non-CF TLS on the origin.

**Side effect:** breaks direct `curl` testing from non-Cloudflare IPs (us, devs). Whitelist Rick's WSL (70.114.167.145) explicitly.

### H-2. Stale `.env*` files world-readable

`/var/www/wavemax/.env` (644 root:root) and `/var/www/wavemax/wavemax-affiliate-program.OLD/.env.backup` (644) likely contain old MongoDB URI + JWT_SECRET + ENCRYPTION_KEY + SESSION_SECRET + CSRF_SECRET + OAuth client secrets.

**Treat as compromised.** Two-step:
1. **Rotate** every secret that may have been in those files: `JWT_SECRET`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `CSRF_SECRET`, MongoDB Atlas password, OAuth client secrets, DocuSign integration key/secret, email passwords.
2. **Archive + delete** the `.OLD/` directory after offsite tarball copy.

**Critical caveat for `ENCRYPTION_KEY`:** the AES-256-GCM key encrypts at-rest data (paypalEmail / venmoHandle / OAuth tokens / W-9 docs). Rotation requires a decrypt-with-old-key + re-encrypt-with-new-key migration. Affiliate count is small enough (~50 system-wide) that this is feasible in a single script run, but it's a coordinated operation — not just a `.env` edit.

### H-3. Origin IP leaked via DNS

`mail.<domain>` A records point directly to `158.62.198.7` (Cloudflare doesn't proxy SMTP), and SPF advertises `ip4:158.62.198.7`. Together, the origin IP is trivially findable.

**Long-term fix:** move mail to a separate host / IP. **Short-term fix:** combine with H-1 — making the origin IP useful only to Cloudflare reduces the value of the leak.

### H-4. SSH `PasswordAuthentication yes` + `PermitRootLogin yes`

`/etc/ssh/sshd_config` doesn't override defaults. fail2ban is catching 87 currently-banned brute-force IPs (sshd jail). Three pubkeys are already installed — no business reason to keep password auth.

**Fix:** drop `/etc/ssh/sshd_config.d/00-hardening.conf`:
```
PasswordAuthentication no
PermitRootLogin prohibit-password
ClientAliveInterval 300
ClientAliveCountMax 2
MaxAuthTries 3
LoginGraceTime 30s
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com,umac-128-etm@openssh.com
KexAlgorithms curve25519-sha256@libssh.org,curve25519-sha256,diffie-hellman-group16-sha512
```
Test new session **before** killing the current one. Existing keys: `service` (RSA-2048), `support` (ED25519), `rick@70.114.167.145` (ED25519).

**Side question — audit the `service` and `support` keys**, comments are vague and provenance isn't documented. If not actively needed, revoke.

### H-5. Affiliate / Customer have no per-account login lockout (APP-012)

Only the per-IP `authLimiter` (5/15min) protects against credential-stuffing. The Administrator model has proper lockout at 5 attempts / 2-hour lock — Affiliates and Customers should mirror it.

**Fix:** add `loginAttempts` + `lockUntil` fields to `Affiliate` + `Customer` models, replicate Administrator's check-and-increment logic in `authController.affiliateLogin` + `customerLogin`. TDD applies.

### H-6. Rate limiter per-worker, not cluster-shared (APP-005, known-known)

Comment in `server/middleware/rateLimiting.js:18-37` documents this — `rate-limit-mongo` was removed for dep-vuln reasons. Effective limit is `max × cluster_workers`. 4-core = 4× designed limits.

**Fix:** install `@express-rate-limit/mongo-store` (maintained replacement) or add Redis to the stack and use `rate-limit-redis`. `createMongoStore` stub is already there for a one-file swap.

### H-7. APP-004: null-origin CORS bypass

`if (!origin) return callback(null, true);` in `server.js:389` admits any request lacking an `Origin` header (curl, server-to-server) with `credentials: true`. Mostly benign because endpoints require JWT, but `/api/csrf-token` (no auth) returns CSRF tokens to anyone without an Origin.

**Fix:** change to `callback(null, false)` for null-origin; document any legitimate server-to-server caller that needs explicit allowlisting elsewhere.

### H-8. APP-008: JWT verify doesn't pin algorithm

`jwt.verify(token, secret)` without `{ algorithms: ['HS256'] }`. `jsonwebtoken@9` rejects `alg: none` by default, so currently safe — but a future library downgrade or default change reopens algorithm-confusion. Zero-cost belt-and-suspenders.

---

## MEDIUM (17)

### M-1. `ubuntu` user has `NOPASSWD:ALL` sudo + default shell

`/etc/sudoers.d/90-cloud-init-users`: `ubuntu ALL=(ALL) NOPASSWD:ALL`. Never logged in per `lastlog`. With password SSH still on, this is a chained root-via-`ubuntu`-credential-guess risk.

**Fix:** `usermod -s /usr/sbin/nologin ubuntu` and drop `NOPASSWD` from sudoers (or remove `ubuntu` from sudoers altogether if not used).

### M-2. PM2 runs as root (task #48)

Known. Re-platform pm2 to a `wavemax` system user.

### M-3. Unknown root login from `83.136.182.60` on 2026-05-04

`lastlog`: `root pts/2 83.136.182.60 Mon May 4 ...`. **Need to confirm whose IP this is.** If not Rick's, this is an incident — investigate immediately, rotate credentials, check `journalctl _COMM=sshd` and `~/.bash_history` and `last` for the full session.

### M-4. PM2 connected to pm2.io cloud

Telemetry shipping outside the box. Confirm intentional + that the pm2.io account has MFA on.

### M-5. Nginx hardening misc

- `server_tokens off;` not set (reveals `nginx/1.18.0` in `Server:` header).
- No `ssl_stapling on;` anywhere — OCSP stapling disabled.
- `nginx.conf` lists `ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3` at the http block (overridden by per-site to TLS 1.2+, but sloppy).
- `/etc/nginx/sites-enabled/default` symlink still present.

### M-6. SSH weak ciphers + no idle timeout

`hmac-sha1` MAC still acceptable; `ClientAliveInterval=0`. Addressed alongside H-4.

### M-7. APP-009: Session cookie no `__Host-` prefix

`wavemax.sid` should be `__Host-wavemax.sid` in production. CSRF cookie already correctly `__Host-x-csrf`.

### M-8. APP-010: Operator PIN plain-string compare + plaintext in env

`if (pinCode !== configuredPin)` against `process.env.OPERATOR_PIN`. Single facility-wide PIN; no per-operator credential.

**Short-term:** `crypto.timingSafeEqual`. **Long-term:** per-operator hashed PIN in the `Operator` model (model already tracks `loginAttempts`).

### M-9. APP-011: Operator IP allowlist trusts raw X-Forwarded-For[0]

`server/controllers/authController.js:286-294` reads raw `X-Forwarded-For` and takes `[0]`. With `app.set('trust proxy', 1)` already configured, `req.ip` is already normalized — use that instead.

### M-10. APP-013: Password reset reveals user existence

`/api/v1/auth/forgot-password` 404s when email not registered. Should 200 with generic "if account exists, email sent" regardless.

### M-11. APP-014: `socialToken` JWT in redirect URL query parameter

OAuth provider access tokens embedded in JWT → query string → logs / browser history / Referer. Already partially fixed for popup flow (SEC H-3); non-popup path still uses query string. Move to httpOnly cookie or POST-back.

### M-12. CSP weakening on `.php` / API paths

Helmet CSP middleware adds `'unsafe-inline'` to `script-src` for non-standard routes (legacy-PHP pattern). Defense-in-depth: remove the conditional. Tracks against task #53.

### M-13. 302 catch-all preserves request path

Unmatched routes on franchise domains 302 to `https://www.wavemaxlaundry.com<full-path>`. Phishing-friendly: `https://rundberglaundry.com/login-corporate` → `https://www.wavemaxlaundry.com/login-corporate`. Return 404 for unmatched, or strip to root.

### M-14. nginx default welcome page on port 80 for unknown Host

Direct `curl http://158.62.198.7/ -H 'Host: x.example.com'` returns nginx default. Fingerprintable.

**Fix:** explicit default vhost returning `444` (drop) or `421 Misdirected Request`.

### M-15. `rundberglaundry.com` no registrar transfer-lock

The other two laundry domains have `clientTransferProhibited`; rundberglaundry.com doesn't. Lock at Ultahost.

### M-16. APP-002: Referrer-Policy `same-origin` → `strict-origin-when-cross-origin`

Matches the handbook's stated intent; smaller info-leak surface for same-origin Referer headers in server logs.

### M-17. APP-003: Missing COOP header

`Cross-Origin-Opener-Policy: same-origin-allow-popups` — preserves OAuth popup messaging while preventing reverse `window.opener` abuse.

---

## LOW (15)

L-1. No auditd installed (no forensic coverage of `keys/`, `.env`, `/etc/ssh`, `/etc/nginx`). Recommend `apt install auditd` + baseline ruleset.
L-2. No `pm2-logrotate` module — `~/.pm2/logs/wavemax-*.log` grow unbounded.
L-3. ~24 stale `linux-image-*` packages (cleanup recommended).
L-4. Sysctl tweaks: enable `log_martians`, disable `send_redirects`, consider `tcp_timestamps=0`. (`tcp_syncookies` + `accept_redirects=0` already OK.)
L-5. `/tmp` not separate mount. Quick fix: tmpfs bind-mount with `nosuid,nodev,noexec`.
L-6. Nginx access-log retention only 3 days / max 50M. Raise for incident forensics.
L-7. `/etc/letsencrypt/live/runberglaundry.com/` (typo) has a working cert — confirm intentional or remove.
L-8. systemd default target = `graphical.target` (should be `multi-user.target` on a server).
L-9. No CAA records on any zone. Add `CAA 0 issue "letsencrypt.org"` and `CAA 0 issue "pki.goog"`.
L-10. DNSSEC unsigned on all 4 zones. Free one-click enable in Cloudflare.
L-11. OCSP stapling disabled on 3 of 4 domains (CF toggle).
L-12. APP-001: `'unsafe-inline'` remains in `style-src` (documented engineering trade-off; CSS-injection threat materially weaker than JS; per project memory).
L-13. APP-006: `apiLimiter` skips `req.user.role === 'admin'` — dead-but-misleading code (no role 'admin' exists in the system; correct role is `administrator`).
L-14. APP-007: `RELAX_RATE_LIMITING` evaluated at module-load time. Add startup assertion that logs loud warning if `RELAX_RATE_LIMITING=true && NODE_ENV=production`.
L-15. No offsite copy of `/root/recover/mongodb-backups/`. Atlas itself has continuous backup; local snapshots are disk-only.

---

## Recommended phasing

### Phase 1 — Zero-disruption quick wins (deploy as a single diff)

These are application code + nginx config changes, no service touches needed beyond `pm2 reload` and `nginx -s reload`. **Safe to run today.**

- APP-002 referrer-policy → `strict-origin-when-cross-origin` *(M-16)*
- APP-003 COOP header `same-origin-allow-popups` *(M-17)*
- APP-007 startup assertion on `RELAX_RATE_LIMITING + production` *(L-14)*
- APP-008 JWT verify pin algorithms `['HS256']` *(H-8)*
- APP-009 session cookie name `__Host-wavemax.sid` *(M-7)*
- APP-013 password-reset uniform 200 response *(M-10)*
- APP-010 timingSafeEqual on operator PIN *(M-8, short-term half)*
- APP-011 use `req.ip` in operator IP-allowlist *(M-9)*
- APP-006 remove dead `req.user.role === 'admin'` skip *(L-13)*
- nginx `server_tokens off`, remove `default` symlink, `ssl_stapling on`, default vhost → 444 *(M-5, M-14)*
- 302-catch-all returns 404 / root-strip *(M-13)*
- CAA records on all 4 zones, DNSSEC enabled *(L-9, L-10)*

### Phase 2 — Network edge (requires confirmation)

- **C-1: Mailcow bind-to-loopback** — brief mailcow recreate.
- **H-1: UFW restrict 80/443 to Cloudflare IPs** — brief outage risk if CF list is stale; rollback ready.
- **H-3: long-term** mail-on-separate-host (out of scope today; recorded).

### Phase 3 — SSH hardening (sequential, careful)

- **H-4: SSH password-off + root prohibit-password + idle timeout + strong KEX/cipher/MAC** — test new session before killing current.
- Audit `service` and `support` pubkeys; revoke if not in use.
- **M-1: lock `ubuntu` shell + drop `NOPASSWD`**.
- **M-3: investigate `83.136.182.60` root login.**

### Phase 4 — App-layer high-value structural fixes

- **H-5: per-account lockout** for Affiliate + Customer (TDD).
- **H-6: shared-store rate limiter** (`@express-rate-limit/mongo-store`).
- **H-7: null-origin CORS = false**.
- **M-12: CSP unsafe-inline cleanup** (folds in #53).
- **M-11: socialToken JWT** — out of query-string.

### Phase 5 — Secret rotation + cleanup (high-coordination)

- **H-2 step 1:** archive + delete `.OLD/`.
- **H-2 step 2:** rotate JWT_SECRET, SESSION_SECRET, CSRF_SECRET, OAuth secrets (forces all sessions logout).
- **H-2 step 3:** rotate ENCRYPTION_KEY — requires decrypt-then-re-encrypt of at-rest fields via migration script. Schedule with maintenance window.
- MongoDB Atlas password rotation.

### Phase 6 — Long-tail hardening

- M-2: pm2 non-root user (task #48).
- L-1: auditd baseline.
- L-2: `pm2-logrotate`.
- L-3-L-8 misc system hygiene.
- M-15: rundberglaundry.com registrar lock.
- M-4: pm2.io decision (disable or MFA-confirmed-and-kept).

### Phase 7 — Re-attack + audit-grade report close-out

Re-run all three audits with the same methodology. Document the delta. Produce final scoreboard counsel/external-auditor can cite.

---

## Methodology + chain of custody

- **Whitebox SSH audit:** `sudo ssh wavemax-promo`, root-side, read-only commands only. No remote modifications. Key fingerprints printed as SHA256, env values redacted.
- **Application-config audit:** local repo read-through; coverage list at the top of the application-audit report.
- **External blackbox:** ~45 requests total from 70.114.167.145 (whitelisted WSL). No exploitation, no DoS, no credential attempts. Raw outputs in `/tmp/blackbox-2026-05-20/` on the audit host.

---

## Open questions for Rick (before Phase 1)

1. **`83.136.182.60` root login on 2026-05-04** — yours or not? If not, incident.
2. **C-1 mailcow lockdown** — confirm option A (bind to loopback, rely on `mail.<domain>` nginx proxy).
3. **H-2 secret rotation scope** — full key rotation now (JWT/SESSION/CSRF/OAuth + scheduled ENCRYPTION_KEY) or archive-only with confidence the keys haven't been read?
4. **M-4 pm2.io cloud** — intentional and MFA-protected? Or disable?

---

*Compiled 2026-05-20. Inputs: three parallel audit passes, all evidence preserved.*
