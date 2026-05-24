# Lessons

Patterns learned from corrections and incidents, written as rules to prevent recurrence.

## Infrastructure / Mail

- **Re-check `docker-compose.override.yml` memory caps after ANY mailcow version bump — for EVERY capped container.** (2026-05-24 — hit TWICE in one day) Updating Ultahost mailcow to 2026-05b made two containers outgrow the Feb-6 override caps on the small 3.8 GB host: (1) **rspamd 3.14.3** (hyperscan/TLD compile, 10,546 suffixes, ~365 MB) OOM-crash-looped at the 256 MB cap (RestartCount 90, `constraint=CONSTRAINT_MEMCG`), its milter `:9900` never came up, and postfix milter-rejected **all** mail `451 4.7.1` — ~25 min live outage. (2) Hours later, **ofelia (cron)** OOM-looped every ~4 min at its 128 MB cap (killed ~127 MB during job runs) — presented as "host struggling." Final caps: rspamd 512m/memswap 1024m (RAM cap + swap headroom for the compile spike), ofelia 256m. **Rule:** after a mailcow update on a memory-tuned host, check `RestartCount`/OOM for ALL capped containers (`dmesg -T | grep "Killed process"` reveals the looping one fast — don't just check the obvious one), confirm the milter answers (`</dev/tcp/rspamd/9900` from postfix), and send one real test message through. The "ports open + SMTP banner" check does NOT catch a dead milter (the banner answers before the milter is consulted).

- **Validate the FULL path, not the listener.** The mail outage surfaced only because I ran an end-to-end relay *send* test, not a port check. Always prove a service with a real transaction through it.

- **mailcow relayhost on a bare IP + submission 587 needs an explicit TLS policy override.** postfix-tlspol resolves a bare-IP destination to no-DANE/no-MTA-STS → `none` → plaintext, but submission requires STARTTLS (`530 Must issue STARTTLS first`). Insert `tls_policy_override` dest=`<ip>` and `<ip>:587` policy=`encrypt`.

- **Don't store secrets with special chars through layered escaping; use exact bytes.** The mailcow API mangled the relay password (extra backslash) → `535 auth failed`. Fixed with `UPDATE relayhosts SET password = UNHEX('<hex>')` — hex round-trips any bytes with zero escaping. Verify by comparing `HEX(stored)` to the source hex (no plaintext in logs/context).

- **mailcow API from the docker host is seen as the bridge gateway IP** (`172.22.1.1`), not `127.0.0.1`. An API key's `allow_from` must include `172.22.1.1` (or `skip_ip_check=1`) for host-side curl to work. The `api` table column is `access` (enum ro/rw), not `rw`.

## Process

- **Production config edits on live hosts require explicit confirmation** even mid-incident — the auto-mode classifier correctly blocked an autonomous `docker-compose.override.yml` rewrite + container recreation on the live mail host until the user authorized it. Surface the incident + the exact fix, get the go-ahead, then act.
