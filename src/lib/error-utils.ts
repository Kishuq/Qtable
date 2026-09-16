// ✅ Centralized API error logging — sends errors to audit log for monitoring
// Usage: In any API route, wrap the try/catch or log after known errors

import { db } from "./db";
import { NextResponse } from "next/server";

export async function logApiError(action: string, error: unknown, meta?: Record<string, string>) {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object"
      ? JSON.stringify(error)
      : String(error);

  // ✅ Log to audit database — only best-effort, never block the request
  try {
    await db.auditLog.create({
      data: {
        action: `API_ERROR_${action}`,
        meta: meta ? JSON.stringify(meta) : `error=${encodeURIComponent(message)}`,
      },
    });
  } catch {
    // ✅ Never let logging break the API response
  }
}

// ✅ Standardized error response for API routes
export function apiError(
  res: NextResponse | null,
  status: number,
  message: string,
  action: string,
  meta?: Record<string, string>
) {
  try {
    logApiError(action, new Error(message), meta);
  } catch {}
  return NextResponse.json({ error: message }, { status });
}