# رله‌ی تلگرام (Cloudflare Worker)

سرور production گت‌استوک داخل ایران است و به `api.telegram.org` دسترسی ندارد. این Worker بیرون از ایران اجرا می‌شود و همه‌ی تماس‌های خروجی سرور با Bot API را عیناً به تلگرام می‌رساند. این تماس‌ها شامل sendMessage، answerCallbackQuery، getFile و دانلود فایل از `/file/bot<token>/...` هستند. منطق ربات همچنان داخل پروژه است و این Worker فقط درخواست‌ها را فوروارد می‌کند.

- **مسیرهای مجاز:** فقط `/bot<token>/<method>` و `/file/bot<token>/<path>`. هر مسیر دیگری 404 می‌گیرد.
- **احراز هویت:** هدر `X-Relay-Secret` باید با secret ‏`RELAY_SECRET` برابر باشد، وگرنه 401. هدرهای کلاینت (از جمله همین secret) به تلگرام فرستاده نمی‌شوند.
- **حجم:** پاسخ stream می‌شود و بافر نمی‌شود. فایل‌های بالای ۲۰ مگ اصلاً از تلگرام دانلود نمی‌شوند، چون سقف getFile همین است و سایت آن‌ها را «فایل بزرگ» علامت می‌زند.

## Deploy

```bash
cd telegram-relay
npx wrangler login
npx wrangler secret put RELAY_SECRET   # یک مقدار تصادفی طولانی، مثلاً خروجی: openssl rand -hex 32
npx wrangler deploy
```

خروجی deploy آدرس Worker را می‌دهد، مثلاً `https://getstock-telegram-relay.<account>.workers.dev`.

## اتصال سرور

در پنل ادمین، صفحه‌ی **تنظیمات ← تلگرام**، دو فیلد را پر کنید (یا همین مقادیر را در `.env` سرور بگذارید):

- `TELEGRAM_API_BASE`: آدرس Worker
- `TELEGRAM_RELAY_SECRET`: همان مقدار `RELAY_SECRET`

تغییرات بدون ری‌استارت روی تماس بعدی اثر می‌کنند. برای برگشت به اتصال مستقیم، مقدار `TELEGRAM_API_BASE` را حذف کنید.

## وب‌هوک

وب‌هوک جهت مخالف دارد، یعنی تلگرام به سرور شما وصل می‌شود. پس آدرس عمومی سرور باید از خارج از ایران در دسترس باشد. setWebhook را هم می‌توان از همین رله زد:

```bash
curl -H "X-Relay-Secret: <secret>" "https://<worker>/bot<token>/setWebhook?url=https://<domain>/api/telegram/webhook&secret_token=<webhook-secret>"
```

## بررسی سریع

```bash
curl -H "X-Relay-Secret: <secret>" "https://<worker>/bot<token>/getMe"   # → {"ok":true,...}
curl "https://<worker>/bot<token>/getMe"                                   # → 401
```
