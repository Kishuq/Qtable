# ☕ QRServe — your cafe's own QR ordering app

One cafe, one app. Customers scan the table QR → `/t/T1` opens **your** menu with
**your** colours, fonts and patterns. Orders land live on your counter + kitchen screens.

## 🚀 Quickstart

```bash
npm install
npx prisma db push
npx tsx prisma/seed.ts   # instant demo: Brew Haven + menu + 12 tables
npm run dev              # http://localhost:3000
```

**Real setup (fresh cafe):** skip the seed, open `/setup` — 60-second wizard creates
your cafe + owner login + starter menu, tables and first coupon.

| What | Where |
|---|---|
| Customer home / table picker | `/` |
| Scan demo (table T1) | `/t/T1` |
| Order tracking | `/order/[id]` |
| First-run setup | `/setup` (locks after use) |
| Owner login | `/login` → demo `owner@mycafe.com` / `demo1234` |
| Dashboard | `/dashboard` — orders · history · kitchen · menu · discounts · **design** · tables & QR · payments · staff · settings |

## 🎨 Design studio (full customisation)

Dashboard → **Design**: unlimited primary/accent/background colours, 6 fonts,
solid/gradient backgrounds, dots/grid/waves patterns, 3 corner styles + 6 one-tap
preset themes. Publishes instantly — customer phones update with zero redeploy.
Everything customer-facing renders from the theme; a broken photo URL degrades to an icon.

## 📚 Order history

Dashboard → **History**: every order ever, with date-range + status + text search,
revenue totals and one-click **CSV export** for your accountant.

## ✨ More of what's inside

- **Live orders** with sound (SSE + polling fallback), `NEW → … → COMPLETED` flow, cancel rules
- **Kitchen display (KDS)** with timers + rush highlight
- **Discounts/coupons** with tap-to-apply offers on the customer menu
- **Payments**: counter, UPI-QR (GPay/PhonePe/Paytm) + Razorpay/Stripe-ready via `.env`
- **Staff logins** (OWNER / STAFF / KITCHEN), payments ledger, feedback wall, GST bills
- **Security**: bcrypt-12, httpOnly JWT, rate limits, Zod on every API,
  server-side repricing, RBAC + audit logs, CSP/HSTS headers

## 🧱 Stack

Next.js 16 · TypeScript · Tailwind v4 · Prisma 6 + SQLite (switch `provider` to
`postgres` + `prisma migrate` for production) · SSE realtime · server-side QR PNGs.

## 📁 Map

- `src/app/t/[code]/` — QR menu + checkout · `src/app/order/[id]/` — live tracking
- `src/app/dashboard/` — overview, orders, history, kitchen, menu, coupons, design,
  tables, payments, staff, settings
- `src/app/api/` — `setup` (first-run, locked), `auth/*`, `public/*`, `orders`,
  `menu`, `tables`, `coupons`, `payments`, `staff`, `cafe`, `analytics`, `stream/orders`, `qr`
- `src/lib/theme.ts` — fonts, presets, theme helpers · `src/components/theme.tsx` — theming wrapper
- `prisma/schema.prisma` — User, Cafe (+theme), Category, MenuItem, CafeTable, Order,
  OrderItem, Payment, Coupon, Feedback, AuditLog

## 🚀 Going production (one cafe = one deployment)

