import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SessionError } from "@/lib/session";
import { validateInput, ValidationError, createPageInput } from "@/lib/validation";
import { listPages, createPage } from "@/lib/pages";
import { prisma } from "@/lib/db";

// GET /api/admin/pages
// لیست همه‌ی صفحات متن‌آزاد. فقط admin.
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const pages = await listPages();
  return NextResponse.json({ pages });
}

// POST /api/admin/pages
// ساخت صفحه‌ی جدید (پیش‌نویس خالی). فقط admin.
export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  let input;
  try {
    const body = await req.json();
    input = validateInput(createPageInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  const existing = await prisma.page.findUnique({ where: { slug: input.slug } });
  if (existing) {
    return NextResponse.json({ error: "صفحه‌ای با این نامک از قبل وجود دارد." }, { status: 400 });
  }

  const page = await createPage(input.slug, input.title, admin.id);
  return NextResponse.json({ page });
}
