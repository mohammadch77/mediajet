import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { parsePageParams, paginatedResult } from "@/lib/pagination";
import type { Prisma } from "@prisma/client";

// GET /api/admin/users?search=&page=&pageSize=
// لیست کاربران با جستجو (موبایل/نام) و صفحه‌بندی اجباری. فقط admin.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const search = (req.nextUrl.searchParams.get("search") ?? "").trim();
  const params = parsePageParams(req);

  const where: Prisma.UserWhereInput = search
    ? {
        OR: [
          { mobile: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.take,
      include: { wallet: true, _count: { select: { orders: true } } },
    }),
  ]);

  return NextResponse.json(
    paginatedResult(
      users.map((u) => ({
        id: u.id,
        mobile: u.mobile,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        disabledAt: u.disabledAt?.toISOString() ?? null,
        walletBalanceRial: (u.wallet?.balanceRial ?? 0n).toString(),
        orderCount: u._count.orders,
      })),
      total,
      params
    )
  );
}
