import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalSection, LegalList } from "@/components/LegalPage";
import PriceTable from "@/components/PriceTable";
import JsonLd from "@/components/JsonLd";
import { ALL_SITES, CATEGORIES } from "@/data/categories";
import { SITE_URL } from "@/lib/siteUrl";
import { toPersianDigits } from "@/lib/money";

export const dynamic = "force-dynamic";

const TITLE = "قیمت‌ها | هزینه‌ی دانلود تک‌فایل از سایت‌های استوک در گت‌استوک";
const DESCRIPTION =
  "قیمت دانلود تک‌فایل از سایت‌های استوک به تومان؛ بازه‌ی قیمت هر سایت و هر دسته (عکس، وکتور، ویدیو، موزیک، فونت، قالب) در گت‌استوک، بدون اشتراک ماهانه.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/pricing` },
  openGraph: { type: "website", locale: "fa_IR", url: `${SITE_URL}/pricing`, title: TITLE, description: DESCRIPTION },
};

export default function PricingPage() {
  const sites = toPersianDigits(ALL_SITES.length);
  const cats = toPersianDigits(CATEGORIES.length);
  return (
    <LegalPage
      current="pricing"
      icon="card"
      showUpdated={false}
      wide
      title="قیمت‌ها"
      intro="قیمت هر فایل به سایت مبدأ و دسته‌ی آن بستگی دارد. اینجا بازه‌ی قیمت هر سایت را می‌بینی؛ با انتخاب یک دسته، قیمت دقیق همان دسته نمایش داده می‌شود."
      highlights={[
        { icon: "globe", title: `${sites} سایت، ${cats} دسته`, text: "از عکس و وکتور تا ویدیو، موزیک، فونت و قالب." },
        { icon: "zap", title: "بدون اشتراک ماهانه", text: "فقط برای همان فایلی که لازم داری می‌پردازی." },
        { icon: "card", title: "پرداخت ریالی", text: "قیمت‌ها به تومان و پیش از پرداخت نمایش داده می‌شوند.", tone: "good" },
      ]}
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "WebPage", name: "قیمت‌های گت‌استوک", url: `${SITE_URL}/pricing`, description: DESCRIPTION },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "گت‌استوک", item: SITE_URL },
                { "@type": "ListItem", position: 2, name: "قیمت‌ها", item: `${SITE_URL}/pricing` },
              ],
            },
          ],
        }}
      />
      <LegalSection title="۱. قیمت هر سایت">
        <PriceTable />
      </LegalSection>
      <LegalSection title="۲. نکات قیمت‌گذاری">
        <LegalList
          items={[
            "قیمت‌ها پایه‌اند و به تومان نوشته شده‌اند؛ بسته به روش پرداخت ممکن است کارمزد هم اضافه شود و مبلغ نهایی قبل از تأیید پرداخت نمایش داده می‌شود.",
            "قیمت هر فایل از روی سایت مبدأ و دسته‌ی آن مشخص می‌شود. دسته‌ی اشتباه ممکن است قیمت را تغییر بدهد.",
            <>اگر سفارش انجام نشود، مبلغ به کیف پولت برمی‌گردد؛ جزئیات در <Link href="/refund" className="text-cyan underline">شرایط بازگشت وجه</Link>.</>,
            <>برای ثبت سفارش، <Link href="/#cats" className="text-cyan underline">به فرم سفارش</Link> برو.</>,
          ]}
        />
      </LegalSection>
    </LegalPage>
  );
}
