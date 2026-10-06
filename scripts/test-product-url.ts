// تست اعتبارسنجی لینک محصول (بدون DB): دامنه‌ی واقعی، scheme، سایت ادعاشده، صفحه‌ی محصول و zod.
import { validateProductUrl, matchSiteByHost } from "../lib/productUrl";
import Module from "module";

let passed = 0;
function ok(cond: unknown, label: string) {
  if (!cond) { console.error("FAIL:", label); process.exit(1); }
  passed++;
}
const good = (url: string, site?: string) => validateProductUrl(url, site);

// معتبر
ok(good("https://www.freepik.com/free-vector/abc_123.htm").ok, "freepik عادی");
ok(good("https://elements.envato.com/some-item-ABC123", "Envato Elements").ok, "زیردامنه‌ی envato با سایت ادعاشده");
ok(good("https://stock.adobe.com/images/x/123").ok, "adobe stock");
ok(good("https://www.istockphoto.com/photo/gm123").ok, "istockphoto (alias)");
ok(good("https://designi.com.br/item/1").ok, "پسوند دومرحله‌ای designi.com.br");
ok(good("freepik.com/free-vector/abc").ok, "بدون scheme = https");
const n = good("http://www.freepik.com:80/free-vector/abc#frag");
ok(n.ok && n.url === "https://www.freepik.com/free-vector/abc", "نرمال‌سازی: https، بدون پورت و hash");

// حمله‌ها / نامعتبر
ok(!good("https://evil.com/?u=freepik.com/item").ok, "اسم سایت در query");
ok(!good("https://evil.com/freepik.com/item").ok, "اسم سایت در path");
ok(!good("https://freepik.evil.com/item").ok, "freepik به‌عنوان زیردامنه‌ی دامنه‌ی دیگر");
ok(!good("https://evil-freepik.com/item").ok, "دامنه‌ی مشابه evil-freepik");
ok(!good("https://freepik.com.evil.com/item").ok, "freepik.com.evil.com");
ok(!good("https://user:pass@freepik.com/item").ok, "نام‌کاربری/رمز");
ok(!good("https://freepik.com:8443/item").ok, "پورت غیرمجاز");
ok(!good("javascript:alert(1)").ok, "javascript:");
ok(!good("data:text/html,<script>").ok, "data:");
ok(!good("ftp://freepik.com/a").ok, "ftp");
ok(!good("https://freepik.com/").ok, "فقط صفحه‌ی اصلی");
ok(!good("https://freepik.com").ok, "دامنه‌ی خالی بدون مسیر");
ok(!good("").ok && !good("   ").ok, "خالی");
ok(!good("https://freepik.com/a b").ok, "فاصله‌ی داخل لینک");
ok(!good("https://freepik.com/a\nhttps://evil.com").ok, "دو لینک با خط جدید");
ok(!good("https://freepik.com/" + "a".repeat(2100)).ok, "بیش از ۲۰۰۰ نویسه");
ok(!good("http://localhost/item").ok && !good("http://127.0.0.1/item").ok, "localhost/IP");
ok(!good("https://freepik.com/item", "Shutterstock").ok, "سایت ادعاشده با دامنه نمی‌خواند");
ok(!validateProductUrl(123 as unknown as string).ok, "غیررشته");
ok(matchSiteByHost("FREEPIK.COM.") === matchSiteByHost("freepik.com") && matchSiteByHost("freepik.com") !== "", "host بزرگ‌حرف و نقطه‌ی انتهایی");

// zod — lib/validation به DB وصل می‌شود؛ برای تست مستقل، ماژول db جایگزین می‌شود.
const origLoad = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...a: unknown[]) => unknown })._load = function (request: unknown, ...rest: unknown[]) {
  if (typeof request === "string" && /(^|\/)db$/.test(request)) return { prisma: {} };
  return origLoad.call(this, request, ...rest);
};
const { createOrderInput, addCartItemInput, operatorItemDeliverInput } = require("../lib/validation") as typeof import("../lib/validation");
const base = { categoryId: "x", site: "Freepik", paymentMethod: "wallet", idempotencyKey: "abc-12345" } as const;
const r1 = createOrderInput.safeParse({ ...base, productUrl: "https://evil.com/?freepik.com" });
ok(!r1.success, "zod: createOrder لینک جعلی رد می‌شود");
const r2 = createOrderInput.safeParse({ ...base, productUrl: "freepik.com/free-vector/x#h" });
ok(r2.success && r2.data.productUrl === "https://freepik.com/free-vector/x", "zod: لینک نرمال‌شده جایگزین می‌شود");
ok(!createOrderInput.safeParse({ ...base, productUrl: "https://freepik.com/a", idempotencyKey: "bad key!" }).success, "zod: idempotencyKey ناامن");
ok(!addCartItemInput.safeParse({ categoryId: "x", site: "Freepik", productUrl: "javascript:alert(1)" }).success, "zod: سبد javascript:");
ok(!addCartItemInput.safeParse({ categoryId: "x".repeat(200), site: "Freepik", productUrl: "https://freepik.com/a" }).success, "zod: categoryId طولانی");

ok(operatorItemDeliverInput.safeParse({ fileUrl: "https://cdn.example.com/f.zip" }).success, "zod: لینک تحویل https معتبر");
ok(!operatorItemDeliverInput.safeParse({ fileUrl: "javascript:alert(1)" }).success, "zod: لینک تحویل javascript: رد");
ok(!operatorItemDeliverInput.safeParse({ fileUrl: "ftp://x.com/f" }).success, "zod: لینک تحویل ftp رد");

console.log(`همه ${passed} مرحله موفق`);
