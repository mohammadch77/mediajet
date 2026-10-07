// تست بزرگ اعتبارسنج لینک (بدون DB): همه‌ی سایت‌ها، همه‌ی جفت‌های سایت×سایت، لینک‌های واقعی Shutterstock،
// صفحه‌های غیرمحصول، دامنه‌ی جعلی، لینک کثیف کاربر، سفارش تکراری و تشخیص نوع فایل.
// الگوهای «محصول» بیشتر سایت‌ها از شناخت عمومی نوشته شده‌اند (فقط Shutterstock و جستجوی Adobe با لینک واقعی تأیید شده).
import { validateProductUrl } from "../lib/productUrl";
import { ALL_SITES, SITES } from "../data/categories";

let total = 0;
const failures: string[] = [];
function check(label: string, cond: boolean, detail = "") {
  total++;
  if (!cond) failures.push(`${label}${detail ? ` → ${detail}` : ""}`);
}
const v = (u: string, site?: string) => validateProductUrl(u, site);
const okUrl = (u: string, site?: string) => {
  const r = v(u, site);
  return r.ok ? r : null;
};

// ── A) صفحه‌ی محصول معتبر هر سایت ──────────────────────────────────────────────────────────
const PRODUCT: [string, string][] = [
  [SITES.freepik, "https://www.freepik.com/free-vector/abstract-background_123456.htm"],
  [SITES.freepik, "https://www.freepik.com/premium-photo/a-cat_123456.htm"],
  [SITES.freepik, "https://www.freepik.com/free-psd/mockup_123456.htm"],
  [SITES.freepik, "https://www.freepik.com/icon/home_123456"],
  [SITES.freepik, "https://www.magnific.com/free-vector/abstract-background_123456.htm"],
  [SITES.adobeStock, "https://stock.adobe.com/images/sunset/123456789"],
  [SITES.adobeStock, "https://stock.adobe.com/fr/images/sunset/123456789"],
  [SITES.adobeStock, "https://stock.adobe.com/video/ocean/123456789"],
  [SITES.adobeStock, "https://stock.adobe.com/search?k=firing&asset_id=123456789"],
  [SITES.adobeStock, "https://stock.adobe.com/search/video?k=countdown&asset_id=123456789"],
  [SITES.envatoElements, "https://elements.envato.com/abstract-background-ABC123"],
  [SITES.shutterstock, "https://www.shutterstock.com/image-photo/sunset-over-sea-123456789"],
  [SITES.shutterstock, "https://www.shutterstock.com/video/clip-123456789-ocean"],
  [SITES.shutterstock, "https://www.shutterstock.com/image-vector/abstract-123456789"],
  [SITES.shutterstock, "https://www.shutterstock.com/es/image-photo/sunset-123456789"],
  [SITES.istock, "https://www.istockphoto.com/photo/sunset-gm123456789-123"],
  [SITES.dreamstime, "https://www.dreamstime.com/stock-photo-sunset-image123456"],
  [SITES.depositphotos, "https://depositphotos.com/123456789/stock-photo-sunset.html"],
  [SITES.rf123, "https://www.123rf.com/photo_123456789_sunset.html"],
  [SITES.vectorstock, "https://www.vectorstock.com/royalty-free-vector/abstract-vector-123456"],
  [SITES.pngtree, "https://pngtree.com/freepng/cat_123456.html"],
  [SITES.vecteezy, "https://www.vecteezy.com/vector-art/123456-abstract"],
  [SITES.lovepik, "https://lovepik.com/image-123456/sunset.html"],
  [SITES.pikbest, "https://pikbest.com/templates/ppt_123456.html"],
  [SITES.designi, "https://www.designi.com.br/123456/mockup"],
  [SITES.rawpixel, "https://www.rawpixel.com/image/123456/mockup"],
  [SITES.yellowImages, "https://yellowimages.com/stock/mockup-123456"],
  [SITES.ui8, "https://ui8.net/author/products/ui-kit"],
  [SITES.motionArray, "https://motionarray.com/stock-video/ocean-123456/"],
  [SITES.storyblocks, "https://www.storyblocks.com/video/stock/ocean-abc123"],
  [SITES.artlist, "https://artlist.io/stock-footage/clip/ocean/123456"],
  [SITES.creativeFabrica, "https://www.creativefabrica.com/product/cool-font/"],
  [SITES.iconscout, "https://iconscout.com/icon/home-123456"],
  [SITES.flaticon, "https://www.flaticon.com/free-icon/home_123456"],
  [SITES.flaticon, "https://www.flaticon.com/packs/essentials"],
];
for (const [s, u] of PRODUCT) check(`محصول معتبر ${s}`, v(u, s).ok, u);

