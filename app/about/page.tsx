import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { LegalSection, LegalCards, LegalSteps, LegalPills, LegalList } from "@/components/LegalPage";
import JsonLd from "@/components/JsonLd";
import { ALL_SITES, CATEGORIES } from "@/data/categories";
import { getAllContent } from "@/lib/content";
import { SITE_URL } from "@/lib/siteUrl";
import { rialToTomanLabel, toPersianDigits } from "@/lib/money";

export const dynamic = "force-dynamic";

const TITLE = "درباره گت‌استوک | سفارش تک‌فایل از سایت‌های استوک با پرداخت ریالی";
const DESCRIPTION =
  "گت‌استوک سرویس سفارش تک‌فایل از سایت‌های استوک برای کاربران ایرانی است: لینک را بفرست، به ریال بپرداز و فایل را در پنلت تحویل بگیر؛ بدون اشتراک ماهانه.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/about` },
  openGraph: { type: "website", locale: "fa_IR", url: `${SITE_URL}/about`, title: TITLE, description: DESCRIPTION },
};

const sitesCount = toPersianDigits(ALL_SITES.length);
const catsCount = toPersianDigits(CATEGORIES.length);

/** قیمت شروع هر دسته از روی منبع واحد قیمت‌ها (data/categories.ts) محاسبه می‌شود، پس هیچ‌وقت با سایت ناهماهنگ نمی‌شود. */
const CATEGORY_CARDS = CATEGORIES.map((c) => ({
  title: c.title,
  text: `از ${rialToTomanLabel(Math.min(...Object.values(c.sitePricesRial).filter((v): v is number => typeof v === "number")))} · ${toPersianDigits(c.sites.length)} سایت`,
}));

export default async function AboutPage() {
  const content = await getAllContent();
  const sameAs = [content["footer.social_instagram"], content["footer.social_telegram"]].filter((v) => /^https?:\/\//.test(v ?? ""));
  const phone = content["contact.phone"]?.trim();
  const email = content["contact.email"]?.trim();
  const orgName = content["legal.business_name"]?.trim() || "گت‌استوک";

  return (
    <LegalPage
      current="about"
      icon="info"
      showUpdated={false}
      title="درباره گت‌استوک"
      intro="گت‌استوک برای کسی است که فقط یک فایل از یک سایت استوک لازم دارد و نمی‌خواهد برایش اشتراک ماهانه بخرد؛ لینک را می‌فرستی، به ریال می‌پردازی و فایل را در پنلت می‌گیری."
      highlights={[
        { icon: "zap", title: "تک‌فایل، بدون اشتراک", text: "فقط برای همان فایلی که لازم داری هزینه می‌کنی." },
        { icon: "globe", title: `${sitesCount} سایت، ${catsCount} دسته`, text: "عکس، وکتور، ویدیو، موزیک، فونت، قالب و بیشتر." },
        { icon: "card", title: "پرداخت ریالی", text: "از کیف پول یا درگاه پرداخت زرین‌پال.", tone: "good" },
      ]}
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: orgName,
              url: SITE_URL,
              logo: `${SITE_URL}/brand/logo.png`,
              description: DESCRIPTION,
              ...(sameAs.length ? { sameAs } : {}),
              ...(phone || email
                ? { contactPoint: { "@type": "ContactPoint", contactType: "customer support", ...(phone ? { telephone: phone } : {}), ...(email ? { email } : {}), availableLanguage: "fa" } }
                : {}),
            },
            { "@type": "AboutPage", name: "درباره گت‌استوک", url: `${SITE_URL}/about`, description: DESCRIPTION },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "گت‌استوک", item: SITE_URL },
                { "@type": "ListItem", position: 2, name: "درباره ما", item: `${SITE_URL}/about` },
              ],
            },
          ],
        }}
      />

      <LegalSection title="۱. گت‌استوک چیست؟">
        <p>
          گت‌استوک یک سرویس سفارش تک‌فایل از پلتفرم‌های استوک خارجی برای کاربران ایرانی است. به‌جای خرید اشتراک گران ماهانه، فقط برای همان فایلی که لازم داری هزینه می‌کنی و قیمت را به ریال می‌پردازی.
        </p>
        <p>
          گت‌استوک نماینده یا شریک رسمی هیچ‌یک از پلتفرم‌های مبدأ نیست؛ نام آن‌ها فقط برای مشخص کردن منبع فایل آمده و متعلق به صاحبانشان است.
        </p>
      </LegalSection>

      <LegalSection title="۲. چطور کار می‌کند؟">
        <LegalSteps
          steps={[
            { title: "لینک را بفرست", text: "آدرس صفحه‌ی محصول را از یکی از سایت‌های پشتیبانی‌شده کپی کن و در فرم سفارش بگذار؛ سایت و دسته‌ی فایل از روی لینک تشخیص داده می‌شود." },
            { title: "هزینه را بپرداز", text: "قیمت پیش از پرداخت نمایش داده می‌شود. از کیف پول یا درگاه پرداخت آنلاین پرداخت می‌کنی." },
            { title: "فایل را بگیر", text: "سفارش در صف انجام قرار می‌گیرد و فایل آماده‌شده در پنل کاربری‌ات برای دانلود می‌ماند." },
          ]}
        />
      </LegalSection>

      <LegalSection title="۳. چه چیزی می‌توانی سفارش بدهی؟">
        <p>دسته‌ها و قیمت شروع هر کدام (قیمت نهایی بسته به سایت مبدأ فرق می‌کند و پیش از پرداخت نمایش داده می‌شود):</p>
        <LegalCards items={CATEGORY_CARDS} />
        <p>
          <Link href="/#cats" className="text-cyan underline">رفتن به فرم سفارش</Link>
        </p>
      </LegalSection>

      <LegalSection title="۴. سایت‌های پشتیبانی‌شده">
        <p>این {sitesCount} سایت الان پشتیبانی می‌شوند:</p>
        <LegalPills items={ALL_SITES} latin />
      </LegalSection>

      <LegalSection title="۵. پرداخت، تحویل و بازگشت وجه">
        <LegalList
          items={[
            "پرداخت از کیف پول یا درگاه آنلاین؛ اطلاعات کارت فقط در صفحه‌ی درگاه وارد می‌شود.",
            "تحویل در پنل کاربری و با اعلان وضعیت سفارش.",
            <>
              اگر سفارش انجام نشود، مبلغ پرداخت‌شده به کیف پولت برمی‌گردد؛ جزئیات در <Link href="/refund" className="text-cyan underline">شرایط بازگشت وجه</Link>.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="۶. شفافیت و پشتیبانی">
        <p>
          قوانین، حریم خصوصی و کوکی‌ها را به زبان ساده نوشته‌ایم: <Link href="/terms" className="text-cyan underline">قوانین و مقررات</Link>، <Link href="/privacy" className="text-cyan underline">حریم خصوصی</Link> و <Link href="/cookies" className="text-cyan underline">سیاست کوکی</Link>. جواب سؤال‌های رایج هم در <Link href="/faq" className="text-cyan underline">سؤالات متداول</Link> است.
        </p>
        <p>برای پیگیری سفارش از بخش پشتیبانی پنل کاربری پیام بده یا از راه‌های تماس پایین صفحه استفاده کن.</p>
      </LegalSection>

      <LegalSection title="۷. همکاری در فروش">
        <p>
          می‌توانی با لینک اختصاصی خودت گت‌استوک را معرفی کنی و از سفارش‌های ثبت‌شده کمیسیون بگیری. <Link href="/affiliate" className="text-cyan underline">جزئیات برنامه‌ی همکاری</Link>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
