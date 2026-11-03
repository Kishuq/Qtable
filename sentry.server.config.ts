// Sentry server reporting — silent when SENTRY_DSN is unset.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || "";

Sentry.init({
  dsn: dsn || undefined,
  enabled: Boolean(dsn),
  // Tags every issue with production/preview so preview noise is separable.
  environment: process.env.VERCEL_ENV || "development",
  release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
  tracesSampleRate: 0.1,
});
