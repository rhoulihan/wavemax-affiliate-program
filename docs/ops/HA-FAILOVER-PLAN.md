# WaveMAX — HA / Failover Architecture Plan (app tier)

> Status: **recommendation / not yet executed.** Drafted 2026-05-23. Grounded in the
> live server's actual capabilities (inspected) + current Cloudflare/Mailcow research.

## Goal (as requested)
Two instances, failover coordinated by Cloudflare, *all services* failover:
- **Website** — round-robin across both instances, but **pin a user to one instance for their session** (sticky / session affinity).
- **Mailcow** — **DRBD replication, active/passive (no load balancing)**: the standby runs all the time but only serves mail when Cloudflare/health detects the primary mail handler has failed.

---

## Current state (single VPS — the SPOF we're removing)
Inspected on the Ultahost VPS Professional box (host A — **Ultahost Dallas, TX** DC):
- **Virtualization: KVM** (full virt) → DRBD is feasible (needs a kernel module install; `drbd` not currently loaded).
- **3 vCPU, 3.8 GB RAM** — **sufficient** (ClamAV + Solr disabled; ~1.9 GB available, ~1 GB Mailcow stack, no swap thrashing — see verified RAM note below).
- **75 GB disk, 51 GB free, single ext4 partition (`sda1`), NO LVM, no spare partition** → a DRBD backing device must be carved/added.
- Runs: **nginx + Node app (PM2 cluster ×3) + full Mailcow stack (18 containers, ~776 MB data)**, all behind **Cloudflare**.
- **DB, sessions, and rate-limits already external on Oracle ADB** (Oracle-managed HA) — the data tier needs no failover work on our side, and **shared session state makes web failover seamless**.
- Static content (`crhsent/`, franchise app, locales) is in git, deployed via `git pull` (already a two-box-friendly model).

---

## Recommended topology
```
                         ┌───────────────── Cloudflare ─────────────────┐
   web (orange-cloud) ─► │  Load Balancer: pool[P, S]                    │
                         │   steering = round-robin, affinity = __cflb   │
                         │   monitor = HTTPS /api/health                 │
   mail (grey-cloud)  ─► │  DNS-only LB / dual-MX, TCP monitor on mail   │
                         └───────────────┬───────────────┬──────────────┘
                                         │               │
                              ┌──────────▼──┐   ┌─────────▼──────────┐
                              │ PRIMARY VPS │   │ SECONDARY VPS      │  (ideally diff DC)
                              │ nginx+Node  │   │ nginx+Node         │  ← web ACTIVE/ACTIVE
                              │ Mailcow ◄═══╪═══╪═► Mailcow (standby) │  ← mail ACTIVE/PASSIVE
                              │ DRBD primary│   │ DRBD secondary     │     (DRBD replicates)
                              └──────┬──────┘   └────────┬───────────┘
                                     └────── Oracle ADB ─┘  (shared; unchanged)
                            (no witness VPS — Cloudflare is the mail-failover arbiter; see split-brain)
```
Both boxes run the **full stack**; web is active/active, mail is active/passive (only the DRBD-primary node runs Mailcow).

---

