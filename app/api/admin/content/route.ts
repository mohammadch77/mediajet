import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin, SessionError } from "@/lib/session";
import { validateInput, ValidationError, updateContentInput } from "@/lib/validation";
import { listContentRows, setContent } from "@/lib/content";

// GET /api/admin/content
// لیست تمام فیلدهای محتوای سایت با مقدار فعلی (تنظیم‌شده یا پیش‌فرض). فقط admin.
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const content = await listContentRows();
  return NextResponse.json({ content });
}

// POST /api/admin/content
// ذخیره‌ی یک یا چند فیلد محتوا. فقط admin.
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
    input = validateInput(updateContentInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  for (const field of input.fields) {
    await setContent(field.key, field.value, admin.id);
  }

  // کش صفحه‌ی اصلی و سایر صفحاتی که محتوا نمایش می‌دهند پاک می‌شود.
  revalidatePath("/");
  revalidatePath("/p/[slug]", "page");

  return NextResponse.json({ ok: true });
}
