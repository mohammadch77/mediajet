import { NextRequest, NextResponse } from "next/server";
import { recordError } from "@/lib/errorLog";
import { getCurrentUser } from "@/lib/session";
import { getClientIp } from "@/lib/clientIp";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateInput, ValidationError, clientErrorInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

// گزارش‌دهی خطا بی‌صدا و بدون اثر روی کاربر است: همیشه ۲۰۴ برمی‌گردد (حتی برای ورودی نامعتبر)
// تا مرورگر پیام خطای تازه‌ای نبیند و بازخوردی به مهاجم داده نشود. حجم و نرخ محدود است.
const MAX_BODY_BYTES = 40_000;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

const NO_CONTENT = () => new NextResponse(null, { status: 204 });

// POST /api/client-errors — ثبت خطایی که در مرورگر کاربر رخ داده (عمومی؛ کاربر از session اگر لاگین باشد)
export async function POST(req: NextRequest) {
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return NO_CONTENT();

  const limit = checkRateLimit(`client-errors:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) return NO_CONTENT();

  let input;
  try {
    input = validateInput(clientErrorInput, JSON.parse(await req.text()));
  } catch (error) {
    if (!(error instanceof ValidationError) && !(error instanceof SyntaxError)) throw error;
    return NO_CONTENT();
  }

  const user = await getCurrentUser().catch(() => null);
  await recordError({
    source: "client",
    kind: input.kind,
    message: input.message,
    stack: input.stack,
    componentStack: input.componentStack,
    url: input.url,
    statusCode: input.statusCode,
    digest: input.digest,
    userAgent: req.headers.get("user-agent"),
    userId: user?.id ?? null,
  });
  return NO_CONTENT();
}
