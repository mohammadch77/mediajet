import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { CartProvider } from "@/lib/CartContext";

export const metadata: Metadata = {
  title: "مدیاجت — هر فایلی از هر سایت استوک، فقط با یک لینک",
  description:
    "سرویس دانلود تک‌فایل از پلتفرم‌های استوک خارجی برای کاربران ایرانی، با کیف پول و پرداخت ریالی.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
