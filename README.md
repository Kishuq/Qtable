# Qtable — QR ordering OS for food businesses

One deployment, many outlets. Anyone can sign up, look around in **preview mode**, then
subscribe to go live. Customers scan a table QR → `/t/{outlet}/{table}` opens that outlet's
menu with its own theme. Orders land live on the counter with sound. Owners manage everything
from `/dashboard`.

## 🚀 Quickstart (local dev)

```bash
npm install
npx prisma db push
npm run dev              # http://localhost:3000
```

Open `/setup` — the signup form creates an outlet + owner login + starter menu, 12 tables and
a first coupon. **No lock:** every new signup creates a new outlet in preview mode
(`subStatus = pending`). The dashboard is fully viewable, but every write is refused until the
outlet subscribes. Existing installs default to `active`, so they keep working.

| What | Where |
|---|---|
| Marketing landing | `/` (owners auto-redirect to dashboard; no menu links) |
| Customer menu (canonical QR) | `/t/{outlet-slug}/{table-code}` |
| Legacy QR links | `/t/{table-code}` → redirects to the oldest outlet |
| Order tracking | `/order/[id]` |
| Signup (email or Google) | `/setup` |
| Owner login (+ Google) | `/login` |
| Subscribe / checkout | `/subscribe?plan=&billing=` |
| Forgot / reset password | `/forgot-password`, `/reset-password` |
| Dashboard | `/dashboard` — overview, orders, insights, inventory, history, menu, coupons, design, tables & QR, payments, staff, settings, guide |

## 🎨 Design studio + themes

Dashboard → **Design**: 24 curated themes, **5 real menu layouts** (photo cards, menu paper,
cafe board, poster grid, ticket stubs), unlimited colours, 8 fonts, solid/gradient
backgrounds, dots/grid/waves patterns, 3 corner styles — plus **photo matching**: upload a
logo, interior or packaging shot and the studio pulls its palette into three ready designs.
Optionally use that photo as the menu backdrop. Publishing is a write, so it unlocks with the
subscription.

## 📚 Plans (enforced in code, not just marketing)

| Plan | Price | Gets |
|---|---|---|
| Basic | ₹499/mo | Digital menu display only (no ordering/payments) |
| Standard | ₹699/mo | + ordering, Cash/UPI/cards, tracking, waiter calls, history |
| Pro | ₹1,299/mo | + inventory & low-stock alerts, insights, coupons, staff logins |

Yearly billing is ~20% off, paid upfront. Prices live in `src/lib/plans.ts`; the gates live in
`src/lib/billing.ts` and are enforced server-side, never only in the UI.

- Subscription state lives on each `Cafe` row: `planTier`, `subStatus`, `subBilling`,
  `subPaidUntil`, `subRef`, `subStartedAt`.
- **Preview mode** (`subStatus = pending`) — dashboard pages render, mutating APIs return
  `402 { subscriptionRequired: true }`, and a persistent banner offers "Choose a plan".
- **Login is never blocked.** Unpaid owners sign in normally; the paywall applies to writes.
- **Pro modules** (`/dashboard/inventory`, `/dashboard/analytics`, coupons, staff) return
  `403` for Basic/Standard and are wrapped by `PlanGate` in the UI.
- **Customer ordering** is refused with `402` while unpaid, and on Basic (menu-only) plans.
  The public menu stays readable so the design can be previewed.

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

## 💰 Self-serve subscriptions (Qtable's revenue)

1. In **your** Razorpay account, set `BILLING_RAZORPAY_KEY_ID` /
   `BILLING_RAZORPAY_KEY_SECRET` in Vercel (Production).
2. Point a Razorpay webhook at `https://<domain>/api/billing/webhook` with the events
   `payment.captured`, `order.paid`, `subscription.charged`, `subscription.halted`, and put
   its signing secret in `BILLING_RAZORPAY_WEBHOOK_SECRET`.
3. `POST /api/billing/checkout` creates a Razorpay Order with `notes.cafeId`, plan and
   billing attached. The browser checks out, then `POST /api/billing/activate` verifies the
   HMAC signature, refetches the order, and confirms the amount + tenant before unlocking.
4. The webhook is the safety net if the browser closes mid-flow: it activates from
   `notes.cafeId`, sends the branded receipt (Resend), and logs every step to `AuditLog`.
5. Receipts/plan links are best-effort: a mail failure never undoes a paid activation.
6. Every money/lifecycle change is written to the `BillingEvent` ledger (signup, activated,
   renewal, expired, reminder). Owners see it at **Dashboard → Billing**; support uses it to
   reconcile a payment without guessing.
7. **Renewal is manual today** (one-off Order per period): renewing early extends the
   current paid period, never truncates it. Set `CRON_SECRET` so Vercel Cron can run
   `/api/cron/billing` daily — it marks lapsed outlets `past_due` (customer ordering pauses,
   data stays intact) and emails a reminder 3 days before each period ends.
