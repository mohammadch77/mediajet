// پاک‌سازی HTML خروجی ویرایشگر متن (Tiptap) برای جلوگیری از XSS.
//
// isomorphic-dompurify هم روی سرور (با jsdom) و هم روی کلاینت کار می‌کند، بنابراین
// می‌توانیم دقیقاً همان منطق sanitize را هم موقع ذخیره در API و هم موقع رندر عمومی
// صفحه استفاده کنیم (دفاع دو لایه: حتی اگر رکوردی قدیمی یا دستکاری‌شده در دیتابیس
// باشد، باز هم موقع نمایش پاک‌سازی می‌شود).
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "hr",
  "span",
];

const ALLOWED_ATTR = ["href", "target", "rel", "class"];

/** خروجی خام ویرایشگر را پاک‌سازی می‌کند؛ فقط تگ‌ها/اتریبیوت‌های مجاز باقی می‌مانند. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
