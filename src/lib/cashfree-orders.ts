import { db } from "./db";

// Shared, idempotent "money arrived" transition for outlet orders. Both the
// browser verify route and the Cashfree webhook call it, so whichever lands
// first wins exactly once — a retried webhook can never double-count a sale.
export async function markOrderPaid(o: {
  orderId: string;
  cafeId: string;
  orderTotal: number;
  paymentId?: string;
  paidPaise?: number;
  paymentRef?: string;
  /** Cashfree order id stored on Payment.providerRef — pins the exact attempt. */
  providerRef?: string;
}): Promise<boolean> {
  // A short-paid order is never treated as settled; it needs a human.
  if (o.paidPaise !== undefined && o.paidPaise + 1 < o.orderTotal) {
    await db.auditLog
      .create({
        data: {
          cafeId: o.cafeId,
          action: "CF_AMOUNT_SHORT",
          meta: `${o.orderId} paid=${o.paidPaise} due=${o.orderTotal}`,
        },
      })
      .catch(() => {});
    return false;
  }

  // Target exactly one payment attempt. Falling back to "every pending ONLINE
  // row" would let two attempts (expired + fresh) both flip PAID for one charge.
  let targetId = o.paymentId || "";
  if (!targetId && o.providerRef) {
    const row = await db.payment.findFirst({
      where: { orderId: o.orderId, mode: "ONLINE", status: "PENDING", providerRef: o.providerRef },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    targetId = row?.id || "";
  }
  if (!targetId) {
    const latest = await db.payment.findFirst({
      where: { orderId: o.orderId, mode: "ONLINE", status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    targetId = latest?.id || "";
  }
  if (!targetId) return false;

  const updated = await db.payment.updateMany({ where: { id: targetId, status: "PENDING" }, data: { status: "PAID" } });
  if (updated.count === 0) return false;

  await db.order.updateMany({
    where: { id: o.orderId, paymentStatus: { not: "PAID" } },
    data: { paymentStatus: "PAID" },
  });
  await db.auditLog
    .create({
      data: {
        cafeId: o.cafeId,
        action: "CF_PAID",
        meta: `${o.orderId} ${o.paymentRef || ""} ${o.orderTotal}`.trim(),
      },
    })
    .catch(() => {});
  return true;
}
