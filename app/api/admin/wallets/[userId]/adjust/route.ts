import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, SessionError } from "@/lib/session";
import { validateInput, ValidationError, adminWalletAdjustInput } from "@/lib/validation";
import { adjustWalletByAdmin } from "@/lib/walletAdjust";
import { WalletError } from "@/lib/wallet";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { rialToTomanLabel } from "@/lib/money";
import { notifyWalletChange } from "@/lib/telegram";

// تعدیل دستی پول، مسیر حساس مالی است: حداکثر ۳۰ بار در دقیقه برای هر ادمین.
const ADJUST_RATE_LIMIT = 30;
const ADJUST_RATE_WINDOW_MS = 60_000;

// POST /api/admin/wallets/:userId/adjust  { direction, amountRial, reason, idempotencyKey }
// افزایش یا کاهش دستی موجودی کیف پول کاربر. فقط admin؛ هویت ادمین از session می‌آید.
export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const limit = checkRateLimit(`admin-wallet-adjust:${admin.id}`, ADJUST_RATE_LIMIT, ADJUST_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });
  }

  let input;
  try {
    input = validateInput(adminWalletAdjustInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const tx = await adjustWalletByAdmin({
      adminId: admin.id,
      userId: params.userId,
      direction: input.direction,
      amountRial: BigInt(input.amountRial),
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
    });
    notifyWalletChange({
      userId: params.userId,
      kind: input.direction === "credit" ? "admin_credit" : "admin_debit",
      amountRial: tx.amountRial,
      balanceAfterRial: tx.balanceAfter,
      reason: input.reason,
      adminLabel: admin.name ? `${admin.name} (${admin.mobile})` : admin.mobile,
    });
    return NextResponse.json({
      ok: true,
      balanceLabel: rialToTomanLabel(Number(tx.balanceAfter)),
    });
  } catch (error) {
    if (error instanceof WalletError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    throw error;
  }
}
