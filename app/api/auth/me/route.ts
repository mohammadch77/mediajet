import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

// GET /api/auth/me
// کاربر جاری را از روی نشست برمی‌گرداند؛ اگر واردنشده باشد user: null.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });

  return NextResponse.json({
    user: {
      id: user.id,
      mobile: user.mobile,
      name: user.name,
      role: user.role,
      walletBalanceRial: (wallet?.balanceRial ?? 0n).toString(),
    },
  });
}
