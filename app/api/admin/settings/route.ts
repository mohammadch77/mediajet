import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SessionError } from "@/lib/session";
import { validateInput, ValidationError, updateSettingInput, deleteSettingInput } from "@/lib/validation";
import { deleteSetting, listSettingStatuses, setSetting } from "@/lib/settings";

// GET /api/admin/settings
// لیست تنظیمات حساس و وضعیت‌شان (تنظیم‌شده/نشده)؛ هرگز مقدار واقعی برگردانده نمی‌شود. فقط admin.
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const settings = await listSettingStatuses();
  return NextResponse.json({ settings });
}

// POST /api/admin/settings
// ذخیره‌ی یک تنظیم (رمزنگاری قبل از ذخیره). فقط admin.
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
    input = validateInput(updateSettingInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  try {
    await setSetting(input.key, input.value, admin.id);
  } catch (error) {
    // معمولاً یعنی ENCRYPTION_KEY در .env سرور تنظیم نشده یا ۶۴ کاراکتر هگز نیست.
    console.error("[admin settings] ذخیره ناموفق:", error);
    return NextResponse.json(
      { error: "ذخیره‌ی تنظیم ناموفق بود. کلید رمزنگاری سرور (ENCRYPTION_KEY) را بررسی کن." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/settings
// حذف مقدار ذخیره‌شده‌ی یک تنظیم تا دوباره از .env یا رفتار پیش‌فرض استفاده شود. فقط admin.
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  let input;
  try {
    input = validateInput(deleteSettingInput, await req.json());
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  await deleteSetting(input.key);
  return NextResponse.json({ ok: true });
}