// ── B) صفحه‌ی غیرمحصول (باید رد شود) ───────────────────────────────────────────────────────
for (const u of [
  "https://www.freepik.com/login", "https://www.freepik.com/pricing", "https://www.freepik.com/search?query=cat",
  "https://www.freepik.com/popular-vectors", "https://www.freepik.com/author/someone", "https://support.freepik.com/hc/en-us",
  "https://www.freepik.com/blog/post", "https://stock.adobe.com/search?k=firing", "https://stock.adobe.com/collections/abc",
  "https://stock.adobe.com/contributor/123/name", "https://stock.adobe.com/plans", "https://helpx.adobe.com/stock/help.html",
  "https://www.adobe.com/products/photoshop.html", "https://account.adobe.com/", "https://elements.envato.com/pricing",
  "https://elements.envato.com/sign-in", "https://market.envato.com/foo", "https://themeforest.envato.com/x",
  "https://help.elements.envato.com/hc/en-us", "https://www.shutterstock.com/search/cat", "https://www.shutterstock.com/pricing",
  "https://support.shutterstock.com/s/article/x", "https://contributor.shutterstock.com/login", "https://www.shutterstock.com/license",
  "https://www.istockphoto.com/photos/cat", "https://www.dreamstime.com/free-images", "https://www.flaticon.com/free-icons/home",
  "https://www.flaticon.com/packs", "https://www.vecteezy.com/free-vector/cat", "https://pngtree.com/so/cat", "https://ui8.net/",
  "https://ui8.net/products", "https://www.freepik.com/en", "https://www.freepik.com/index.html", "https://www.freepik.com/home",
  "https://www.freepik.com/?utm_source=x", "https://stock.adobe.com/search/audio?genres=Classical",
  "https://stock.adobe.com/collections?filters[content_type:3d]=1",
]) check("غیرمحصول رد شود", !v(u).ok, u);

// ── C) دامنه‌ی جعلی با پسوند دیگر ─────────────────────────────────────────────────────────
for (const u of [
  "https://freepik.xyz/free-vector/a_1.htm", "https://freepik.ru/free-vector/a_1.htm", "https://shutterstock.top/image-photo/a-123456",
  "https://adobe.zip/images/a/123456", "https://envato.cc/a-ABC123", "https://pngtree.tk/freepng/a_1.html", "https://designi.net/123/a",
  "https://stock.adobe.evil/images/a/123456",
]) check("پسوند جعلی رد شود", !v(u).ok, u);

// ── D) حمله ────────────────────────────────────────────────────────────────────────────────
for (const u of [
  "https://evil.com/?u=freepik.com/item", "https://evil.com/freepik.com/item", "https://freepik.evil.com/item", "https://evil-freepik.com/item",
  "https://freepik.com.evil.com/x/y", "https://freepik.com@evil.com/x/y", "https://evil.com\\@freepik.com/x/y", "https://evil.com#@freepik.com/x/y",
  "https://freepik.com%2eevil.com/x/y", "https://xn--freepik-9ve.com/x/y", "https://freерik.com/x/y", "http://127.0.0.1/x/y",
  "http://[::1]/x/y", "http://2130706433/x/y", "http://localhost/x/y", "javascript:alert(1)", "data:text/html,x", "file:///etc/passwd",
  "ftp://freepik.com/a/b", "https://freepik.com:8443/a/b",
]) check("حمله رد شود", !v(u).ok, u);

