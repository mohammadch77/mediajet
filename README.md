# مدیاجت (MediaJet)

سرویس دانلود تک‌فایل از پلتفرم‌های استوک. این پروژه از روی طرح Claude Design به یک اپ واقعی Next.js تبدیل شده است.

## راه‌اندازی

```bash
npm install
cp .env.example .env      # DATABASE_URL خود را بگذار
npm run db:push           # ساخت جدول‌ها روی PostgreSQL
npm run dev               # اجرای محیط توسعه روی http://localhost:3000
```

برای بیلد production:

```bash
npm run build && npm start
```

### به‌روزرسانی سرور production (هر بار که `prisma/schema.prisma` تغییر کرده)

ترتیب مهم است: **اول دیتابیس، بعد کد جدید.** اگر کد جدید روی دیتابیس قدیمی اجرا شود، هر مسیری که به جدول/ستون جدید نیاز دارد خطا می‌دهد.

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql   # ۱) پشتیبان قبل از هر تغییر اسکیمایی
git pull                                            # ۲) کد جدید
npm ci
npx prisma migrate deploy                           # ۳) اعمال migrationهای جدید (همراه با triggerهای append-only)
npm run build && <ری‌استارت سرویس>                 # ۴) بیلد و اجرای دوباره
```

- از `prisma db push` استفاده نکن: تاریخچه‌ی migration را دور می‌زند و triggerهای SQL (دفترهای مالی غیرقابل‌ویرایش) را نمی‌سازد. هر تغییر اسکیما باید یک migration در `prisma/migrations` داشته باشد.
- **cron‌های لازم** (هر ساعت، با هدر `Authorization: Bearer $CRON_SECRET`؛ `CRON_SECRET` را در `.env` بگذار):
  ```bash
  0 * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://mediajet.ir/api/cron/affiliate
  0 * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://mediajet.ir/api/cron/cleanup-files
  ```
  `/api/cron/affiliate` کمیسیون‌های «در انتظار» را آزاد می‌کند (سفارش تحویل‌شده، یا سفارش «آماده» بعد از دوره‌ی انتظار).
- **`TRUST_PROXY=true`** را فقط وقتی سایت پشت nginx خودت است بگذار؛ بدون آن IP واقعی کاربر دیده نمی‌شود و تشخیص تقلب همکاری (IP مشترک/ثبت‌نام انبوه) عملاً کار نمی‌کند.
- step 17 و بعد از آن: جدول‌های `AffiliateAccount`، `AffiliateLedger`، `AffiliatePayout` و ستون‌های همکاری روی `User` اضافه می‌شوند؛ هیچ داده‌ی موجودی تغییر نمی‌کند.

## ساختار

```
app/
  layout.tsx            چیدمان ریشه (RTL، فارسی)
  page.tsx             صفحه‌ی لندینگ (هیرو، دسته‌ها، کیف پول)
  globals.css          استایل پایه و فونت‌ها
  api/quote/route.ts   محاسبه‌ی قیمت سمت سرور
components/
  HeroScene.tsx        صحنه‌ی سه‌بعدی Three.js (کارت‌های شناور)
  OrderDrawer.tsx      پنل کشویی دو مرحله‌ای سفارش
data/
  categories.ts        منبع واحد حقیقت دسته‌ها و سایت‌ها
lib/
  money.ts             ریال/تومان و ارقام فارسی
  pricing.ts           منطق قیمت‌گذاری (سمت سرور)
  orderState.ts        state machine وضعیت سفارش
  detectSite.ts        تشخیص سایت از روی لینک
prisma/
  schema.prisma        اسکیمای دیتابیس (کاربر، کیف پول، سفارش، audit)
```

## اصول مهندسی رعایت‌شده (استاندارد ارشامان)

- **State machine** سفارش در `lib/orderState.ts` — انتقال نامعتبر رد می‌شود.
- **Audit trail** — مدل `OrderEvent` هر تغییر وضعیت را ثبت می‌کند.
- **کیف پول double-entry** — مدل `WalletTransaction` با `balanceAfter`؛ موجودی مستقیم دستکاری نمی‌شود.
- **پول به ریال** — همه‌جا `BigInt` ریال؛ نمایش به تومان؛ بدون float.
- **قیمت سمت سرور** — `app/api/quote` تنها منبع قیمت؛ کلاینت قیمت نمی‌فرستد.
- **RTL کامل** با فونت‌های Estedad + Vazirmatn + Space Grotesk.

## کارهای باقی‌مانده (فاز بعد)

- احراز هویت موبایل + OTP
- اتصال درگاه پرداخت (زرین‌پال) و وبهوک
- پیاده‌سازی ثبت سفارش واقعی (POST /api/orders) با کسر از کیف پول در یک تراکنش دیتابیس
- پنل کاربری و پنل اپراتور (صف سفارش)
- تقویم شمسی در نمایش تاریخ‌ها
