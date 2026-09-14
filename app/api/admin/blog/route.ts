import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SessionError } from "@/lib/session";
import { validateInput, ValidationError, createBlogPostInput } from "@/lib/validation";
import { listBlogPosts, createBlogPost } from "@/lib/blogPosts";
import { prisma } from "@/lib/db";

// GET /api/admin/blog
// لیست همه‌ی نوشته‌های وبلاگ. فقط admin.
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const posts = await listBlogPosts();
  return NextResponse.json({ posts });
}

// POST /api/admin/blog
// ساخت نوشته‌ی جدید (پیش‌نویس خالی). فقط admin.
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
    input = validateInput(createBlogPostInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  const existing = await prisma.blogPost.findUnique({ where: { slug: input.slug } });
  if (existing) {
    return NextResponse.json({ error: "نوشته‌ای با این نامک از قبل وجود دارد." }, { status: 400 });
  }

  const post = await createBlogPost(input.slug, input.title, admin.id);
  return NextResponse.json({ post });
}
