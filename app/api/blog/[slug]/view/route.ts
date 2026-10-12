import { NextRequest, NextResponse } from "next/server";
import { incrementBlogViews } from "@/lib/blogPosts";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";

const SLUG = /^[a-z0-9-]{1,80}$/;
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|curl|wget|python|axios/i;

// POST /api/blog/:slug/view
// شمارنده‌ی بازدید مقاله. عمومی و بدون کوکی یا ذخیره‌ی IP: IP فقط برای محدودیت نرخ در حافظه‌ی سرور
// نگه داشته می‌شود (هر IP حداکثر یک بازدید برای هر مقاله در ۳۰ دقیقه). ربات‌ها شمرده نمی‌شوند.
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!SLUG.test(params.slug)) return new NextResponse(null, { status: 204 });
  if (BOT.test(req.headers.get("user-agent") ?? "")) return new NextResponse(null, { status: 204 });
  const limit = checkRateLimit(`blogview:${getClientIp(req)}:${params.slug}`, 1, 30 * 60 * 1000);
  if (!limit.allowed) return new NextResponse(null, { status: 204 });
  try {
    await incrementBlogViews(params.slug);
  } catch {
    // شمارنده‌ی بازدید هیچ‌وقت نباید روی تجربه‌ی کاربر اثر بگذارد.
  }
  return new NextResponse(null, { status: 204 });
}
