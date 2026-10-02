// Registers Sentry on the server. No-op without SENTRY_DSN.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}
