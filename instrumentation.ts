// Registers Sentry on the server. No-op without SENTRY_DSN.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

// Without this hook Next.js swallows route-handler exceptions before Sentry's
// global handlers ever see them, so real 500s would never show up in the
// dashboard. This is the piece that turns "initialised" into "actually wired".
export const onRequestError = Sentry.captureRequestError;
