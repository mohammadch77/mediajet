// رله‌ی Bot API تلگرام برای سرور گت‌استوک که داخل ایران است و به api.telegram.org دسترسی ندارد.
// هر درخواست مجاز را عیناً (method، body، Content-Type) به api.telegram.org می‌فرستد و پاسخ را
// به‌صورت stream برمی‌گرداند. فقط مسیرهای /bot<token>/<method> و /file/bot<token>/<path> پذیرفته می‌شوند.
// احراز هویت: هدر X-Relay-Secret باید با متغیر محرمانه‌ی RELAY_SECRET برابر باشد.

const UPSTREAM = "https://api.telegram.org";
const ALLOWED_PATH = /^\/(file\/)?bot\d+:[A-Za-z0-9_-]+\/[^\s]+$/;
// فقط هدرهایی که Bot API لازم دارد؛ هدرهای دیگر (از جمله X-Relay-Secret و IP کلاینت) فوروارد نمی‌شوند.
const FORWARDED_REQUEST_HEADERS = ["content-type", "content-length", "accept"];

function json(status, description) {
  return new Response(JSON.stringify({ ok: false, error_code: status, description }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function secretMatches(received, expected) {
  const enc = new TextEncoder();
  // هش هر دو مقدار تا مقایسه با طول ثابت و در زمان ثابت انجام شود.
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(received)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

export default {
  async fetch(request, env) {
    if (!env.RELAY_SECRET) {
      return json(503, "relay is not configured (RELAY_SECRET missing)");
    }
    const received = request.headers.get("X-Relay-Secret") ?? "";
    if (!(await secretMatches(received, env.RELAY_SECRET))) {
      return json(401, "unauthorized");
    }

    const url = new URL(request.url);
    if (!ALLOWED_PATH.test(url.pathname)) {
      return json(404, "not found");
    }
    if (!["GET", "POST", "HEAD"].includes(request.method)) {
      return json(405, "method not allowed");
    }

    const headers = new Headers();
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    const upstream = await fetch(UPSTREAM + url.pathname + url.search, {
      method: request.method,
      headers,
      body: request.method === "POST" ? request.body : undefined,
      redirect: "follow",
    });

    // بدنه بدون بافر کردن stream می‌شود؛ فایل‌های زیر ۲۰ مگ (سقف getFile تلگرام) مشکلی ندارند.
    const responseHeaders = new Headers();
    for (const name of ["content-type", "content-length", "content-disposition"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  },
};
