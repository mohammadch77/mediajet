import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { CartProvider } from "@/lib/CartContext";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "گت‌استوک — هر فایلی از هر سایت استوک، فقط با یک لینک",
  description:
    "سرویس دانلود تک‌فایل از پلتفرم‌های استوک خارجی برای کاربران ایرانی، با کیف پول و پرداخت ریالی.",
  keywords: ["استوک", "دانلود فایل", "فتوشاپ", "ایلاستریتور", "موسیقی", "ویدیو", "عکس"],
  authors: [{ name: "گت‌استوک" }],
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: process.env.APP_BASE_URL || "https://getstock.ir",
    title: "گت‌استوک — دانلود فایل از سایت‌های استوک بین‌المللی",
    description:
      "خریدار یک فایل از Adobe Stock، Freepik، Vectoreezy و... فقط با یک لینک و پرداخت ریالی",
    siteName: "گت‌استوک",
    images: [
      {
        url: `${process.env.APP_BASE_URL || "https://getstock.ir"}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "گت‌استوک",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "گت‌استوک — دانلود فایل از سایت‌های استوک",
    description:
      "هر فایلی از هر سایت استوک، فقط با یک لینک و پرداخت ریالی",
    images: [`${process.env.APP_BASE_URL || "https://getstock.ir"}/og-image.png`],
  },
  alternates: {
    canonical: process.env.APP_BASE_URL || "https://getstock.ir",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
