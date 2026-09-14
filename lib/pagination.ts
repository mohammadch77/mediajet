// صفحه‌بندی مشترک برای APIهای ادمین: هیچ‌جا لیست کامل بدون صفحه‌بندی برنگردانده می‌شود.

import type { NextRequest } from "next/server";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export type PageParams = { page: number; pageSize: number; skip: number; take: number };

export function parsePageParams(req: NextRequest, prefix = ""): PageParams {
  const pageRaw = Number(req.nextUrl.searchParams.get(`${prefix}page`) ?? "1");
  const pageSizeRaw = Number(
    req.nextUrl.searchParams.get(`${prefix}pageSize`) ?? String(DEFAULT_PAGE_SIZE)
  );

  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
      ? Math.min(Math.floor(pageSizeRaw), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function paginatedResult<T>(items: T[], total: number, params: PageParams) {
  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}
