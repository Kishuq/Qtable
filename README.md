# Qtable — QR ordering OS for food businesses

One outlet, one deployment. Customers scan the table QR → `/t/T1` opens **your** menu with
**your** theme. Orders land live on the counter with sound. Owners manage everything from `/dashboard`.

## 🚀 Quickstart (local dev)

```bash
npm install
npx prisma db push
npx tsx prisma/seed.ts   # demo outlet + menu + tables (dev only)
npm run dev              # http://localhost:3000
```

**Real setup (fresh outlet):** skip the seed, open `/setup` — 60-second wizard creates
your outlet + owner login + starter menu, tables and first coupon. Locked forever after first use.

| What | Where |
|---|---|
| Marketing landing | `/` (owners auto-redirect to dashboard) |
| Customer menu for a table | `/t/T1` |
| Generic browse menu | `/menu` |
| Order tracking | `/order/[id]` |
| First-run setup | `/setup` (locks after use) |
| Owner login (+ Google) | `/login` |
| Subscribe / checkout | `/subscribe?plan=&billing=` |
| Forgot / reset password | `/forgot-password`, `/reset-password` |
| Dashboard | `/dashboard` — overview, orders, history, menu, coupons, design, tables & QR, payments, staff, settings, guide |

## 🎨 Design studio + themes

Dashboard → **Design**: 24 curated themes, **5 real menu layouts** (photo cards, menu paper,
cafe board, poster grid, ticket stubs), unlimited colours, 8 fonts, solid/gradient
backgrounds, dots/grid/waves patterns, 3 corner styles — plus **photo matching**: upload a
logo, interior or packaging shot and the studio pulls its palette into three ready designs.
Optionally use that photo as the menu backdrop. Publishes instantly — zero redeploy.

## 📚 Plans (enforced in code, not just marketing)

| Plan | Price | Gets |
|---|---|---|
| Basic | ₹499/mo | Digital menu display only (no ordering/payments) |
| Standard | ₹699/mo | + ordering, Cash/UPI/cards, tracking, waiter calls, history |
| Pro | ₹1,299/mo | + inventory & low-stock alerts, insights, coupons, staff logins |

Per-outlet env: `BILLING_PLAN=menu|standard|pro` (unset = full access). See `src/lib/plans.ts`
(single source of truth) and `src/lib/billing.ts` for the gate logic.

## 📦 Inventory & Insights (Pro)

Both are enforced server-side, not just hidden in the nav:

- **`/dashboard/inventory`** — per-item stock, one-tap −/+/+10, "warn at" threshold,
  mark sold out, start/stop tracking. `GET/PATCH /api/inventory` returns `403` on
  Basic/Standard. Low-stock items also surface as a banner on the overview.
- **`/dashboard/analytics`** — revenue by day (7 or 30), busiest hours in IST,
  payment mix, best sellers, recent feedback. `GET /api/analytics/detail?days=7|30`
  is Pro-only and cached for 15s per outlet.

## 📄 Legal & support pages

`/privacy` and `/terms` are real pages linked from the landing footer, the setup form
and the page footers, so the OAuth consent screen and gateway onboarding always have a
URL to point at. Set `NEXT_PUBLIC_SUPPORT_EMAIL` to the inbox you actually monitor —
the default `support@qtable.in` only makes sense once that domain is yours.

## 💰 Your subscription revenue (Razorpay UPI Autopay)

1. Your Razorpay account → Live (your KYC) → **Subscriptions → Plans** → create
   Basic ₹499 / Standard ₹699 / Pro ₹1,299 monthly.
2. Per outlet: **Create Subscription** → send the owner the link → they approve UPI Autopay once.
3. That outlet's Vercel env: `BILLING_PROVIDER=razorpay`, `BILLING_SUBSCRIPTION_ID=sub_…`,
   `BILLING_RAZORPAY_KEY_ID/SECRET` (your platform keys), `BILLING_PLAN=…` → redeploy.
4. Unpaid → login/setup/ordering redirect to `/subscribe`; paid → everything opens.
   Failed renewals mail the owner automatically (Resend + `/api/billing/webhook`).

## 🔑 Signup & login (one tap after the first time)

The owner should authenticate **once**, never retype details:

- **Google (recommended):** set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, add the
  redirect URI `https://<domain>/api/auth/google/callback` in Google Cloud, redeploy.
  "Sign up with Google" at `/setup` verifies the identity and creates the account with
  no email and no password — then logs the owner straight into the dashboard. Return
  visits are one tap on "Continue with Google". The schema's `User.provider` marks such
  accounts, so a password attempt shows the Google button instead of a dead end.
- **Manual:** the last successful email is kept in an httpOnly `qtable_last_email`
  cookie and pre-filled on `/login`. Setup signs the owner in immediately, and the
  session lasts 30 days.
