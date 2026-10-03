import { siteLogo } from "@/data/siteLogos";

/**
 * نماد مربعی یک سایت مبدأ. اگر لوگو داشته باشد تصویرش، وگرنه دو حرف اول نام (مثل قبل).
 * اندازه و گردی گوشه با className از بیرون تعیین می‌شود (مثلاً "h-7 w-7 rounded-[8px] text-[.72rem]").
 */
export default function SiteLogo({ site, className = "" }: { site: string; className?: string }) {
  const src = siteLogo(site);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- آیکون کوچک ثابت؛ next/image این‌جا سودی ندارد
      <img src={src} alt={site} width={128} height={128} loading="lazy" className={`shrink-0 object-cover ${className}`} />
    );
  }
  return (
    <span className={`grid shrink-0 place-items-center bg-[rgb(var(--c-primary2)/.14)] font-latin font-bold text-cyan ${className}`}>
      {site.slice(0, 2)}
    </span>
  );
}
