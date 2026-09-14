import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SessionError } from "@/lib/session";
import { validateInput, ValidationError, updatePageInput } from "@/lib/validation";
import { getPageBySlug, updatePage, deletePage } from "@/lib/pages";

// GET /api/admin/pages/:slug
// دریافت یک صفحه برای ویرایش. فقط admin.
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const page = await getPageBySlug(params.slug);
  if (!page) {
    return NextResponse.json({ error: "صفحه پیدا نشد." }, { status: 404 });
  }
  return NextResponse.json({ page });
}

// PUT /api/admin/pages/:slug
// ذخیره‌ی محتوا/متا/وضعیت انتشار صفحه. فقط admin. محتوای HTML پیش از ذخیره sanitize می‌شود.
export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const existing = await getPageBySlug(params.slug);
  if (!existing) {
    return NextResponse.json({ error: "صفحه پیدا نشد." }, { status: 404 });
  }

  let input;
  try {
    const body = await req.json();
    input = validateInput(updatePageInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  const page = await updatePage(
    params.slug,
    {
      title: input.title,
      contentHtml: input.contentHtml,
      published: input.published,
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
    },
    admin.id
  );

  return NextResponse.json({ page });
}

// DELETE /api/admin/pages/:slug
// حذف صفحه‌ی متن‌آزاد. فقط admin. غیرقابل بازگشت.
export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const existing = await getPageBySlug(params.slug);
  if (!existing) {
    return NextResponse.json({ error: "صفحه پیدا نشد." }, { status: 404 });
  }

  await deletePage(params.slug);
  return NextResponse.json({ ok: true });
}
