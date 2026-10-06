/** @type {import('next').NextConfig} */

// source mapها فقط برای لاگ خطای پنل ادمین (نمایش «کدام خط خطا داد») ساخته می‌شوند:
//  - کلاینت: hidden-source-map (فایل .map ساخته می‌شود ولی در باندل به آن اشاره نمی‌شود)؛ فقط سرور آن‌ها را
//    از دیسک می‌خواند. در nginx دسترسی عمومی به *.map باید بسته شود (deploy/nginx-snippets.conf).
//  - سرور: source-map تا استک خطاهای سمت سرور به کد اصلی نگاشته شود (instrumentation.ts فعالش می‌کند).
// اگر build روی سرور به‌خاطر حافظه/زمان مشکل داشت: ERROR_SOURCE_MAPS=false بگذار (لاگ خطا کار می‌کند،
// فقط شماره‌ی خط به‌جای کد اصلی روی باندل نشان داده می‌شود).
const sourceMapsEnabled = process.env.ERROR_SOURCE_MAPS !== "false";

const nextConfig = {
  reactStrictMode: true,
  experimental: { instrumentationHook: true },
  webpack(config, { dev, isServer }) {
    if (!dev && sourceMapsEnabled) {
      config.devtool = isServer ? "source-map" : "hidden-source-map";
    }
    return config;
  },
};
module.exports = nextConfig;
