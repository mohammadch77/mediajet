import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { parsePageParams, paginatedResult } from "@/lib/pagination";
import { validateInput, ValidationError, adminErrorListQuery } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/admin/errors?status=open|resolved|all&source=client|server|all&search=&page=
// فهرست خطاهای ثبت‌شده (ادغام‌شده با fingerprint)، تازه‌ترین رخداد اول. فقط admin.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }

  let query;
  try {
    query = validateInput(adminErrorListQuery, {
      status: req.nextUrl.searchParams.get("status") ?? undefined,
      source: req.nextUrl.searchParams.get("source") ?? undefined,
      search: req.nextUrl.searchParams.get("search") ?? undefined,
    });
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "پارامتر نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const params = parsePageParams(req);
  const where: Prisma.ErrorLogWhereInput = {
    ...(query.status !== "all" ? { status: query.status } : {}),
    ...(query.source !== "all" ? { source: query.source } : {}),
    ...(query.search
      ? {
          OR: [
            { message: { contains: query.search, mode: "insensitive" } },
            { file: { contains: query.search, mode: "insensitive" } },
            { url: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows, openCount] = await Promise.all([
    prisma.errorLog.count({ where }),
    prisma.errorLog.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      skip: params.skip,
      take: params.take,
      select: {
        id: true, source: true, kind: true, message: true, file: true, line: true, column: true,
        locationMapped: true, url: true, statusCode: true, count: true, status: true, firstSeenAt: true, lastSeenAt: true,
      },
    }),
    prisma.errorLog.count({ where: { status: "open" } }),
  ]);

  return NextResponse.json({
    ...paginatedResult(
      rows.map((r) => ({ ...r, firstSeenAt: r.firstSeenAt.toISOString(), lastSeenAt: r.lastSeenAt.toISOString() })),
      total,
      params,
    ),
    openCount,
  });
}
