import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SessionError } from "@/lib/session";
import { validateInput, ValidationError, updateBlogPostInput } from "@/lib/validation";
import { getBlogPostBySlug, updateBlogPost, deleteBlogPost } from "@/lib/blogPosts";

// GET /api/admin/blog/:slug
// دریافت یک نوشته برای ویرایش. فقط admin.
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const post = await getBlogPostBySlug(params.slug);
  if (!post) {
    return NextResponse.json({ error: "نوشته پیدا نشد." }, { status: 404 });
  }
  return NextResponse.json({ post });
}

// PUT /api/admin/blog/:slug
// ذخیره‌ی محتوا/متا/وضعیت انتشار نوشته. فقط admin. محتوای HTML پیش از ذخیره sanitize می‌شود.
export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const existing = await getBlogPostBySlug(params.slug);
  if (!existing) {
    return NextResponse.json({ error: "نوشته پیدا نشد." }, { status: 404 });
  }

  let input;
  try {
    const body = await req.json();
    input = validateInput(updateBlogPostInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  const post = await updateBlogPost(
    params.slug,
    {
      title: input.title,
      excerpt: input.excerpt,
      contentHtml: input.contentHtml,
      coverImage: input.coverImage,
      category: input.category,
      tags: input.tags,
      published: input.published,
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
    },
    existing
  );

  return NextResponse.json({ post });
}

// DELETE /api/admin/blog/:slug
// حذف نوشته‌ی وبلاگ. فقط admin. غیرقابل بازگشت.
export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const existing = await getBlogPostBySlug(params.slug);
  if (!existing) {
    return NextResponse.json({ error: "نوشته پیدا نشد." }, { status: 404 });
  }

  await deleteBlogPost(params.slug);
  return NextResponse.json({ ok: true });
}
