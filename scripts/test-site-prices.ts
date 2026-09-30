// تست قیمت‌گذاری per-site-per-category: قیمت را از سرور (/api/quote) می‌گیرد و با جدول قیمت (تومان) تطبیق می‌دهد.
// اجرا: سرور dev بالا باشد، سپس  npx tsx scripts/test-site-prices.ts

import { computePrice } from "../lib/pricing";
import { detectSite } from "../lib/detectSite";
import { getPaymentSettings } from "../lib/paymentSettings";
import { prisma } from "../lib/db";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = ""): void {
  if (condition) passed++; else failed++;
  console.log(`  ${condition ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// [دسته، سایت، قیمت مورد انتظار به تومان]
const EXPECTED: [string, string, number][] = [
  ["vector", "Freepik (Magnific)", 20000],
  ["font", "UI8", 170000],
  ["video", "Shutterstock", 860000],
  ["video", "Freepik (Magnific)", 45000],
  ["psd", "Designi Premium", 79000],
  ["3d", "Designi Premium", 69000],
  ["mockup", "Yellow Images", 900000],
  ["icon", "Flaticon", 30000],
  ["wp", "Envato Elements", 65000],
  ["psd", "Envato Elements", 60000],
  ["vector", "VectorStock", 190000],
];

async function main(): Promise<void> {
  const settings = await getPaymentSettings();
  const walletFactor = (r: number) => Math.round(r * (1 + settings.walletSurchargePercent / 100));
  const gatewayFactor = (r: number) => Math.round(r * (1 + settings.gatewaySurchargePercent / 100));

  console.log("\n۱) قیمت پایه‌ی سمت سرور و /api/quote");
  for (const [cat, site, toman] of EXPECTED) {
    const rial = toman * 10;
    const p = computePrice(cat, site);
    check(`${cat}/${site} پایه`, p?.finalPriceRial === rial, `${p?.finalPriceRial} (انتظار ${rial})`);

    const res = await fetch(`${BASE_URL}/api/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: cat, site }),
    });
    const q = await res.json();
    check(
      `${cat}/${site} از سرور`,
      res.ok && Number(q.walletPriceRial) === walletFactor(rial) && Number(q.gatewayPriceRial) === gatewayFactor(rial),
      `wallet=${q.walletPriceRial} gateway=${q.gatewayPriceRial}`,
    );
  }

  console.log("\n۲) جفت نامعتبر رد شود");
  check("ui/Freepik نامعتبر", computePrice("ui", "Freepik") === null);
  const bad = await fetch(`${BASE_URL}/api/quote`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryId: "wp", site: "Envato" }),
  });
  const badBody = await bad.json();
  check("نام قدیمی «Envato» به «Envato Elements» نگاشت می‌شود", bad.ok && badBody.site === "Envato Elements", `status=${bad.status} site=${badBody.site}`);
  check("سایت ناشناخته رد شود", computePrice("wp", "Unknown") === null);

  const legacy = computePrice("vector", "Freepik");
  check("نام قدیمی Freepik (سبدهای ذخیره‌شده) هنوز قیمت می‌گیرد", legacy?.finalPriceRial === 200000 && legacy.site === "Freepik (Magnific)");

  console.log("\n۳) تشخیص سایت از لینک");
  const links: [string, string][] = [
    ["https://elements.envato.com/x", "Envato Elements"],
    ["https://envato.com/x", "Envato Elements"],
    ["https://stock.adobe.com/x", "Adobe Stock"],
    ["https://www.istockphoto.com/x", "iStock"],
    ["https://www.shutterstock.com/x", "Shutterstock"],
    ["https://www.designi.com.br/x", "Designi Premium"],
    ["https://designipremium.com/x", "Designi Premium"],
    ["https://www.vectorstock.com/x", "VectorStock"],
    ["https://yellowimages.com/x", "Yellow Images"],
    ["https://depositphotos.com/x", "Depositphotos"],
    ["https://www.freepik.com/x", "Freepik (Magnific)"],
    ["https://www.magnific.com/x", "Freepik (Magnific)"],
  ];
  for (const [url, site] of links) check(url, detectSite(url) === site, detectSite(url));

  console.log(`\nنتیجه: ${passed} موفق، ${failed} ناموفق`);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main();
