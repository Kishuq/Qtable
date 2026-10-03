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

Dashboard → **Design**: 14 one-tap presets (Tandoor, Marigold, Monsoon, Gilt…), unlimited
colours, 8 fonts, solid/gradient backgrounds, dots/grid/waves patterns, 3 corner styles.
Publishes instantly — customer phones update with zero redeploy.

## 📚 Plans (enforced in code, not just marketing)

| Plan | Price | Gets |
|---|---|---|
| Basic | ₹499/mo | Digital menu display only (no ordering/payments) |
| Standard | ₹699/mo | + ordering, Cash/UPI/cards, tracking, waiter calls, history |
| Pro | ₹1,299/mo | + coupons, staff logins |

Per-outlet env: `BILLING_PLAN=menu|standard|pro` (unset = full access). See `src/lib/plans.ts`
(single source of truth) and `src/lib/billing.ts` for the gate logic.

## 💰 Your subscription revenue (Razorpay UPI Autopay)

1. Your Razorpay account → Live (your KYC) → **Subscriptions → Plans** → create
   Basic ₹499 / Standard ₹699 / Pro ₹1,299 monthly.
2. Per outlet: **Create Subscription** → send the owner the link → they approve UPI Autopay once.
3. That outlet's Vercel env: `BILLING_PROVIDER=razorpay`, `BILLING_SUBSCRIPTION_ID=sub_…`,
   `BILLING_RAZORPAY_KEY_ID/SECRET` (your platform keys), `BILLING_PLAN=…` → redeploy.
4. Unpaid → login/setup/ordering redirect to `/subscribe`; paid → everything opens.
   Failed renewals mail the owner automatically (Resend + `/api/billing/webhook`).

## 🧱 Stack

Next.js 16 · TypeScript · Tailwind v4 · Prisma 6 + Postgres (Neon) · SSE + polling realtime ·
server-side QR PNGs · Vercel Blob uploads · Resend mail · Upstash Redis limits (optional) · Sentry (optional).

Key env vars (see `.env.example`): `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`,
`BILLING_*`, `RAZORPAY_*` / `STRIPE_*`, `GOOGLE_CLIENT_ID/SECRET`, `RESEND_API_KEY`,
`BLOB_READ_WRITE_TOKEN`, `UPSTASH_*`, `SENTRY_DSN`, `PAYMENT_SECRET`.

## 📁 Map

- `src/app/t/[code]/` — QR menu + checkout · `src/app/order/[id]/` — live tracking + ETA
- `src/app/menu/` — generic browse menu · `src/app/subscribe/` — plan checkout gate
- `src/app/dashboard/` — overview, orders, history, menu, coupons, design,
  tables, payments, staff, settings, guide
- `src/app/api/` — `setup` (first-run, locked), `auth/*` (+ Google OAuth, password reset),
  `public/*` (menu, order, waiter, feedback, pay), `orders`, `menu`, `tables`, `coupons`,
  `payments`, `staff`, `cafe`, `analytics`, `billing/*`, `stream/orders`, `qr`
- `src/lib/` — `auth`, `billing` (+plans), `plans`, `security` (limits), `paykeys` (AES),
  `email` (Resend), `theme`, `day` (IST), `google`, `db`, `cafe`, `format`, `qr`

## 🏋️ Scaling notes (honest)

One deployment serves **one outlet**. A lunch rush (all 12 tables ordering in the same
minute) fits comfortably — order creation is atomic (no lost/double tokens), Postgres has
real MVCC + pooling, dashboard polls on few-second cadence with hidden-tab pausing, and
analytics responses cache ~8s. Rate limits are Upstash-backed when configured, memory
fallback otherwise. Token days + "today" stats follow Asia/Kolkata.

Many outlets = many isolated deployments (one Vercel project each). Past ~50 busy outlets:
bigger Neon tier, Upstash Redis limits on, Sentry DSN set, UptimeRobot on `/api/health`.

## 🖨️ QR setup guide (per outlet)

1. Deploy, open the dashboard **via the public domain** (never localhost/preview —
   QRs encode the address bar), go to **Tables & QR**.
2. Add tables (T1…T12), **Print table cards** → tent card per page (name, table code,
   QR, Scan→Order→Pay, Powered by Qtable footer).
3. 200gsm card or photo paper; **laminate**; QR ≥ 3 cm; test-scan every table with
   Android + iPhone before laminating.
4. Train counter (2 min): **Orders** open, sound ON (tap once), tap **✓ Received**
   when UPI credit lands.
