import { NextRequest, NextResponse } from "next/server";
import { computeDualPrice } from "@/lib/pricing";
import { rialToTomanLabel } from "@/lib/money";
import { validateInput, quoteInput, ValidationError } from "@/lib/validation";

// POST /api/quote  { categoryId, site }
// قیمت فقط این‌جا (سمت سرور) محاسبه می‌شود. قیمت ارسالی از کلاینت پذیرفته نمی‌شود.
// خروجی شامل قیمت نهایی هر دو روش پرداخت است؛ درصد کارمزد هرگز به کلاینت فرستاده نمی‌شود.
export async function POST(req: NextRequest) {
  let input;
  try {
    const body = await req.json();
    input = validateInput(quoteInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  try {
    const result = await computeDualPrice(input.categoryId, input.site);
    if (!result) {
      return NextResponse.json({ error: "دسته یا سایت نامعتبر" }, { status: 422 });
    }

    return NextResponse.json({
      categoryId: result.categoryId,
      site: result.site,
      walletPriceRial: String(result.walletPriceRial),
      gatewayPriceRial: String(result.gatewayPriceRial),
      walletPriceLabel: rialToTomanLabel(result.walletPriceRial),
      gatewayPriceLabel: rialToTomanLabel(result.gatewayPriceRial),
    });
  } catch {
    return NextResponse.json({ error: "خطای پردازش" }, { status: 500 });
  }
}
