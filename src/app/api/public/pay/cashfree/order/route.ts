import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { limitRequest, tooMany } from "@/lib/security";
import { cashfreeOrderId, createCashfreeOrder, getCashfreeOrder, modeFor } from "@/lib/cashfree";
import { getCafeCashfree } from "@/lib/paykeys";
import { absoluteUrl } from "@/lib/url";
import { markOrderPaid } from "@/lib/cashfree-orders";

const Schema = z.object({ orderId: z.string().min(1).max(64) });

// Creates (or safely reuses) a Cashfree order for an already-placed PENDING
// order. Amount is taken from OUR database — the client can never set the price.
// Gateway keys come from the outlet's own self-serve config (env fallback).
export async function POST(req: NextRequest) {
  if (!(await limitRequest(req, "cf-order", 20, 60_000))) return tooMany();
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const p = Schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "Invalid order" }, { status: 400 });

  const order = await db.order.findUnique({ where: { id: p.data.orderId }, include: { cafe: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.paymentStatus === "PAID") return NextResponse.json({ paid: true, sessionId: "" });
  if (order.status === "CANCELLED") return NextResponse.json({ error: "Order not payable" }, { status: 400 });
  const keys = await getCafeCashfree(order.cafeId);
  if (!keys) {
    return NextResponse.json(
      { error: "Online payments not enabled by this outlet yet. Please pay at counter or via UPI." },
      { status: 503 },
    );
  }

  const payment = await db.payment.findFirst({
    where: { orderId: order.id, mode: "ONLINE", status: "PENDING" },
    orderBy: { createdAt: "desc" },
    select: { id: true, providerRef: true, providerSession: true },
  });

  // Reuse a session that Cashfree still considers payable. Opening checkout
  // twice (or a flaky connection making the customer tap again) must not leave
  // two live payable orders behind.
  if (payment?.providerRef && payment.providerSession) {
    const live = await getCashfreeOrder(keys, payment.providerRef);
    if (live?.status === "PAID") {
      // Paid but the browser never told us (tab closed). Finish the job now.
      await markOrderPaid({
        orderId: order.id,
        cafeId: order.cafeId,
        orderTotal: order.total,
        paymentId: payment.id,
        paidPaise: live.amountPaise,
        paymentRef: live.paymentId,
      });
      return NextResponse.json({ paid: true, sessionId: "", mode: modeFor(keys.live) });
    }
    if (live?.status === "ACTIVE") {
      return NextResponse.json({
        sessionId: payment.providerSession,
        mode: modeFor(keys.live),
        amount: order.total,
        name: order.cafe.name,
        tokenNo: order.tokenNo,
        reused: true,
      });
    }
    // Gateway unreachable or answer unclear: NEVER mint a second payable order —
    // the first one may still be live, and paying both would double-charge.
    if (!live) {
      return NextResponse.json(
        { error: "Payment gateway is slow right now. Try again in a moment, or pay at counter / UPI." },
        { status: 502 },
      );
    }
    // PAID handled above; EXPIRED/TERMINATED falls through to a fresh order.
  }

  try {
    const cf = await createCashfreeOrder(keys, {
      orderId: cashfreeOrderId("qt"),
      amountPaise: order.total,
      customer: {
        id: order.customerPhone || order.id,
        name: order.customerName,
        phone: order.customerPhone,
      },
      note: `${order.cafe.name} · token #${order.tokenNo}`,
      // Tags are our own signed-ish breadcrumb: verification refuses an order
      // whose tag points at a different database row.
      tags: { qtable_order: order.id, qtable_cafe: order.cafeId },
      returnUrl: absoluteUrl(`/order/${order.id}?cf=1`),
      // Per-order notify_url means webhooks reach us even if the outlet never
      // configures anything in its Cashfree dashboard.
      notifyUrl: absoluteUrl(`/api/public/pay/cashfree/webhook/${order.cafeId}`),
    });

    if (payment) {
      await db.payment.update({
        where: { id: payment.id },
        data: { providerRef: cf.orderId, providerSession: cf.paymentSessionId },
      });
    } else {
      await db.payment.create({
        data: {
          cafeId: order.cafeId,
          orderId: order.id,
          mode: "ONLINE",
          status: "PENDING",
          amount: order.total,
          providerRef: cf.orderId,
          providerSession: cf.paymentSessionId,
        },
      });
    }
    await db.auditLog
      .create({ data: { cafeId: order.cafeId, action: "CF_ORDER", meta: `${order.id} ${cf.orderId}` } })
      .catch(() => {});

    return NextResponse.json({
      sessionId: cf.paymentSessionId,
      mode: modeFor(keys.live),
      amount: order.total,
      name: order.cafe.name,
      tokenNo: order.tokenNo,
    });
  } catch (e) {
    console.error("CASHFREE_CREATE_FAIL", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Payment gateway unreachable. Try UPI or counter." }, { status: 502 });
  }
}

// markOrderPaid (src/lib/cashfree-orders.ts) is the single idempotent transition
// shared by this route and the Cashfree webhook — whoever lands first wins.
