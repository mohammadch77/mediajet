import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { removeCartItem, CartError } from "@/lib/cart";

// DELETE /api/cart/:id
// حذف یک آیتم از سبد؛ فقط اگر متعلق به سبد کاربر جاری باشد.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای مدیریت سبد خرید باید وارد شوید." }, { status: 401 });
  }

  const { id } = await params;

  try {
    await removeCartItem(currentUser.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CartError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
