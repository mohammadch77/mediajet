// پاک‌سازی HTML خروجی ویرایشگر متن (Tiptap) برای جلوگیری از XSS.
//
// از sanitize-html (مبتنی بر htmlparser2) استفاده می‌کنیم، نه isomorphic-dompurify:
// آن یکی jsdom → undici را بارگذاری می‌کرد که در `next build` روی Node 20 هنگام
// "Collecting page data" می‌شکست. sanitize-html هیچ DOM/jsdom لازم ندارد.
// این تابع هم موقع ذخیره در API و هم موقع رندر عمومی صفحه صدا زده می‌شود
// (دفاع دو لایه: حتی رکورد قدیمی یا دستکاری‌شده در دیتابیس هم موقع نمایش پاک می‌شود).
import sanitize from "sanitize-html";

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
  "code",
  "pre",
];

const ALLOWED_ATTR = ["href", "target", "rel", "class"];

const OPTIONS: sanitize.IOptions = {
  allowedTags: ALLOWED_TAGS,
  // همان اتریبیوت‌ها روی همه‌ی تگ‌ها؛ data-* و on* و style همگی حذف می‌شوند.
  allowedAttributes: { "*": ALLOWED_ATTR },
  // فقط این پروتکل‌ها در href؛ javascript:/data:/vbscript: حذف می‌شوند.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  // محتوای تگ‌های خطرناک (script/style/...) کامل دور ریخته می‌شود، نه فقط تگ.
  disallowedTagsMode: "discard",
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "embed", "svg", "math"],
};

/** خروجی خام ویرایشگر را پاک‌سازی می‌کند؛ فقط تگ‌ها/اتریبیوت‌های مجاز باقی می‌مانند. */
export function sanitizeHtml(html: string): string {
  return sanitize(html, OPTIONS);
}