8. Automatic UPI Autopay/card mandates are **not** wired yet: Razorpay Subscriptions needs
   separate plan objects and merchant activation. The ledger + cron make manual renewal
   safe in the meantime; adding mandates later only changes how a `renewal` event is paid.

Without platform keys, `/subscribe` shows a clear "checkout isn't connected" note and can
fall back to per-plan hosted payment links (`NEXT_PUBLIC_BILLING_*_URL`).

## 🔑 Signup & login (one tap after the first time)

- **Google (recommended):** set `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, add the
  redirect URI `https://<domain>/api/auth/google/callback` in Google Cloud, redeploy.
  "Sign up with Google" at `/setup` verifies the identity and creates the account with
  no email and no password — then lands in the preview dashboard. Return visits are one
  tap on "Continue with Google". The schema's `User.provider` marks such accounts, so a
  password attempt shows the Google button instead of a dead end. Signing in with Google
  for an email that already exists is treated as login, not a duplicate signup.
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
`BILLING_RAZORPAY_*` + `BILLING_RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_*` / `STRIPE_*` (fallback
gateway), `GOOGLE_CLIENT_ID/SECRET`, `RESEND_API_KEY`, `BILLING_EMAIL_FROM`,
`BLOB_READ_WRITE_TOKEN`, `UPSTASH_*`, `CRON_SECRET`, `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`,
`PAYMENT_SECRET`.

## 📁 Map

- `src/app/t/[slug]/[code]/` — canonical QR menu + checkout · `src/app/t/[slug]/` — legacy redirect
- `src/app/order/[id]/` — live tracking + ETA
- `src/app/subscribe/` — plan picker + Razorpay checkout · `src/app/privacy|terms/` — legal pages
- `src/app/dashboard/` — overview, orders, insights, inventory, history, menu, coupons,
  design, billing, tables, payments, staff, settings, guide
- `src/app/api/` — `setup` (open signup), `auth/*` (+ Google OAuth, password reset),
  `public/*` (menu, order, waiter, feedback, pay), `orders`, `menu`, `inventory`,
  `tables`, `coupons`, `payments`, `staff`, `cafe`, `analytics(+/detail)`, `billing/*`,
  `cron/billing`, `email/test`, `stream/orders`, `qr`
- `src/lib/` — `auth`, `billing` (+plans), `plans`, `cafe` (slug resolution), `security`
  (limits), `paykeys` (AES), `email` (Resend), `url` (public origin), `theme`, `day` (IST),
  `google`, `db`, `format`, `qr`

## 🏋️ Scaling notes (honest)

One deployment serves **many outlets**, each isolated by `cafeId` on every query. A lunch
rush on one outlet fits comfortably — order creation is atomic (no lost/double tokens),
Postgres has real MVCC + pooling, and analytics/menu responses cache briefly. Token days +
"today" stats follow Asia/Kolkata.

What is in place specifically for many tenants × traffic:

- **Indexes on every hot path** — `Order(cafeId,status,createdAt)`, `Order(cafeId,createdAt)`,
  `MenuItem(cafeId,sort)`, `Category(cafeId,sort)`, `Payment(cafeId,createdAt)`,
  `Feedback(cafeId,createdAt)`, `AuditLog(cafeId,createdAt)`. A tenant filter without an
  index becomes a full scan once the platform has millions of rows.
- **Tenant-aware rate limits** — public order/waiter/feedback/UPI-claim budgets are keyed by
  outlet *and* IP (plus a wider IP-only guard), so cafés sharing a mall Wi-Fi or carrier NAT
  never silence each other.
- **One dashboard heartbeat** — `GET /api/orders?status=NEW&live=1` returns NEW orders and
  waiter calls together. SSE ticks every 10s (not 2.5s), and while SSE is healthy the client
  polls only every 30s; if it drops, polling falls back to 10s.
- **Fast signup** — demo categories/items/tables are three batch `createMany` inserts instead
  of 27 sequential round trips inside the signup transaction.
- **Subscription operations** — `BillingEvent` ledger + `/dashboard/billing` + daily
  `/api/cron/billing` (expiry + reminder). See the billing section above.

Past a few dozen busy outlets: bigger Neon tier, Upstash Redis limits on (in-memory limits
are per lambda instance), Sentry DSNs set, UptimeRobot on `/api/health`. Public menu reads are
cached at the edge (`s-maxage=15`), so scans cost one DB read per outlet per cache window.
The real ceiling is the SSE timer: each open dashboard is a long-lived function plus three
indexed queries per tick. If you cross a few hundred *simultaneously open* dashboards, move
live updates to Postgres `LISTEN/NOTIFY` or Upstash pub/sub and drop SSE.

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
   QR, Scan→Order→Pay, Powered by Qtable footer). Links look like
   `/t/{your-outlet}/{table-code}`.
3. 200gsm card or photo paper; **laminate**; QR ≥ 3 cm; test-scan every table with
   Android + iPhone before laminating.
4. Train counter (2 min): **Orders** open, sound ON (tap once), tap **✓ Received**
   when UPI credit lands.
