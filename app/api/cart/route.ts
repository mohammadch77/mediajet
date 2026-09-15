import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getCartItems, addCartItem, CartError } from "@/lib/cart";
import { rialToTomanLabel } from "@/lib/money";
import { categoryById } from "@/data/categories";
import { validateInput, addCartItemInput, ValidationError } from "@/lib/validation";

// GET /api/cart
// آیتم‌های سبد کاربر جاری.
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای دیدن سبد خرید باید وارد شوید." }, { status: 401 });
  }

  const items = await getCartItems(currentUser.id);

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      categoryId: item.category,
      categoryTitle: categoryById(item.category)?.title ?? item.category,
      sourceSite: item.sourceSite,
      productUrl: item.productUrl,
      priceRial: item.priceRial.toString(),
      priceLabel: rialToTomanLabel(Number(item.priceRial)),
    })),
  });
}

// POST /api/cart  { categoryId, site, productUrl }
// افزودن آیتم به سبد؛ قیمت فقط سمت سرور محاسبه می‌شود.
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای افزودن به سبد باید وارد شوید." }, { status: 401 });
  }

  let input;
  try {
    const body = await req.json();
    input = validateInput(addCartItemInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  try {
    const item = await addCartItem(currentUser.id, input);
    return NextResponse.json({
      id: item.id,
      categoryId: item.category,
      categoryTitle: categoryById(item.category)?.title ?? item.category,
      sourceSite: item.sourceSite,
      productUrl: item.productUrl,
      priceRial: item.priceRial.toString(),
      priceLabel: rialToTomanLabel(Number(item.priceRial)),
    });
  } catch (error) {
    if (error instanceof CartError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
