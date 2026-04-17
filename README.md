# WaveMAX Laundry Affiliate Program

A Node.js / Express / MongoDB platform that powers a laundry pickup-delivery affiliate network: affiliates onboard customers, manage pickups and deliveries, track individual bags via QR codes, and earn commissions.

> **Status:** production system, active refactor in progress. See [`docs/refactor/`](docs/refactor/) for the design + phased plan.

## Quick start (development)

```sh
git clone https://github.com/rhoulihan/wavemax-affiliate-program
cd wavemax-affiliate-program
cp .env.example .env        # fill in secrets
npm install
docker compose up -d mongo  # or point MONGODB_URI at your own mongo
npm run setup:database
npm run init:defaults
npm run dev                 # nodemon on :3000
```

Tests:

```sh
npm test                    # full jest suite
npm run test:unit           # unit only
npm run test:integration    # integration only
npm run test:coverage       # with coverage report
```

## Production

- Deployment: PM2 cluster behind Nginx on a single host. See `ecosystem.config.js`.
- Database: MongoDB Atlas.
- Embed domain: `wavemax.promo` — iframe-embedded on the WaveMAX marketing site at `www.wavemaxlaundry.com`.

## What's inside

| | |
|---|---|
| `server/` | Express app — routes, controllers, middleware, models, services, jobs |
| `public/` | Iframe SPA — HTML pages, JS, CSS, i18n locales |
| `tests/` | Jest suite — unit, integration, helpers |
| `scripts/` | CLI utilities — admin tools, setup, security, ops, diagnostics. See [`scripts/README.md`](scripts/README.md) |
| `docs/` | All documentation. See [`docs/README.md`](docs/README.md) for the index |

## Key integrations

- **OAuth** — Google, Facebook, LinkedIn (affiliate + customer login)
- **Mailcow SMTP** — transactional email; **IMAP** for post-weigh payment verification
- **OpenStreetMap Nominatim** — address geocoding and service-area validation
- **QuickBooks Online** — vendor + commission export
- **Venmo / PayPal / CashApp** — V2 post-weigh payments, detected via email scanning

_(Paygistix V1 upfront payment and DocuSign W-9 automation are being retired — see [`docs/refactor/REFACTORING_PLAN.md`](docs/refactor/REFACTORING_PLAN.md) §4.1 and §4.1.1.)_

## Roles

| Role | Purpose |
|---|---|
| **Administrator** | System management, operator + affiliate CRUD, system configuration, payment unlock |
| **Operator** | Facility staff; scans bags through the three-stage workflow |
| **Affiliate** | Independent service provider; onboards customers, earns commissions |
| **Customer** | End user; registers via affiliate link, schedules pickups |

## Documentation

- [`docs/README.md`](docs/README.md) — full documentation index
- [`docs/FEATURES.md`](docs/FEATURES.md) — current feature list
- [`docs/refactor/DESIGN.md`](docs/refactor/DESIGN.md) — current and target architecture
- [`docs/refactor/REFACTORING_PLAN.md`](docs/refactor/REFACTORING_PLAN.md) — phased execution plan
- [`docs/guides/`](docs/guides/) — embed, i18n, mobile integration guides
- [`CLAUDE.md`](CLAUDE.md) — project instructions for AI pair-programming (strict TDD, security, code-org rules)

## Environment variables

See [`.env.example`](.env.example) for the full set. The critical ones:

- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET`, `SESSION_SECRET`, `CSRF_SECRET`, `ENCRYPTION_KEY` — generate with `openssl rand -hex 32`
- `EMAIL_PROVIDER` / `EMAIL_HOST` etc. — email transport
- OAuth provider credentials for Google, Facebook, LinkedIn

## License

MIT. See [`LICENSE`](LICENSE).

---

_Older, long-form README archived at [`docs/archive/README-2026-04-17-full.md`](docs/archive/README-2026-04-17-full.md) for reference during the refactor._