// ── E) لینک کثیف کاربر (باید تمیز و قبول شود) ──────────────────────────────────────────────
const CLEAN_TARGET = "https://www.freepik.com/free-vector/a_1.htm";
for (const u of [
  "https:/www.freepik.com/free-vector/a_1.htm", "https//www.freepik.com/free-vector/a_1.htm", "www.freepik.com/free-vector/a_1.htm",
  "FREEPIK.COM/free-vector/a_1.htm", `${CLEAN_TARGET}‏`, `‎${CLEAN_TARGET}`, `${CLEAN_TARGET}​`, `<${CLEAN_TARGET}>`,
  `${CLEAN_TARGET}.`, `${CLEAN_TARGET}،`, `"${CLEAN_TARGET}"`, `${CLEAN_TARGET})`, `لینک فایل: ${CLEAN_TARGET} لطفاً دانلود کن`,
  `${CLEAN_TARGET}\n`, `  ${CLEAN_TARGET}  `,
]) {
  const r = okUrl(u);
  check("لینک کثیف پاک شود", !!r && r.url.replace("//freepik.com", "//www.freepik.com") === CLEAN_TARGET, JSON.stringify(u) + " → " + (r ? r.url : "رد شد"));
}
// دو لینک: رد
for (const u of [
  `${CLEAN_TARGET}https://www.freepik.com/free-vector/b_2.htm`, `${CLEAN_TARGET},https://evil.com/x`,
  `${CLEAN_TARGET}\nhttps://www.freepik.com/free-vector/b_2.htm`, `${CLEAN_TARGET} https://www.freepik.com/free-vector/b_2.htm`,
]) check("دو لینک رد شود", !v(u).ok, JSON.stringify(u));
check("همان لینک دو بار = یک لینک", !!okUrl(`${CLEAN_TARGET}\n${CLEAN_TARGET}`));
check("ریدایرکت گوگل رد شود", !v(`https://www.google.com/url?q=${CLEAN_TARGET}`).ok);
check("متن بدون لینک رد شود", !v("سلام یک فایل می‌خواهم").ok);

// ── F) نویسه‌ی کنترلی/تگ/طول ──────────────────────────────────────────────────────────────
check("%00 رد شود", !v("https://www.freepik.com/free-vector/a%00b_1.htm").ok);
check("CRLF کدشده رد شود", !v("https://www.freepik.com/free-vector/a%0d%0aSet-Cookie:x_1.htm").ok);
check("تگ رد شود", !v("https://www.freepik.com/free-vector/<script>_1.htm").ok);
check("نزدیک حد طول قبول", v("https://www.freepik.com/free-vector/" + "a".repeat(1950) + "_1.htm").ok);
check("بیش از حد طول رد", !v("https://www.freepik.com/free-vector/" + "a".repeat(2100) + "_1.htm").ok);

// ── G) لینک‌های واقعی Shutterstock از کاربر ────────────────────────────────────────────────
const SS1 = "https://www.shutterstock.com/video/clip-1020058207-shanghai-china-circa-2017-daytime--pan-left?trackingId=a0923334-9de9-4094-9490-981720d4fc15&listId=searchResults";
const SS2 = "https://www.shutterstock.com/video/clip-1057009856-explosion-bomb-fire-green-screen-effect-smoke";
const SS3 = "https://www.shutterstock.com/video/clip-3484349963-woman-peeling-apple-fruit-on-outdoor-journey";
const g1 = okUrl(SS1), g2 = okUrl(SS2), g3 = okUrl(SS3);
check("SS1 ویدیو و شناسه", !!g1 && g1.assetId === "1020058207" && g1.typeCandidates.join() === "video", JSON.stringify(g1));
check("SS1 پارامتر ردیابی حذف", !!g1 && !/trackingId|listId/i.test(g1.url) && g1.notes.includes("tracking_removed"));
check("SS2 ویدیو", !!g2 && g2.assetId === "1057009856" && g2.typeCandidates.join() === "video");
check("SS3 ویدیو", !!g3 && g3.assetId === "3484349963" && g3.typeCandidates.join() === "video");
check("لینک تکراری = همان productKey", !!g3 && okUrl(SS3 + "?trackingId=zzz")?.productKey === g3.productKey);

