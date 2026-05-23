# HA Phase 1 — Web tier active/active (implementation spec)

> Companion to [`HA-FAILOVER-PLAN.md`](./HA-FAILOVER-PLAN.md). This is the detailed,
> lowest-risk first step: two boxes serving the web app behind a Cloudflare Load
> Balancer. **No Mailcow/DRBD in this phase** (that's Phase 2–3).

## Goal & why it's safe to do first
Stand up a **second VPS** running the identical web stack (nginx + Node/PM2), put both
behind a **Cloudflare Load Balancer** (round-robin + cookie session affinity + `/health`
monitor). If either box's app dies, web traffic continues on the other with **no
user-visible impact** — because sessions, rate-limits, and all data live in **shared
Oracle ADB**, so any box can serve any user mid-session. The app is effectively
stateless; there's **no DRBD, no split-brain surface**, and it's **instantly reversible**
(point the hostname's DNS back at one box).

## Prerequisites
- **Box 2 provisioned** — Ultahost VPS Professional, same OS (Ubuntu 22.04 / kernel 5.15), ideally a **different DC** than box 1. (No RAM upsize — current tier verified sufficient.)
- **Cloudflare Load Balancing** add-on enabled on the relevant zone(s): `rundberglaundry.com`, `crhsent.com`, `wavemax.promo` (+ `atxwashdryfold.com`, `atxwashateria.com`, `runberglaundry.com` if separate zones).

## Step 1 — Provision & harden box 2 to parity
- Install Node 20, nginx, PM2, git (match box 1 versions/layout).
- **Apply the full prod-server lockdown baseline** already on box 1 before box 2 is internet-facing: SSH hardening, **Cloudflare-only origin firewall** (allow 80/443 only from Cloudflare IP ranges — CF health checks come from CF too), fail2ban, auditd, logrotate, sysctl. (Ref: lockdown Phases 1–7.)

## Step 2 — Replicate the app to box 2
- `git clone` → `/var/www/wavemax/wavemax-affiliate-program` (same path as box 1).
- **`.env` — copy from box 1; these MUST be byte-identical or sessions/JWTs/encrypted fields break the instant a user lands on the other box:** `JWT_SECRET`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `CSRF_SECRET`, plus the same `MONGODB_URI` (shared Oracle ADB), OAuth creds, email creds.
  - **Only per-box difference:** `RUN_BACKGROUND_JOBS=false` on box 2 (box 1 stays `true` — see Step 3).
- `npm ci`.
- **nginx:** replicate box 1's server blocks (`rundberglaundry.com`, `crhsent.com` root → repo `crhsent/`, `wavemax.promo`, …). Install a **Cloudflare Origin Certificate** (zone-wide — valid regardless of which origin serves it).
- `pm2 start ecosystem.config.js && pm2 save && pm2 startup`.
- **Smoke test box 2 directly before adding to the LB:**
  `curl --resolve rundberglaundry.com:443:<BOX2_IP> https://rundberglaundry.com/health` → `{"status":"UP"}`, and fetch a real page.

## Step 3 — Background-job gating ★ required (code change, TDD)
**Problem:** `server.js:131` calls `paymentVerificationJob.start()` (node-cron) on *every*
instance → two boxes = duplicate cron runs (double-processed payments / double emails).
**Fix:** gate it so exactly one box runs it.
- Add env flag **`RUN_BACKGROUND_JOBS`** (default `'false'`). Box 1 = `'true'`, box 2 = `'false'`.
- `server.js` (~line 131): wrap the start —
  ```js
  if (process.env.RUN_BACKGROUND_JOBS === 'true') {
    const paymentVerificationJob = require('./server/jobs/paymentVerificationJob');
    await paymentVerificationJob.start();
    logger.info('Background jobs ENABLED on this instance');
  } else {
    logger.info('Background jobs disabled on this instance (RUN_BACKGROUND_JOBS!=true)');
  }
  ```
- **TDD (red→green):** refactor the start into a small `maybeStartBackgroundJobs(env)` helper; unit-test that it calls `paymentVerificationJob.start()` **iff** `RUN_BACKGROUND_JOBS==='true'`. No production code without that test.
- Document `RUN_BACKGROUND_JOBS` in `.env.example`.
- **Known Phase-1 limitation (accepted):** with a static flag, if box 1 dies the cron jobs pause until box 1 returns (or the flag is flipped on box 2). Web stays fully up; only the background reminder job pauses. **Phase 1.5 follow-up** for job-HA: replace the flag with a **leader-lease in Oracle ADB** — a single lease doc with an `expiresAt` field, renewed by the leader every N s, re-acquired by the other box via a conditional `findOneAndUpdate({expiresAt:{$lt:now}})` on expiry. *Implement with an explicit `expiresAt` field, NOT a TTL index (Oracle ADB rejects TTL index creation).*

## Step 4 — Cloudflare Load Balancer config
- **Monitor `app-liveness`:** HTTPS, `GET /health`, expect **200** + body contains `"status":"UP"`, interval 60 s, retries 2, timeout 5 s, a few check regions.
  - **Use `/health` (liveness), NOT `/api/health` (DB-coupled):** both boxes share Oracle ADB, so a DB blip would fail *both* checks at once and gain nothing; `/health` answers "can *this box* serve?" Set the LB/pool to **fail-open** if all origins go unhealthy (don't black-hole during a shared-dependency blip).
- **Pool `wavemax-web`:** origins `box1` (IP, weight 1) + `box2` (IP, weight 1); **endpoint steering = round_robin**; attach the monitor; health-change notification → ops email.
- **Load Balancer** for each web hostname (or one LB per zone covering them): default pool = `wavemax-web`, proxied (orange). With a single pool, round-robin happens via the pool's endpoint steering.
- **Session affinity:** enabled, type **Cookie** (`__cflb`), TTL ~**1800 s** (≥ the app's 10-min inactivity). Optionally "cookie + IP fallback."
- **DNS:** replace the existing proxied A records (`rundberglaundry.com → box1`, etc.) with the **Load Balancer** for those hostnames. **Leave all `mail.*` and other DNS-only records untouched** (Phase 1 is web only).

## Step 5 — Cutover (staged, low-risk)
1. Box 2 up but **disabled (or weight 0)** in the pool; confirm monitor shows box 1 healthy.
2. Switch hostname(s) to the LB; verify traffic still served (all via box 1).
3. **Enable box 2** (round-robin); confirm **both** boxes' nginx access logs receive requests.
4. Confirm the `__cflb` cookie is set and a browser session sticks to one box.

## Step 6 — Acceptance tests
- **AC1 Round-robin:** both boxes log traffic when both healthy.
- **AC2 Affinity:** a session sticks to one origin for its duration.
- **AC3 App failover:** `pm2 stop wavemax` on box 1 → CF marks it down within ~1–2 monitor cycles → all traffic to box 2 → **existing logged-in sessions keep working** (shared ADB). Restart → rejoins.
- **AC4 Box failover:** reboot box 1 entirely → served by box 2, no user-visible outage.
- **AC5 No double-jobs:** only box 1 runs `paymentVerificationJob` (logs); box 2 logs "disabled."
- **AC6 Health correctness:** stop only the app → CF detects via `/health` → reroutes.

## Step 7 — Deploy process update
- Deploy is now **`git pull` on BOTH boxes** (+ `pm2 reload wavemax --update-env` for server-code changes; static `crhsent/` needs only the pull). Keep both boxes on the **same commit**.
- Add a tiny `scripts/ops/deploy-all.sh` (loop the two hosts: `git pull --ff-only` [+ conditional pm2 reload]).
- Update the deploy memory + `crhsent/README.md` to reflect two boxes.

## Rollback
Point the hostname DNS from the LB back to a single proxied A record → box 1. Instant
single-box restore; box 2 remains a warm spare.

## Cost (Phase 1)
Box 2 (current tier) + Cloudflare Load Balancing (~$5/mo + usage). No RAM upsize.

## Out of scope (later)
Mailcow DRBD/active-passive + Cloudflare-arbiter mail failover (Phase 2–3); job leader-lease (Phase 1.5).
