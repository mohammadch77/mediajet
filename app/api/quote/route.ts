import { NextRequest, NextResponse } from "next/server";
import { computePrice } from "@/lib/pricing";
import { rialToTomanLabel } from "@/lib/money";

// POST /api/quote  { categoryId, site }
// قیمت فقط این‌جا (سمت سرور) محاسبه می‌شود. قیمت ارسالی از کلاینت پذیرفته نمی‌شود.
export async function POST(req: NextRequest) {
  try {
    const { categoryId, site } = await req.json();
    if (typeof categoryId !== "string" || typeof site !== "string") {
      return NextResponse.json({ error: "ورودی نامعتبر" }, { status: 400 });
    }
    const result = computePrice(categoryId, site);
    if (!result) {
      return NextResponse.json({ error: "دسته یا سایت نامعتبر" }, { status: 422 });
    }
    return NextResponse.json({
      ...result,
      label: rialToTomanLabel(result.finalPriceRial),
    });
  } catch {
    return NextResponse.json({ error: "خطای پردازش" }, { status: 500 });
  }
}