**Option A — Vercel + Neon (easiest, free to start)**
1. Push this repo to GitHub → Import in Vercel.
2. Create a free Postgres at [neon.tech](https://neon.tech) → copy the connection string.

**Supabase instead of Neon?** Works the same — it's managed Postgres:
1. New project at [supabase.com](https://supabase.com) → Settings → Database.
2. `DATABASE_URL` = **pooler** string, Session mode, port **6543** (handles
   hundreds of concurrent cafe screens via Supavisor).
3. `DIRECT_URL` = **direct** string, port **5432** (schema pushes/migrations only).
4. Capacity reality check: one order ≈ 2 KB. Supabase free tier (500 MB) holds
   ~250,000 orders — years for one cafe. Paid tiers scale to terabytes.
3. In `prisma/schema.prisma` change `provider = "sqlite"` → `"postgresql"`.
4. Vercel env vars: `DATABASE_URL` (Neon string), `JWT_SECRET` (48+ random chars),
   `NEXT_PUBLIC_APP_URL` (your https domain), Razorpay/Stripe keys when ready.
5. Build command: `npx prisma generate && npx prisma db push && npm run build`
   (later: switch to `prisma migrate deploy` once you generate migrations).
6. Visit `https://your-domain/setup` once → create the cafe. Done. Point an
   uptime monitor at `/api/health`.

**Option B — your own server (Docker, per cafe)**
```bash
cp .env.example brewhaven.env   # fill JWT_SECRET, NEXT_PUBLIC_APP_URL, DB_PASSWORD…
docker compose -p brewhaven --env-file brewhaven.env up -d --build
# → cafe live at your server IP/domain. Repeat per cafe with a new project name.
```
The image auto-switches Prisma to Postgres and pushes the schema on boot.
Data lives in the `pgdata` volume (Neon/volumes back it up); History → CSV is your export.

**Prod checklist before pitching**: HTTPS on (cookies go Secure automatically) ·
long JWT_SECRET · live Razorpay keys (test keys first) + Stripe webhook set ·
alarm sound tested on the counter device · `/api/health` monitored ·
owner trained (UPI ID in Settings, keep Orders tab open, one-tap ✓ Received).

## 💰 Getting paid by cafes (your subscription revenue)

You sell per cafe per month. Stripe handles the money globally (US cards, ACH,
international) with payouts to your bank in 2–7 days. Setup (15 min, dashboard only):

1. **Stripe account** → activate payouts (bank details + business info/KYC).
2. **Product catalog** → New product “QRServe Pro” → recurring price, e.g.
   **$29/mo** (US) or **₹999/mo** (India). Copy the Price ID.
3. **Per cafe**: Customers → New customer (the cafe) → Create subscription with
   that Price → copy the **Subscription ID** + **Customer ID**.
4. In that cafe's deployment env: `BILLING_SUBSCRIPTION_ID=sub_…`,
   `BILLING_CUSTOMER_ID=cus_…` (+ `STRIPE_SECRET_KEY`).
5. The owner sees a billing banner only if payment fails — ordering never stops
   mid-service. They update the card themselves via the customer portal link.
6. Track MRR in Stripe → Revenue. Failed payments auto-retry with Smart Retries.

**Zero-code alternative**: Stripe **Payment Links** — one link per plan, cafes pay,
you paste the IDs as above. **India alt**: Razorpay Subscriptions, same pattern.
**Pricing advice that works**: setup fee (covers your QR printing + menu entry,
e.g. $99) + monthly ($29–49). Setup fee filters out non-serious cafes.

## 🌍 Going global (US/EU ready)

- **Currency per cafe**: Settings → Currency (USD, EUR, GBP, AED…). Prices,
  bills, ledger and exports reformat instantly with native locales.
- **Tax**: the same field covers GST/VAT/sales tax — set 0–30% per local rules.
- **Payments**: UPI auto-hides outside INR; US/EU cafes get card checkout via
  Stripe (add keys → ONLINE appears). Razorpay stays the India pick.
- **Dates/CSV**: viewer-locale formatting everywhere.
- Still English-only UI — translated menus come from dish names the owner types;
  full app i18n is the next milestone if a region demands it.

## 🏋️ Will it survive a rush? (scaling notes)

Honest numbers: one deployment serves **one cafe**. A lunch rush (all 12 tables
ordering in the same minute ≈ dozens of writes/sec) is comfortably inside what
this handles — order creation is a **single atomic DB transaction** (no lost or
double-token orders), SQLite runs in **WAL mode** (reads never block writes),
the rate limiter is **memory-bounded**, and every dashboard polls on a few-second
cadence instead of holding connections.

**Many cafes = many isolated deployments** (one `docker compose -p cafename`
stack each, or one Vercel project each). A crash or traffic spike in Cafe A
cannot touch Cafe B — resource limits per container enforce that. JWT sessions
are stateless, so any single cafe can also scale horizontally behind Caddy/Nginx
when it outgrows one container.

When to upgrade: SQLite is fine for one cafe; the Docker image already uses
**Postgres**. Past ~50 cafes, move DBs to one managed Postgres (Neon/RDS) with
automated backups + `pg_dump` cron for off-site copies — History → CSV remains
your per-cafe export escape hatch. Past hundreds: add Upstash Redis for rate
limits and a real queue for KOT printing.

## 🖨️ QR setup guide (for each cafe)

1. Deploy, open the dashboard **via the public domain** (never localhost —
   QRs encode the address in your address bar), go to **Tables & QR**.
2. Add missing tables (T1…T12), hit **Print table cards** → one tent card per page
   (cafe name, big table code, QR, Scan→Order→Pay steps).
3. Print: any laser printer, 200gsm card or photo paper; **laminate** (spills!) or
   slide into cheap acrylic table tents / sticker-print for the tabletop.
4. QR size ≥ 3 cm, good lighting, flat surface. Test-scan every table with 2 phones
   (Android + iPhone, GPay lens + camera) before laminating.
5. Train staff (2 min): keep **Orders** open on the counter, sound ON (tap once to
   enable), tap **✓ Received** when UPI credit lands, advance KOTs on the **Kitchen** tab.
6. Put one strip-table reminder: “Need help? Ask the counter” — and you're live. 🎉
