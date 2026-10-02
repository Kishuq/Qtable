// Business-day math in Asia/Kolkata — servers run on UTC, cafes run on IST.
// Token numbers, history filters and "today" stats all follow the cafe clock,
// so the token series resets at IST midnight, not 5:30 AM.
const TZ = "Asia/Kolkata";
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function parts(d: Date): { y: number; m: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  // en-CA yields YYYY-MM-DD — stable to split.
  const [y, m, day] = fmt.format(d).split("-").map(Number);
  return { y, m, day };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD token scope for "today" in IST. */
export function tokenDayIST(d = new Date()): string {
  const { y, m, day } = parts(d);
  return `${y}-${pad(m)}-${pad(day)}`;
}

/** Start of the current IST day as a UTC Date (for createdAt >= queries). */
export function istMidnightUTC(d = new Date()): Date {
  const { y, m, day } = parts(d);
  return new Date(Date.UTC(y, m - 1, day) - IST_OFFSET_MS);
}
