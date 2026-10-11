// آدرس پایه‌ی سایت برای canonical، داده‌ی ساختاریافته (JSON-LD) و نقشه‌ی سایت. فقط سمت سرور استفاده شود.
export const SITE_URL = (process.env.APP_BASE_URL || "https://getstock.ir").replace(/\/+$/, "");
