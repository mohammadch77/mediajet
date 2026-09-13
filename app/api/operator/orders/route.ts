import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rialToTomanLabel } from "@/lib/money";
import { requireOperator, SessionError } from "@/lib/session";
import type { OrderStatus } from "@/lib/orderState";

const VALID_STATUSES: OrderStatus[] = [
  "draft",
  "awaiting_payment",
  "queued",
  "processing",
  "ready",
  "delivered",
  "cancelled",
  "failed",
  "refunded",
];

// GET /api/operator/orders?status=queued
// صف سفارش‌ها برای اپراتور؛ در صورت پارامتر status، فقط همان وضعیت.
export async function GET(req: NextRequest) {
  try {
    await requireOperator();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const statusParam = req.nextUrl.searchParams.get("status");
  if (statusParam && !VALID_STATUSES.includes(statusParam as OrderStatus)) {
    return NextResponse.json({ error: "وضعیت نامعتبر است." }, { status: 400 });
  }

  const orders = await prisma.order.findMany({
    where: statusParam ? { status: statusParam as OrderStatus } : undefined,
    orderBy: { createdAt: "asc" },
    include: { delivery: true, user: true },
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      category: order.category,
      sourceSite: order.sourceSite,
      productUrl: order.productUrl,
      priceLabel: rialToTomanLabel(Number(order.priceRial)),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      user: { id: order.user.id, mobile: order.user.mobile, name: order.user.name },
      deliveryUrl: order.delivery?.fileUrl ?? null,
    })),
  });
}
