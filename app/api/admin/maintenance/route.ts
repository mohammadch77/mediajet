import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, SessionError } from "@/lib/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";
import { isMaintenanceOn, setMaintenance, MAINTENANCE_FLAG_PATH } from "@/lib/maintenance";
import { validateInput, ValidationError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const toggleInput = z.object({ enabled: z.boolean({ error: "مقدار نامعتبر است." }) });

/** بررسی واقعی: آیا nginx برای آدرس سایت همین الان صفحه‌ی به‌روزرسانی (۵۰۳ + هدر X-Maintenance) می‌دهد؟ */
async function probeNginx(origin: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${origin}/?mj-probe=${Date.now()}`, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(4000) });
    return res.status === 503 && res.headers.get("x-maintenance") === "1";
  } catch {
    return null;
  }
}

function siteOrigin(req: NextRequest): string | null {
  const host = req.headers.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return null;
  const proto = req.headers.get("x-forwarded-proto") === "http" ? "http" : "https";
  return `${proto}://${host}`;
}

async function guard(): Promise<{ id: string } | NextResponse> {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}

// GET /api/admin/maintenance[?verify=1] — وضعیت فعلی (و در صورت verify، اثر واقعی روی nginx)
export async function GET(req: NextRequest) {
  const admin = await guard();
  if (admin instanceof NextResponse) return admin;

  const enabled = isMaintenanceOn();
  let nginxServing: boolean | null = null;
  if (enabled && req.nextUrl.searchParams.get("verify") === "1") {
    const origin = siteOrigin(req);
    nginxServing = origin ? await probeNginx(origin) : null;
  }
  return NextResponse.json({ enabled, nginxServing, flagPath: MAINTENANCE_FLAG_PATH });
}

// POST /api/admin/maintenance { enabled } — روشن/خاموش‌کردن حالت به‌روزرسانی
export async function POST(req: NextRequest) {
  const admin = await guard();
  if (admin instanceof NextResponse) return admin;

  const limit = checkRateLimit(`admin-maintenance:${admin.id}`, 10, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: rateLimitMessage(limit.retryAfterSeconds) }, { status: 429 });

  let input;
  try {
    input = validateInput(toggleInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    setMaintenance(input.enabled);
  } catch {
    return NextResponse.json({ error: "نوشتن فایل پرچم ممکن نشد. دسترسی نوشتن پوشه‌ی برنامه یا مقدار MAINTENANCE_FLAG_PATH را بررسی کن." }, { status: 500 });
  }

  const origin = siteOrigin(req);
  const nginxServing = input.enabled && origin ? await probeNginx(origin) : null;
  return NextResponse.json({ enabled: input.enabled, nginxServing });
}
