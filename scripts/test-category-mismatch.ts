// تست منطق خالصِ «دسته‌ی اشتباه» (بدون DB): تصمیم اصلاح/بازگشت وجه، تقسیم سهم آیتم، وضعیت سفارش با آیتم لغوشده.
import Module from "module";

// lib/categoryMismatch به db/telegram وصل است؛ برای تست منطق خالص آن‌ها را stub می‌کنیم.
const origLoad = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...a: unknown[]) => unknown })._load = function (request: unknown, ...rest: unknown[]) {
  if (typeof request === "string" && /(^|\/)(db|telegram|affiliate|wallet|delivery|notifications)(\.ts)?$/.test(request)) return new Proxy({}, { get: () => () => undefined });
  return origLoad.call(this, request, ...rest);
};

let passed = 0;
function ok(cond: unknown, label: string) {
  if (!cond) { console.error("FAIL:", label); process.exit(1); }
  passed++;
}

async function main() {
  const { planMismatch, itemRefundShare } = await import("../lib/categoryMismatch");
  const { deriveOrderStatusFromItems } = await import("../lib/orderState");
  const { sitePriceRial } = await import("../data/categories");

  // تصمیم: فقط وقتی قیمت دسته‌ی درست بیشتر است بازگشت وجه
  ok(planMismatch(690_000n, 690_000) === "fix_category", "قیمت برابر → فقط اصلاح دسته");
  ok(planMismatch(690_000n, 200_000) === "fix_category", "قیمت کمتر → فقط اصلاح دسته");
  ok(planMismatch(690_000n, 690_001) === "refund_item", "قیمت بیشتر → بازگشت وجه");

  // با داده‌ی واقعی: Shutterstock عکس ۷۵٬۰۰۰ تومان ثبت شده، ولی ویدیو ۸۶۰٬۰۰۰ تومان است
  const photo = sitePriceRial("photo", "Shutterstock");
  const video = sitePriceRial("video", "Shutterstock");
  ok(photo !== undefined && video !== undefined, "قیمت‌های Shutterstock موجود است");
  ok(planMismatch(BigInt(photo!), video!) === "refund_item", "عکس ثبت‌شده ولی ویدیو است → بازگشت وجه");
  ok(planMismatch(BigInt(video!), photo!) === "fix_category", "ویدیو ثبت‌شده ولی عکس است → اصلاح (ارزان‌تر)");

  // تقسیم سهم: دو آیتم ۱۰۰ و ۳۰۰، کل پرداخت‌شده ۴۲۰ (کارمزد ۵٪)
  const share1 = itemRefundShare({ paidTotalRial: 420n, itemBaseRial: 100n, baseSumRial: 400n, refundedSoFarRial: 0n, isLastActiveItem: false });
  ok(share1 === 105n, "سهم متناسب آیتم اول با کارمزد");
  // آیتم آخر باقیمانده‌ی دقیق را می‌گیرد: مجموع برگشتی = کل پرداخت‌شده
  const share2 = itemRefundShare({ paidTotalRial: 420n, itemBaseRial: 300n, baseSumRial: 400n, refundedSoFarRial: share1, isLastActiveItem: true });
  ok(share2 === 315n && share1 + share2 === 420n, "آیتم آخر: مجموع دقیقاً برابر پرداخت‌شده");
  // گرد نشدن: سه آیتم برابر روی مبلغ غیرقابل‌تقسیم
  const a = itemRefundShare({ paidTotalRial: 1000n, itemBaseRial: 1n, baseSumRial: 3n, refundedSoFarRial: 0n, isLastActiveItem: false });
  const b = itemRefundShare({ paidTotalRial: 1000n, itemBaseRial: 1n, baseSumRial: 3n, refundedSoFarRial: a, isLastActiveItem: false });
  const c = itemRefundShare({ paidTotalRial: 1000n, itemBaseRial: 1n, baseSumRial: 3n, refundedSoFarRial: a + b, isLastActiveItem: true });
  ok(a + b + c === 1000n, "مجموع سه سهم بدون گرد شدن برابر ۱۰۰۰");
  let threw = false;
  try { itemRefundShare({ paidTotalRial: 100n, itemBaseRial: 50n, baseSumRial: 100n, refundedSoFarRial: 100n, isLastActiveItem: true }); } catch { threw = true; }
  ok(threw, "وقتی چیزی برای برگشت نمانده خطا می‌دهد (بازگشت وجه دوبل ممنوع)");
  threw = false;
  try { itemRefundShare({ paidTotalRial: 100n, itemBaseRial: 50n, baseSumRial: 0n, refundedSoFarRial: 0n, isLastActiveItem: false }); } catch { threw = true; }
  ok(threw, "مبلغ پایه‌ی صفر رد می‌شود");

  // وضعیت سفارش با آیتم لغوشده
  ok(deriveOrderStatusFromItems(["rejected", "delivered"]) === "delivered", "آیتم لغوشده مانع تحویل کامل نیست");
  ok(deriveOrderStatusFromItems(["rejected", "ready"]) === "ready", "آیتم لغوشده + آماده → ready");
  ok(deriveOrderStatusFromItems(["rejected", "pending"]) === "processing", "آیتم لغوشده + pending → processing");
  threw = false;
  try { deriveOrderStatusFromItems(["rejected", "rejected"]); } catch { threw = true; }
  ok(threw, "همه لغو → وضعیت مشتق‌شده ندارد (سفارش با مسیر بازگشت وجه بسته می‌شود)");

  console.log(`همه ${passed} مرحله موفق`);
}
main();
