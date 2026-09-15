import { categoryById } from "@/data/categories";
import { getPaymentSettings } from "@/lib/paymentSettings";

// ضریب قیمت بر اساس سایت مبدأ (سایت‌های گران‌تر ضریب بالاتر).
const SITE_MULTIPLIER: Record<string, number> = {
  Shutterstock: 1.3,
  "Adobe Stock": 1.25,
  iStock: 1.2,
  Storyblocks: 1.15,
};

export interface PriceResult {
  categoryId: string;
  site: string;
  basePriceRial: number;
  multiplier: number;
  finalPriceRial: number;
}

/**
 * محاسبه‌ی قیمت فقط سمت سرور. قیمت ارسالی از کلاینت هرگز مبنا نیست.
 * خروجی به ریال و integer است.
 */
export function computePrice(categoryId: string, site: string): PriceResult | null {
  const cat = categoryById(categoryId);
  if (!cat) return null;
  if (!cat.sites.includes(site)) return null;

  const multiplier = SITE_MULTIPLIER[site] ?? 1;
  const finalPriceRial = Math.round(cat.basePriceRial * multiplier);

  return {
    categoryId,
    site,
    basePriceRial: cat.basePriceRial,
    multiplier,
    finalPriceRial,
  };
}

export type PaymentMethod = "wallet" | "gateway";

export interface MethodPriceResult extends PriceResult {
  paymentMethod: PaymentMethod;
  /** قیمت نهاییِ قابل پرداخت با این روش (قیمت پایه‌ی سایت + کارمزد روش پرداخت). */
  payablePriceRial: number;
}

/** کارمزد را روی قیمت اعمال می‌کند؛ همان قرارداد گرد کردن موجود (Math.round) و خروجی integer ریال. */
function applySurcharge(priceRial: number, surchargePercent: number): number {
  return Math.round(priceRial * (1 + surchargePercent / 100));
}

/**
 * قیمت نهایی یک سفارش برای یک روش پرداخت مشخص.
 * درصد کارمزد هر بار تازه از تنظیمات خوانده می‌شود (بدون کش) تا ویرایش ادمین
 * بلافاصله روی قیمت بعدی اثر بگذارد. فقط سمت سرور.
 */
export async function computePriceForPaymentMethod(
  categoryId: string,
  site: string,
  paymentMethod: PaymentMethod,
): Promise<MethodPriceResult | null> {
  const base = computePrice(categoryId, site);
  if (!base) return null;

  const settings = await getPaymentSettings();
  const percent =
    paymentMethod === "wallet"
      ? settings.walletSurchargePercent
      : settings.gatewaySurchargePercent;

  return {
    ...base,
    paymentMethod,
    payablePriceRial: applySurcharge(base.finalPriceRial, percent),
  };
}

export interface DualPriceResult {
  categoryId: string;
  site: string;
  walletPriceRial: number;
  gatewayPriceRial: number;
}

/**
 * قیمت هر دو روش پرداخت را با یک بار خواندن تنظیمات برمی‌گرداند (برای /api/quote).
 * درصدها عمداً در خروجی نیستند: UI فقط قیمت نهایی را می‌بیند، نه کارمزد را.
 */
export async function computeDualPrice(
  categoryId: string,
  site: string,
): Promise<DualPriceResult | null> {
  const base = computePrice(categoryId, site);
  if (!base) return null;

  const settings = await getPaymentSettings();

  return {
    categoryId,
    site,
    walletPriceRial: applySurcharge(base.finalPriceRial, settings.walletSurchargePercent),
    gatewayPriceRial: applySurcharge(base.finalPriceRial, settings.gatewaySurchargePercent),
  };
}

export interface CartItemInput {
  categoryId: string;
  site: string;
}

export interface CartPriceResult {
  items: PriceResult[];
  /** مجموع قیمت پایه‌ی همه‌ی آیتم‌ها، پیش از کارمزد روش پرداخت. */
  subtotalRial: number;
  paymentMethod: PaymentMethod;
  /** مجموع قابل‌پرداخت: کارمزد روش پرداخت روی کل سبد اعمال می‌شود، نه تک‌تک آیتم‌ها. */
  payableTotalRial: number;
}

/**
 * قیمت کل سبد برای یک روش پرداخت مشخص، فقط سمت سرور. اگر دسته/سایت هر آیتم نامعتبر
 * باشد null برمی‌گردد (سبد نباید نیمه‌قیمت‌گذاری‌شده باشد).
 */
export async function computeCartTotal(
  items: CartItemInput[],
  paymentMethod: PaymentMethod,
): Promise<CartPriceResult | null> {
  if (items.length === 0) return null;

  const priced: PriceResult[] = [];
  for (const item of items) {
    const p = computePrice(item.categoryId, item.site);
    if (!p) return null;
    priced.push(p);
  }

  const subtotalRial = priced.reduce((sum, p) => sum + p.finalPriceRial, 0);

  const settings = await getPaymentSettings();
  const percent =
    paymentMethod === "wallet"
      ? settings.walletSurchargePercent
      : settings.gatewaySurchargePercent;

  return {
    items: priced,
    subtotalRial,
    paymentMethod,
    payableTotalRial: applySurcharge(subtotalRial, percent),
  };
}
