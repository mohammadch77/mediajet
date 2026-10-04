import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { rialToTomanLabel, toEnglishDigits } from "@/lib/money";
import { formatOrderNumber, parseOrderNumber } from "@/lib/orderNumber";
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
  const searchOrderNumber = parseOrderNumber(toEnglishDigits(search));
  const params = parsePageParams(req);

  const where: Prisma.OrderWhereInput = {
    ...(statusParam ? { status: statusParam as OrderStatus } : {}),
    ...(search
      ? {
          OR: [
            // orderNumber در دیتابیس Int32 است؛ عدد بزرگ‌تر باعث خطای کوئری (۵۰۰) می‌شد.
            ...(searchOrderNumber !== null && searchOrderNumber <= 2147483647
              ? [{ orderNumber: searchOrderNumber }]
              : []),
            { items: { some: { sourceSite: { contains: search, mode: "insensitive" } } } },
            { items: { some: { category: { contains: search, mode: "insensitive" } } } },
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
      include: { user: true, items: { orderBy: { position: "asc" } } },
    }),
  ]);

  // TODO(cart-ui): فعلاً فقط اولین آیتم هر سفارش نمایش داده می‌شود.
  return NextResponse.json(
    paginatedResult(
      orders.map((o) => ({
        id: o.id,
        orderNumber: formatOrderNumber(o.orderNumber),
        category: o.items[0]?.category ?? null,
        sourceSite: o.items[0]?.sourceSite ?? null,
        priceLabel: rialToTomanLabel(Number(o.totalPriceRial)),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        user: { id: o.user.id, mobile: o.user.mobile, name: o.user.name },
      })),
      total,
      params
    )
  );
}
