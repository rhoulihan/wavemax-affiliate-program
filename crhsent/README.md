# crhsent/ — CRHS Enterprises static site (crhsent.com)

Static content for **crhsent.com**, version-controlled in this repo so it deploys
the **same way** as the rest of the app (SSH + `git pull`). The Express app does
**not** serve this directory (it only serves `public/`); these files are served
directly by the `crhsent.com` nginx server block.

## Contents

| Path | Served at | Purpose |
|:--|:--|:--|
| `index.html` | `https://crhsent.com/` | Apex holding-company placeholder |
| `wavemax/index.html` | `https://crhsent.com/wavemax/` | "$500/mo Web & SEO for WaveMAX owners" sales landing page (Performance / SEO / Security proof tabs) |

## Deploy

nginx `crhsent.com` has its `root` pointed at this directory:

```nginx
# /etc/nginx/sites-available/crhsent.com  (HTTPS apex server block)
root /var/www/wavemax/wavemax-affiliate-program/crhsent;
index index.html;
```

So deploying is just a pull on the prod box (no pm2 restart — static files):

```bash
sudo ssh wavemax-promo 'cd /var/www/wavemax/wavemax-affiliate-program && git pull --ff-only'
```

crhsent.com is behind Cloudflare with `cf-cache-status: DYNAMIC`, so changes are
live immediately (no cache purge needed).

## Notes

- Edit these files here, commit, push, then run the pull above. Do not hand-edit
  on the server (it would be overwritten by the next pull).
- The page is self-contained (inline `<style>`), no build step.
