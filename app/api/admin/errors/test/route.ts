import { NextResponse } from "next/server";
import { requireAdmin, SessionError } from "@/lib/session";

export const dynamic = "force-dynamic";

// POST /api/admin/errors/test — یک خطای آزمایشی عمداً پرتاب می‌کند تا ادمین مطمئن شود ثبت خطای سمت سرور
// (هوک console.error/unhandled) واقعاً کار می‌کند. پاسخ ۵۰۰ و ظاهر شدن ردیف جدید در فهرست = سالم.
export async function POST() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
  const error = new Error("خطای آزمایشی سمت سرور (ساخته‌شده از پنل ادمین)");
  console.error("[آزمایش لاگ خطا]", error);
  return NextResponse.json({ ok: true, note: "خطای آزمایشی ثبت شد؛ تا چند ثانیه دیگر در فهرست می‌آید." });
}
