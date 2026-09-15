import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SessionError } from "@/lib/session";
import { validateInput, ValidationError, updatePaymentSettingsInput } from "@/lib/validation";
import {
  listPaymentSettingRows,
  setPaymentSetting,
  PAYMENT_SETTING_DEFS,
} from "@/lib/paymentSettings";

const DEF_BY_KEY = new Map(PAYMENT_SETTING_DEFS.map((d) => [d.key as string, d]));

// GET /api/admin/payment-settings
// مقدار فعلی تنظیمات عددی پرداخت. فقط admin — این مقادیر هرگز به UI عمومی نمی‌روند.
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const settings = await listPaymentSettingRows();
  return NextResponse.json({ settings });
}

// POST /api/admin/payment-settings
// ذخیره‌ی یک یا چند تنظیم پرداخت. فقط admin.
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
    input = validateInput(updatePaymentSettingsInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  // بازه‌ی مجاز هر کلید جداگانه بررسی می‌شود (درصدها ۰ تا ۱۰۰، حداقل شارژ بزرگ‌تر از صفر).
  for (const field of input.fields) {
    const def = DEF_BY_KEY.get(field.key)!;
    if (field.value < def.min || field.value > def.max) {
      return NextResponse.json(
        {
          error: `«${def.label}» باید عددی بین ${def.min} و ${def.max} باشد.`,
        },
        { status: 400 },
      );
    }
  }

  for (const field of input.fields) {
    await setPaymentSetting(field.key, field.value, admin.id);
  }

  return NextResponse.json({ ok: true });
}
