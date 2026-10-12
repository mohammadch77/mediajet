# گت‌استوک (GetStock)

سرویس دانلود تک‌فایل از پلتفرم‌های استوک در [getstock.ir](https://getstock.ir). کاربر لینک محصول را از یکی از سایت‌های پشتیبانی‌شده (Freepik/Magnific، Adobe Stock، Shutterstock، Envato Elements و …) می‌فرستد، مبلغ ناچیزی می‌پردازد و فایل اصلی و باکیفیت را در پنل خود تحویل می‌گیرد؛ بدون اشتراک ماهانه گران.

> نام قدیمی پروژه «MediaJet» بود؛ بعضی شناسه‌های داخلی (مثل نام کوکی نشست) برای حفظ نشست کاربران همان قدیمی مانده‌اند.

**قوانین الزامی پروژه:** [RULES.md](./RULES.md) · **راهنمای Claude:** [CLAUDE.md](./CLAUDE.md)

## امکانات

**برای کاربر**
- ثبت‌نام و ورود با موبایل (OTP پیامکی) یا رمز؛ بازیابی رمز
- ۱۴ دسته‌ی محتوا و ۲۴ سایت پشتیبانی‌شده؛ قیمت هر جفت (دسته × سایت) سمت سرور محاسبه می‌شود
- اعتبارسنجی سخت‌گیرانه‌ی لینک محصول (دامنه‌ی مجاز، هم‌خوان با سایت انتخاب‌شده)
- سبد خرید چندآیتمی (یک سفارش، چند فایل، یک پرداخت)
- کیف پول (شارژ آنلاین، پرداخت سفارش با کیف پول)، پرداخت آنلاین با زرین‌پال؛ انتخاب روش پرداخت قبل از پرداخت
- داشبورد سفارش‌ها با وضعیت، تحویل فایل، پرداخت مجدد و انصراف، اعلان‌ها
- همکاری در فروش (کد معرفی، کمیسیون، تشخیص تقلب)
- وبلاگ و صفحه‌های محتوایی، تم تیره/روشن، تقویم شمسی، RTL کامل

**برای اپراتور و ادمین**
- صف سفارش اپراتور و تحویل فایل (فایل بالای ۲۰ مگابایت جداگانه از طریق پشتیبانی)
- ادمین: کاربران، سفارش‌ها (با دسته و همه‌ی آیتم‌ها)، کیف پول و تعدیل دستی با دلیل اجباری، تراکنش‌ها، همکاری در فروش، گزارش‌ها، محتوا، صفحه‌ها، وبلاگ، تنظیمات
- **خطاها:** ثبت بی‌صدای خطاهای مرورگر و سرور با فایل/خط/ستون (source map)، ادغام تکراری‌ها، حل‌شده/بازکردن
- **حالت سایت:** کلید «عادی ⇄ در حال به‌روزرسانی» با صفحه‌ی ثابت nginx (در خرابی سرور هم نمایش داده می‌شود)
- **ابزار توسعه:** ویرایشگر کد، همگام‌سازی گیت‌هاب، نسخه‌های پشتیبان، deploy از پنل (با قفل رمز مجدد و ردّ حسابرسی)
- اطلاع‌رسانی تلگرام به نقش‌های مالی/اپراتور/پشتیبانی (شامل روش پرداخت، شارژ و تعدیل کیف پول)

**تجربه‌ی خطا:** کاربر هرگز متن فنی نمی‌بیند؛ صفحه‌ی ۴۰۴ اختصاصی و بازیابی نرم بعد از خطا.

## فناوری‌ها

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Three.js (صحنه‌ی هیرو) · Prisma 5 + PostgreSQL · zod · PM2 + nginx · CDN آروان‌کلود · زرین‌پال · ایران‌پیامک · ربات تلگرام (با relay).

## راه‌اندازی محلی

```bash
npm install
cp .env.example .env      # DATABASE_URL و ENCRYPTION_KEY را بگذار
npx prisma migrate deploy # ساخت جدول‌ها (همراه با triggerهای SQL)
npm run dev               # http://localhost:3000
```

دیتابیس محلی با `docker compose up -d` بالا می‌آید. برای بیلد production: `npm run build && npm start`.

> از `prisma db push` استفاده نکن: تاریخچه‌ی migration را دور می‌زند و triggerهای SQL (دفترهای مالی غیرقابل‌ویرایش) را نمی‌سازد. هر تغییر اسکیما باید یک migration در `prisma/migrations` داشته باشد.

## متغیرهای محیطی

همه در `.env.example` توضیح دارند. مهم‌ترین‌ها:

| متغیر | کاربرد |
|---|---|
| `DATABASE_URL` | اتصال PostgreSQL |
| `ENCRYPTION_KEY` | رمزنگاری کلیدهای تنظیمات (تغییرش کلیدهای ذخیره‌شده را نامعتبر می‌کند) |
| `APP_BASE_URL` | آدرس عمومی سایت (برای بازگشت درگاه و لینک‌ها) |
| `TRUST_PROXY=true` | فقط وقتی سایت پشت nginx خودت است؛ برای IP واقعی کاربر |
| `CRON_SECRET` | احراز هویت cronهای ساعتی |
| `ADMIN_IDE_ENABLED` | روشن‌کردن «ابزار توسعه» در پنل ادمین |
| `MAINTENANCE_FLAG_PATH` | مسیر فایل پرچم حالت به‌روزرسانی (باید با nginx یکی باشد) |
| `ERROR_SOURCE_MAPS=false` | خاموش‌کردن ساخت source map (build سبک‌تر، بدون شماره‌ی خط مرورگر) |

کلیدهای درگاه، پیامک، تلگرام و گیت‌هاب **در `.env` نیستند**؛ از «پنل ادمین ← تنظیمات» وارد می‌شوند و بعد از ذخیره نمایش داده نمی‌شوند.

## ساختار

```
app/                 صفحه‌ها و API (کاربر، سبد، داشبورد، اپراتور، ادمین، وبلاگ)
  admin/             پنل مدیریت (سفارش‌ها، کاربران، کیف پول، خطاها، تنظیمات، ابزار توسعه، …)
  api/               مسیرهای API (zod + session + rate limit)
  not-found.tsx, error.tsx, global-error.tsx   صفحه‌های ۴۰۴ و بازیابی
components/          کامپوننت‌ها (HomeClient، OrderDrawer، OrderPayDialog، StatusScreen، admin/…)
data/categories.ts   منبع واحد حقیقت دسته‌ها، سایت‌ها و قیمت‌ها
lib/                 منطق مشترک
  pricing.ts, orderState.ts, orderPay.ts, wallet.ts, payment.ts      پول و سفارش
  productUrl.ts      اعتبارسنجی لینک، تشخیص سایت/نوع فایل، کلید یکتای فایل (قواعد هر سایت: data/siteRules.ts)
  errorLog.ts, serverErrorHook.ts, sourceMap.ts, maintenance.ts      پایش خطا و حالت تعمیر
  ide/               ابزار توسعه (فایل‌ها، deploy، همگام‌سازی گیت‌هاب)
prisma/              اسکیما و migrationها
scripts/             تست‌ها (test-*.ts) و ابزارهای کمکی
deploy/              backup.sh و تکه‌های nginx (nginx-snippets.conf)
public/maintenance.html   صفحه‌ی ثابت «در حال به‌روزرسانی»
telegram-relay/      Cloudflare Worker برای عبور درخواست‌های تلگرام
```

## حقوقی و حریم خصوصی

صفحه‌های `/terms`، `/privacy`، `/cookies`، `/refund` (قالب `components/LegalPage.tsx`، فوتر مشترک `components/SiteFooter.tsx`، ثابت‌ها در `lib/legal.ts`). مشخصات حقوقی کسب‌وکار از پنل ادمین ← محتوا. گزارش کامل و فهرست مواردِ نیازمند وکیل: `docs/LEGAL_REVIEW.md`.

## تست‌ها

اسکریپت‌ها با `tsx` اجرا می‌شوند، مثلاً:

```bash
npx tsx scripts/test-product-url.ts
npx tsx scripts/test-product-url-big.ts   # همه‌ی سایت‌ها، لینک کثیف، سفارش تکراری، تشخیص نوع
npx tsx scripts/test-error-log.ts
npx tsx scripts/test-maintenance.ts
```

بعضی تست‌ها (سفارش، کیف پول، همکاری) به دیتابیس واقعی تست نیاز دارند. پیش از هر کامیت: `npx tsc --noEmit` باید روی کل پروژه پاس شود.

## استقرار روی سرور

پوشه‌ی برنامه روی سرور (`/var/www`) مخزن گیت نیست؛ تغییرات با **clone + diff + `git apply`** اعمال می‌شوند. روال کامل، قواعد ریز و بکاپ در [RULES.md ← بخش ۱۲](./RULES.md#۱۲-استقرار-و-عملیات-سرور) آمده است. خلاصه:

```bash
cd /root && rm -rf mj && git clone <آدرس مخزن> mj
cd mj && git diff <آخرین_کامیت_اعمال‌شده> HEAD -- . ':!package-lock.json' > /root/x.patch
cd /var/www && git apply --check --ignore-whitespace /root/x.patch && git apply --ignore-whitespace /root/x.patch
npm install                                    # فقط اگر وابستگی عوض شده
npx prisma migrate deploy && npx prisma generate   # فقط اگر اسکیما عوض شده
npx tsc --noEmit && npm run build && pm2 restart getstock
```

ترتیب مهم است: **اول دیتابیس، بعد کد جدید.**

### cronها

بکاپ هفتگی (`deploy/backup.sh`، نگه‌داری ۲ نسخه) و دو cron ساعتی با هدر `Authorization: Bearer $CRON_SECRET`:

```bash
0 * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://getstock.ir/api/cron/affiliate
0 * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://getstock.ir/api/cron/cleanup-files
```

`/api/cron/affiliate` کمیسیون‌های «در انتظار» را آزاد می‌کند؛ `/api/cron/cleanup-files` فایل‌های کوچک روی دیسک را که بیش از ۲۴ ساعت از آخرین دسترسی‌شان گذشته پاک می‌کند.

### حالت به‌روزرسانی (nginx)

تکه‌های `deploy/nginx-snippets.conf` را داخل بلوک `server` سایت (قبل از `location /`) بگذار، سپس `nginx -t && systemctl reload nginx`. بدون آن، کلید «حالت سایت» فقط فایل پرچم را می‌سازد و کاربران صفحه‌ی تعمیر را نمی‌بینند.

## اصول مهندسی

- **State machine** سفارش (`lib/orderState.ts`) و **audit trail** فقط-افزودنی (`OrderEvent`)
- **کیف پول double-entry** با `balanceAfter`؛ موجودی مستقیم دستکاری نمی‌شود
- **پول به ریال** با `BigInt`؛ عملیات مالی در `prisma.$transaction` با قفل ردیف؛ idempotency روی پرداخت و سفارش
- **قیمت فقط سمت سرور**؛ هر ورودی با zod اعتبارسنجی می‌شود
- **امنیت:** هویت از session، کنترل نقش، rate limit، رازها فقط از پنل ادمین
- جزئیات کامل: [RULES.md](./RULES.md)

## وبلاگ، سئو و نقشه‌ی سایت

- دسته‌های وبلاگ: `lib/blogCategories.ts` (منبع واحد؛ لیست، صفحه‌ی دسته، ادمین، sitemap).
- مقاله‌های اولیه: `data/blog/*.ts` + `data/blogSeed.ts`؛ بارگذاری در دیتابیس: `npx tsx scripts/seed-blog.ts` (idempotent؛ `--force` برای بازنویسی). به یک کاربر ادمین نیاز دارد.
- عکس‌های شاخص: `public/blog/*.png` (تولید با `scripts/gen-blog-covers.py`).
- `app/sitemap.ts` (پویا: صفحه‌ها، دسته‌ها و مقاله‌ها) و `public/robots.txt` آدرس `https://getstock.ir/sitemap.xml` را معرفی می‌کنند.
- پس از استقرار: در Google Search Console دامنه را تأیید کن، sitemap را ثبت کن و برای آدرس مقاله‌ها «Request indexing» بزن.
- پیش از انتشار، لینک‌های خارجی داخل مقاله‌ها را یک‌بار دستی باز کن.

### کلیدواژه‌ی کانونی و الگوی مقاله
- هر مقاله/صفحه فیلد `focusKeyword` دارد؛ در ادمین پنل «چک‌لیست سئو» (lib/seoCheck.ts) پیش‌نمایش گوگل و ۱۶ بررسی زنده نشان می‌دهد.
- مقاله‌ی جدید: `/admin/blog` ← «ساخت نوشته» (با تیک الگوی استاندارد، lib/blogTemplate.ts).
- بررسی مقاله‌های seed بدون دیتابیس: `npx tsx scripts/check-blog-seo.ts`.
- برچسب‌ها فقط در meta/JSON-LD هستند و به کاربر نمایش داده نمی‌شوند.
- برای ثبت کلیدواژه‌ی مقاله‌های قبلاً seed‌شده: `npx tsx scripts/seed-blog.ts --force` (متن مقاله‌های seed را بازنویسی می‌کند).

### فیلتر و بازدید مقاله‌ها
- `/blog` و `/blog/category/:slug`: جست‌وجو (`?q=`)، مرتب‌سازی (`?sort=new|popular|old`) و صفحه‌بندی؛ صفحه‌های فیلترشده `noindex` هستند و canonical همان آدرس پایه است.
- بازدید: ستون `BlogPost.views` با `POST /api/blog/:slug/view` (بدون کوکی؛ ربات‌ها شمرده نمی‌شوند؛ هر IP برای هر مقاله حداکثر یک بازدید در ۳۰ دقیقه، در حافظه‌ی سرور).
- پس از استقرار مایگریشن `blog_views` لازم است (`npx prisma migrate deploy && npx prisma generate`).
