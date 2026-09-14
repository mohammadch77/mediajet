import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { rialToTomanLabel } from "@/lib/money";
import { parsePageParams, paginatedResult } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";
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

// GET /api/admin/orders?status=&search=&page=&pageSize=
// همه‌ی سفارش‌ها با فیلتر وضعیت، جستجو (موبایل/نام کاربر یا سایت/دسته) و صفحه‌بندی. فقط admin.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
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

  const search = (req.nextUrl.searchParams.get("search") ?? "").trim();
  const params = parsePageParams(req);

  const where: Prisma.OrderWhereInput = {
    ...(statusParam ? { status: statusParam as OrderStatus } : {}),
    ...(search
      ? {
          OR: [
            { sourceSite: { contains: search, mode: "insensitive" } },
            { category: { contains: search, mode: "insensitive" } },
            { user: { mobile: { contains: search, mode: "insensitive" } } },
            { user: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
      include: { user: true },
    }),
  ]);

  return NextResponse.json(
    paginatedResult(
      orders.map((o) => ({
        id: o.id,
        category: o.category,
        sourceSite: o.sourceSite,
        priceLabel: rialToTomanLabel(Number(o.priceRial)),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        user: { id: o.user.id, mobile: o.user.mobile, name: o.user.name },
      })),
      total,
      params
    )
  );
}
