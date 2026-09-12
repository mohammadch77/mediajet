# مدیاجت (MediaJet)

سرویس دانلود تک‌فایل از پلتفرم‌های استوک. این پروژه از روی طرح Claude Design به یک اپ واقعی Next.js تبدیل شده است.

## راه‌اندازی

```bash
npm install
cp .env.example .env      # DATABASE_URL خود را بگذار
npm run db:push           # ساخت جدول‌ها روی PostgreSQL
npm run dev               # اجرای محیط توسعه روی http://localhost:3000
```

برای بیلد پroduction:

```bash
npm run build && npm start
```

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
