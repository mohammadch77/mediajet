import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCartItems } from "@/lib/cart";
import { computeCartDualTotal } from "@/lib/pricing";
import { rialToTomanLabel } from "@/lib/money";

// GET /api/cart/quote
// مجموع سبد کاربر جاری برای هر دو روش پرداخت. قیمت فقط سمت سرور محاسبه می‌شود.
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای دیدن جمع سبد خرید باید وارد شوید." }, { status: 401 });
  }

  const items = await getCartItems(currentUser.id);
  if (items.length === 0) {
    return NextResponse.json({ itemCount: 0, subtotalRial: "0", walletTotalRial: "0", gatewayTotalRial: "0" });
  }

  const total = await computeCartDualTotal(items.map((i) => ({ categoryId: i.category, site: i.sourceSite })));
  if (!total) {
    return NextResponse.json({ error: "محاسبه‌ی قیمت سبد با خطا مواجه شد." }, { status: 422 });
  }

  return NextResponse.json({
    itemCount: items.length,
    subtotalRial: String(total.subtotalRial),
    walletTotalRial: String(total.walletTotalRial),
    gatewayTotalRial: String(total.gatewayTotalRial),
    walletTotalLabel: rialToTomanLabel(total.walletTotalRial),
    gatewayTotalLabel: rialToTomanLabel(total.gatewayTotalRial),
  });
}
