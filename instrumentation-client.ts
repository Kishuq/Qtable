// Browser-side Sentry. Next.js loads this file automatically on the client
// (Next 15+ convention). Without it, sentry.client.config.ts is never executed
// and browser crashes go unreported.
//
// The DSN must be exposed as NEXT_PUBLIC_SENTRY_DSN to reach the browser —
// non-public env vars are not inlined into client bundles.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
  // Session replay stays off: it is heavy, and food-ordering screens are
  // full of customer names and phone numbers.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
