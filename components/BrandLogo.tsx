/** نشان برند (لوگوی گرد) که در هدر، فوتر و مودال ورود استفاده می‌شود. اندازه با className تعیین می‌شود. */
export default function BrandLogo({ className = "w-[28px] h-[28px]" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo.png" alt="" aria-hidden="true" className={`${className} rounded-[9px] shrink-0 object-contain`} />;
}