- **Password reset:** `/forgot-password` creates a single-use 24h token and emails a
  link to `/reset-password?email=…&token=…` (Resend). Settings → **Email delivery** has
  a "Send test email" button so delivery can be proven before it matters. Without
  `RESEND_API_KEY` the token is still written to the DB for manual recovery.
- A valid session skips `/login` and the marketing `/` entirely (both redirect to
  `/dashboard`), so an active owner never sees a form.

## 🧱 Stack

Next.js 16 · TypeScript · Tailwind v4 · Prisma 6 + Postgres (Neon) · SSE + polling realtime ·
server-side QR PNGs · built-in photo storage (Vercel Blob optional) · Resend mail · Upstash Redis limits (optional) · Sentry (optional).

Key env vars (see `.env.example`): `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`,
`BILLING_*`, `RAZORPAY_*` / `STRIPE_*`, `GOOGLE_CLIENT_ID/SECRET`, `RESEND_API_KEY`,
`BLOB_READ_WRITE_TOKEN`, `UPSTASH_*`, `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`, `PAYMENT_SECRET`.

## 📁 Map

- `src/app/t/[code]/` — QR menu + checkout · `src/app/order/[id]/` — live tracking + ETA
- `src/app/subscribe/` — plan checkout gate · `src/app/privacy|terms/` — legal pages
- `src/app/dashboard/` — overview, orders, insights, inventory, history, menu, coupons,
  design, tables, payments, staff, settings, guide
- `src/app/api/` — `setup` (first-run, locked), `auth/*` (+ Google OAuth, password reset),
  `public/*` (menu, order, waiter, feedback, pay), `orders`, `menu`, `inventory`,
  `tables`, `coupons`, `payments`, `staff`, `cafe`, `analytics(+/detail)`, `billing/*`,
  `email/test`, `stream/orders`, `qr`
- `src/lib/` — `auth`, `billing` (+plans), `plans`, `security` (limits), `paykeys` (AES),
  `email` (Resend), `url` (public origin), `theme`, `day` (IST), `google`, `db`, `cafe`,
  `format`, `qr`

## 🏋️ Scaling notes (honest)

One deployment serves **one outlet**. A lunch rush (all 12 tables ordering in the same
minute) fits comfortably — order creation is atomic (no lost/double tokens), Postgres has
real MVCC + pooling, dashboard polls on few-second cadence with hidden-tab pausing, and
analytics responses cache ~8s. Rate limits are Upstash-backed when configured, memory
fallback otherwise. Token days + "today" stats follow Asia/Kolkata.

Many outlets = many isolated deployments (one Vercel project each). Past ~50 busy outlets:
bigger Neon tier, Upstash Redis limits on, Sentry DSNs set, UptimeRobot on `/api/health`.

### Monitoring: what to set up once

**UptimeRobot** — add an HTTP(s) monitor on `https://your-domain/api/health`, interval
5 minutes, alert on anything other than HTTP 200. The endpoint runs `SELECT 1`, so it fails
when the app *or* the database is down, and returns
`{ ok, time, db, sentry, region }` so the response itself tells you which half broke.

**Sentry** — create a Next.js project, then set **both** env vars and redeploy:
`SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (browser; must be public-prefixed or the
client bundle never receives it). Client init lives in `instrumentation-client.ts`, server
init in `sentry.server.config.ts`, and `instrumentation.ts` exports `onRequestError` so
route-handler 500s are captured. The CSP in `next.config.ts` explicitly allows Sentry ingest
— without that allowance the browser blocks every report. `GET /api/health` returns
`sentry: true` once the DSN is live, which is the quickest way to confirm the wiring.

### Latency: keep functions next to the database

`vercel.json` pins functions to **sin1 (Singapore)** because the Neon database lives in
`ap-southeast-1`. A mismatched region (e.g. functions in `iad1`) adds ~230 ms to *every*
query — a menu load became 2–3 s and `/api/health` ~800 ms. Keep the two in the same
region; the public menu is also edge-cached (`s-maxage=15`) so a rush costs one DB read,
not one per scan, and order tracking polls only the order (no 50 KB backdrop per tick).

## 🖨️ QR setup guide (per outlet)

1. Deploy, open the dashboard **via the public domain** (never localhost/preview —
   QRs encode the address bar), go to **Tables & QR**.
2. Add tables (T1…T12), **Print table cards** → tent card per page (name, table code,
   QR, Scan→Order→Pay, Powered by Qtable footer).
3. 200gsm card or photo paper; **laminate**; QR ≥ 3 cm; test-scan every table with
   Android + iPhone before laminating.
4. Train counter (2 min): **Orders** open, sound ON (tap once), tap **✓ Received**
   when UPI credit lands.