## Tier 1 — Website (active/active, Cloudflare Load Balancing)
- **Cloudflare Load Balancing** add-on (from **$5/mo**; health-checks/DNS-queries usage-billed above the base).
- **One origin pool** = `[primary_ip, secondary_ip]`, both **orange-cloud (proxied)**.
- **Steering: round-robin** (or "random").
- **Session affinity: cookie** (`__cflb`) — Cloudflare pins the client to one origin for the cookie's TTL as long as that origin stays healthy; on origin failure or TTL expiry it recomputes. Set **affinity TTL ≈ 30–60 min** (the app's inactivity timeout is 10 min; pin a little longer). Optionally "cookie + IP fallback."
- **Health monitor:** HTTPS `GET /api/health`, expect `200` + `database: connected`, interval ~15–30 s, 2–3 retries.
- **Failover is seamless even mid-session** because sessions *and* rate-limits live in shared Oracle ADB — any instance can serve any user. (Affinity is then a nicety/consistency win, **not** a correctness requirement.) Worth stating to Cloudflare-skeptics: even if affinity sends a user to the other box, nothing breaks.
- **Certs:** use **Cloudflare Origin Certificates** on each box for the proxied web hostnames (long-lived, no per-box Let's Encrypt renewal).
- **Deploy:** extend the current `git pull` flow to **both** boxes (keep them lockstep; pm2 reload only for server-code changes).

## Tier 2 — Mailcow (active/passive: DRBD + DNS failover)
**Why not Cloudflare-proxied:** Cloudflare's proxy is HTTP(S) only — **SMTP/IMAP/POP3 do not pass through it**, and any mail DNS record must be **grey-cloud (DNS-only)**. Spectrum *can* TCP-proxy SMTP but is a paid/Enterprise feature with MX/IP-match caveats → **not recommended here**. So mail failover is **DNS-health-based**, not proxied.

- **DRBD** replicates the Mailcow data volume (vmail, mysql, redis, rspamd, acme/certs) between **primary (DRBD primary, mounted, Mailcow up)** and **secondary (DRBD secondary, replicating, Mailcow down)**.
  - **Backing device — no need to request more storage or repartition.** The 75 GB disk's root ext4 (`sda1`) spans the whole disk (no unallocated space), so three options:
    1. **Loop-file (recommended given the constraints):** a ~5–10 GB image on the existing root fs (51 GB free), attached via `losetup` and used as the DRBD backing device. **No new storage, no repartition, no downtime;** overhead negligible at ~776 MB data / low mail volume. Re-attach on boot via a small systemd unit *before* DRBD starts (on both boxes).
    2. **Dedicated 2nd disk:** cleanest/most robust raw block device, but requires provisioning extra Ultahost storage.
    3. **Repartition root:** ❌ NOT recommended — means **shrinking the mounted root ext4** (can't be done online) → a **rescue-mode boot** with downtime + brick risk on the live prod box.
- **Cluster manager: Pacemaker + Corosync** — promotes DRBD, starts/stops the Mailcow containers, and (optionally) manages the mail service, as one resource group, with **fencing to prevent split-brain** (two nodes both mounting the volume = corruption).
- **Cloudflare/DNS failover for the mail hostname** (`mail.wavemax.promo`, `mail.rundberglaundry.com`, `mail.crhsent.com`):
  - A **DNS-only** Cloudflare LB record with a **TCP health monitor** on a mail port (e.g., 465/587/993) and **failover/priority steering** (primary pool → standby pool) → CF returns the standby IP when the primary mail port stops answering.
  - **Plus dual MX** (primary low-priority + standby higher-priority) so sending servers retry the standby natively for inbound delivery.
  - **Low DNS TTL (~60 s)** on mail records so failover propagates quickly.
- **"Standby always running, serves only on failure":** the secondary box is always up and DRBD always replicating, but **Mailcow containers stay stopped on the standby until failover** (you cannot run two Mailcow instances on the same DRBD volume — warm standby, promoted by Pacemaker on primary-mail failure). This matches your "no load balancing for mail" — it's failover-only.
- **Deliverability after failover (do NOT skip):** the standby's sending IP needs correct **PTR/rDNS**; **SPF must list BOTH IPs**; **DKIM keys replicate via DRBD** (they live in the Mailcow volume); warm both IPs. Otherwise post-failover mail lands in spam.

---

## Cross-cutting ("all services failover")
1. **Identical secrets on both boxes** — `JWT_SECRET`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `CSRF_SECRET` **must be byte-identical** (else JWTs, sessions, and AES-encrypted fields break the instant a user lands on the other box). Same Oracle ADB creds.
2. **Background jobs run on ONE instance only** — `server/jobs/` (payment reminders, etc.) on an active/active pair would **double-send**. Gate with an env flag (`JOBS_ENABLED=true` on the primary only) or a distributed lock in Oracle ADB. **Required code change.**
3. **Connectivity monitor / alerting** — run on one node or dedupe, so a real outage doesn't double-alert.
4. **Mail cert** — replicates via DRBD (in the Mailcow acme volume), so the promoted node already has it.
5. **Everything in git deploys to both** — nginx confs, app code, `crhsent/`, franchise registry, locales.

## RAM / sizing note (verified 2026-05-23 — **no upsize needed**)
Mailcow's generic "~6 GB minimum" assumes ClamAV + Solr; **both are disabled here**
(`SKIP_CLAMD=y`, `SKIP_SOLR=y` — i.e. no attachment AV/index), so that figure does
not apply. Verified on the live box:
- **used 1.5 GB / available 1.9 GB**, 2.2 GB buff-cache (reclaimable); **swap 178 MB of
  2 GB with vmstat si/so = 0** → parked pages, *no active swapping*, not memory-starved.
- Whole Mailcow stack ≈ **1 GB** (rspamd 178 MB, ofelia 126 MB, mysql 87 MB, php-fpm
  86 MB, sogo 84 MB, postfix 62 MB; everything else <60 MB) + Node app ≈ 350 MB.

The current **3.8 GB VPS Professional already runs web + full Mailcow comfortably** (live
proof). **Both boxes can stay at the current tier — no RAM upsize.** The standby has
*more* headroom in steady state (Mailcow stopped until failover); starting Mailcow
(~1 GB) on promotion fits easily into free + reclaimable cache. DRBD + Pacemaker/Corosync
add only tens of MB. (Only revisit if ClamAV is ever re-enabled — clamd alone adds ~1–2 GB.)

## Split-brain / quorum — **Cloudflare is the witness (no 3rd VPS)**
The witness only matters for the **mail/DRBD** tier (the web tier is stateless active/active —
the two boxes never coordinate, so a partition between them is a non-event; Cloudflare just
routes to healthy origins). For mail, instead of a co-located Corosync qdevice, use
**Cloudflare's LB health monitor as the external arbiter** — it judges node reachability from
the global edge (the actual client perspective), which is *better* than an in-network qdevice.

**The invariant (each node's single rule):** *run Mailcow / hold the DRBD volume **only while
Cloudflare actively confirms you are the live mail endpoint**. Keep doing what you're doing only
as long as Cloudflare agrees with your own view; the moment you can't get CF to agree (it dropped
you, **or** you can't reach it to ask), move to the safe state — primary demotes, standby stays
passive.* Because CF (priority steering) confirms **exactly one** origin as live, **at most one
node ever holds the volume — by construction**. Under uncertainty every node defaults to *not*
holding the volume (primary releases, standby doesn't grab), so nobody holds it on a guess.

**Failover policy (the above, operationally):** the standby promotes **only when Cloudflare marks
the primary's mail endpoint unhealthy** (the standby pulls the CF LB pool-health via the CF API,
or acts on a CF health-change notification) — **never** on loss of the local DRBD/heartbeat link.
Therefore:
- Primary healthy per CF + boxes can't see each other → **no failover** (primary keeps serving;
  DRBD replication pauses and resyncs on heal). *(This is the exact behavior requested.)*
- Primary truly down per CF → standby promotes.

**Fencing is still required** (true with a qdevice too) for the one asymmetric case: primary
alive and holding the volume but unreachable *from Cloudflare* while the standby is reachable →
CF says "promote" → two writers. Close it with:
- **Self-fence (primary):** a watchdog demotes (stop Mailcow → DRBD Secondary → unmount) when it
  loses confirmation that CF still routes mail to it (CF dropped it, or it can't reach the CF API)
  for *T* seconds — fail-safe (when in doubt, demote).
- **Guard interval (standby):** wait **> T** after CF marks the primary down before promoting, so
  the old primary has released the volume.
- **Optional hard backstop:** if Ultahost exposes a power/reboot API, use it as STONITH for the
  rare *hung* primary that can't self-fence (the only case self-fence alone can't cover).

Net: **no witness VPS** — Cloudflare is the arbiter; Pacemaker (or a small custom controller)
manages the local DRBD-promote + Mailcow start/stop, driven by the CF verdict + self-fence.

## Cross-DC vs same-DC (DRBD tradeoff)
- **Same DC:** DRBD **synchronous (Protocol C)** → near-zero RPO, but less resilience to a full-DC outage.
- **Different DC (more resilient):** WAN latency makes synchronous DRBD slow for mail writes → use **async (Protocol A)**, accepting a few seconds of replication lag (small RPO). *Pick based on whether DC-failure survival matters more than zero mail-RPO.*

## Cost (verify current)
- **2nd Ultahost VPS in Los Angeles** (same tier — **no RAM upsize**; different region from the Dallas host A, and the closest US region to the Phoenix ADB). **No extra block device** (loop-file DRBD backing) and **no witness VPS** (Cloudflare is the arbiter).
- **Cloudflare Load Balancing** from **$5/mo** + usage; a second (DNS-only) LB for mail may add a little. Confirm in the CF dashboard.
- ~~RAM upsize~~ — **not needed** (current tier verified sufficient; ClamAV/Solr disabled).

## Open items to confirm before building
1. Ultahost: provision a 2nd VPS in **Los Angeles** (decided — different region from Dallas host A, closest US region to the Phoenix ADB). No extra block device needed (loop-file backing); no witness (Cloudflare arbiter). *Just confirm an LA VPS Professional is orderable.*
2. ~~RAM tier~~ — **resolved: current 3.8 GB tier verified sufficient; no upsize** (ClamAV/Solr disabled; ~1 GB Mailcow + ~350 MB app, no swap thrashing).
3. Same-DC (sync) vs cross-DC (async) DRBD.
4. Fencing: self-fence + guard interval is built in; optionally add a provider power-fence (STONITH) as a hung-node backstop — **does Ultahost expose a power/reboot API?**
5. Acceptance of the **code change** to gate background jobs to one instance.

## Phased rollout
- **Phase 0** — provision the LA VPS; create the loop-file DRBD backing device on each box; install the DRBD module + Pacemaker/Corosync.
- **Phase 1 (web HA)** — deploy app to box 2; identical secrets; gate background jobs; Cloudflare LB pool + affinity + `/api/health` monitor; **test:** kill box-1 app → traffic shifts, sessions survive.
- **Phase 2 (mail replication)** — DRBD on the extra disks; Pacemaker resource group (DRBD promote + Mailcow start/stop); **test:** manual promotion/failover on the standby.
- **Phase 3 (mail failover routing)** — DNS-only CF LB + TCP monitor + dual MX + low TTL; SPF (both IPs) + PTR + DKIM replication; **test:** stop primary Mailcow → mail routes to standby, sends/receives cleanly.
- **Phase 4 (game day)** — kill the primary VPS entirely; verify **web + mail both fail over**; write the runbook (failover, failback, split-brain recovery).

---

*Sources: Cloudflare Load Balancing — session affinity (`__cflb` cookie), steering, health monitors; Cloudflare DNS/Spectrum — SMTP/IMAP not proxied (mail must be DNS-only/grey-cloud), Spectrum TCP-proxy paid + MX caveats; Mailcow HA — no native clustering, community uses DRBD+Pacemaker active/passive or DNS-failover sync. Server facts from live inspection 2026-05-23.*