// ── H) سفارش تکراری: یک فایل با شکل‌های مختلف = یک کلید ────────────────────────────────────
const keyOf = (u: string) => okUrl(u)?.productKey;
const k0 = keyOf("https://www.freepik.com/free-vector/a_1234.htm");
for (const u of [
  "https://freepik.com/free-vector/a_1234.htm", "http://www.freepik.com/free-vector/a_1234.htm", "https://es.freepik.com/free-vector/a_1234.htm",
  "https://www.freepik.com/free-vector/a_1234.htm?utm_source=tg&utm_medium=x", "https://www.freepik.com/free-vector/a_1234.htm#x", "https://www.FREEPIK.com/free-vector/a_1234.htm",
]) check("کلید یکسان", !!k0 && keyOf(u) === k0, u);
check("فایل دیگر = کلید دیگر", keyOf("https://www.freepik.com/free-vector/b_9999.htm") !== k0);
const sk = keyOf("https://www.shutterstock.com/video/clip-3484349963-a");
check("Shutterstock: slug عوض شود، کلید یکی", keyOf("https://www.shutterstock.com/es/video/clip-3484349963-other-slug") === sk);
const ad1 = keyOf("https://stock.adobe.com/search?k=firing&asset_id=987654321");
check("Adobe: asset_id کلید است نه عبارت جستجو", keyOf("https://stock.adobe.com/search?k=other&asset_id=987654321&trackingId=x") === ad1);
check("Adobe: asset_id متفاوت = کلید متفاوت", keyOf("https://stock.adobe.com/search?k=firing&asset_id=111111111") !== ad1);

// ── I) تشخیص نوع فایل ──────────────────────────────────────────────────────────────────────
const types = (u: string) => okUrl(u)?.typeCandidates.join(",") ?? "رد شد";
check("Shutterstock عکس", types("https://www.shutterstock.com/image-photo/x-123456789") === "photo");
check("Shutterstock وکتور", types("https://www.shutterstock.com/image-vector/x-123456789") === "vector");
check("Shutterstock ویدیو", types("https://www.shutterstock.com/video/clip-123456789-x") === "video");
check("Shutterstock نوع ناشناخته رد", !v("https://www.shutterstock.com/music/track-123456789-x").ok);
check("Adobe ویدیو از مسیر جستجو", types("https://stock.adobe.com/search/video?k=a+png&asset_id=123456789") === "video");
check("Adobe عبارت png نوع را png نمی‌کند", !types("https://stock.adobe.com/search/video?k=firing+png&asset_id=123456789").includes("png"));
check("Adobe جستجوی عادی = تصویر", types("https://stock.adobe.com/search?k=a&asset_id=123456789") === "photo,vector,png");
check("Adobe صدا (فروخته نمی‌شود) رد", !v("https://stock.adobe.com/search/audio?k=a&asset_id=123456789").ok);
check("Adobe سه‌بعدی از فیلتر", types("https://stock.adobe.com/search?k=a&asset_id=123456789&filters[content_type:3d]=1") === "3d");
check("Adobe بدون asset_id رد", !v("https://stock.adobe.com/search/video?k=a").ok);
check("Freepik ویدیو", types("https://www.freepik.com/free-video/x_123456.htm") === "video");

// ── J) ماتریس سایت×سایت ────────────────────────────────────────────────────────────────────
const base = new Map<string, string>();
for (const [s, u] of PRODUCT) if (!base.has(s)) base.set(s, u);
for (const x of ALL_SITES) for (const y of ALL_SITES) {
  const r = v(base.get(x)!, y);
  check(`ماتریس ${x}→${y}`, x === y ? r.ok : !r.ok);
}
// ادعای سایت با نام قدیمی
check("نام قدیمی Freepik در ادعا", v(PRODUCT[0][1], "Freepik").ok);

console.log(`${total} بررسی، ${failures.length} ناموفق`);
for (const f of failures) console.log("  ✗", f);
if (failures.length) process.exit(1);
console.log("همه موفق");
