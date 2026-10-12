import type { Metadata } from "next";
import AffiliateClient from "./AffiliateClient";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { getAllContent } from "@/lib/content";
import { headerNavItems } from "@/lib/legal";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

const TITLE = "همکاری در فروش گت‌استوک | کسب درآمد با لینک اختصاصی";
const DESCRIPTION =
  "با لینک اختصاصی گت‌استوک را معرفی کن و از سفارش‌های ثبت‌شده‌ی زیرمجموعه‌ات کمیسیون بگیر؛ عضویت رایگان، بدون سرمایه و بدون پشتیبانی از مشتری.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/affiliate` },
  openGraph: { type: "website", locale: "fa_IR", url: `${SITE_URL}/affiliate`, title: TITLE, description: DESCRIPTION },
};

export default async function AffiliatePage() {
  const content = await getAllContent();
  return (
    <div dir="rtl" className="min-h-screen bg-bg text-text font-body flex flex-col">
      <SiteNav navItems={headerNavItems(content)} withAuthModal />
      <div className="flex-1">
        <AffiliateClient />
      </div>
      <SiteFooter content={content} />
    </div>
  );
}
