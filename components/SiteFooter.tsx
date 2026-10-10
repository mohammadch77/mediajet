import type { ReactNode } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { LEGAL_LINKS, currentJalaliYear, visibleFooterNote } from "@/lib/legal";

/**
 * متن را به نودهای React تبدیل می‌کند و هر آدرس http(s) (با یا بدون پرانتز) را
 * به لینک کلیک‌پذیر (نمایش فقط دامنه) تبدیل می‌کند. HTML خام تزریق نمی‌شود، پس امن است.
 */
function renderWithLinks(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\(?(https?:\/\/[^\s()]+)\)?/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const url = m[1];
    const label = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    nodes.push(
      <a key={m.index} href={url} target="_blank" rel="noopener noreferrer" className="underline hover:text-text transition">
        {label}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * نماد اعتماد الکترونیکی (اینماد). فقط شناسه‌ی عددی و کد حروف/عدد پذیرفته می‌شود و تگ اینجا ساخته می‌شود؛
 * مقدار نامعتبر یا خالی = نمایش داده نمی‌شود (جلوگیری از تزریق در آدرس).
 */
function EnamadSeal({ content }: { content: Record<string, string> }) {
  const id = (content["footer.enamad_id"] ?? "").trim();
  const code = (content["footer.enamad_code"] ?? "").trim();
  if (!/^\d{1,12}$/.test(id) || !/^[A-Za-z0-9]{8,64}$/.test(code)) return null;
  const query = `id=${id}&Code=${code}`;
  return (
    <div className="flex justify-center mt-4">
      <a href={`https://trustseal.enamad.ir/?${query}`} target="_blank" rel="noopener" referrerPolicy="origin">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          referrerPolicy="origin"
          src={`https://trustseal.enamad.ir/logo.aspx?${query}`}
          alt="نماد اعتماد الکترونیکی"
          className="cursor-pointer max-h-[90px] w-auto"
        />
      </a>
    </div>
  );
}

/** بخش «تماس با ما» در فوتر؛ فقط فیلدهایی که ادمین پر کرده نمایش داده می‌شوند. */
function ContactBlock({ content }: { content: Record<string, string> }) {
  const phone = content["contact.phone"]?.trim();
  const email = content["contact.email"]?.trim();
  const address = content["contact.address"]?.trim();
  const telegram = content["contact.telegram"]?.trim();
  const hours = content["contact.hours"]?.trim();
  const description = content["contact.description"]?.trim();
  if (!phone && !email && !address && !telegram && !hours && !description) return null;

  const telegramHref = telegram
    ? /^https?:\/\//.test(telegram)
      ? telegram
      : `https://t.me/${telegram.replace(/^@/, "")}`
    : null;

  return (
    <div className="max-w-[60ch] mx-auto mt-6 text-[.82rem] leading-[1.9]">
      <div className="font-bold text-text mb-1.5">تماس با ما</div>
      {description && <p className="m-0 mb-2">{description}</p>}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
        {phone && (
          <a href={`tel:${phone.replace(/\s+/g, "")}`} dir="ltr" className="text-dim hover:text-text transition">
            {phone}
          </a>
        )}
        {email && (
          <a href={`mailto:${email}`} dir="ltr" className="text-dim hover:text-text transition">
            {email}
          </a>
        )}
        {telegramHref && (
          <a href={telegramHref} target="_blank" rel="noopener noreferrer" className="text-dim hover:text-text transition">
            تلگرام پشتیبانی
          </a>
        )}
      </div>
      {address && <div className="mt-1">{address}</div>}
      {hours && <div className="mt-1">ساعات کاری: {hours}</div>}
    </div>
  );
}

const linkCls = "text-dim hover:text-text transition";

/** مشخصات حقوقی کسب‌وکار؛ فقط مقادیری که ادمین واقعاً وارد کرده نمایش داده می‌شود (چیزی ساخته نمی‌شود). */
function BusinessInfo({ content }: { content: Record<string, string> }) {
  const name = content["legal.business_name"]?.trim();
  const id = content["legal.business_id"]?.trim();
  if (!name && !id) return null;
  return (
    <div className="mt-3 text-[.8rem] text-dim leading-[1.9]">
      {name && <div>{name}</div>}
      {id && <div>شناسه: <span dir="ltr" className="latin">{id}</span></div>}
    </div>
  );
}

/** فوتر مشترک همه‌ی صفحه‌های عمومی: لینک‌های حقوقی، تماس، مشخصات کسب‌وکار و نماد اعتماد. */
export default function SiteFooter({ content }: { content: Record<string, string> }) {
  const note = visibleFooterNote(content["footer.copyright"]);
  const owner = content["legal.business_name"]?.trim() || "گت‌استوک";
  return (
    <footer className="border-t border-[rgb(var(--c-primary2)/.14)] px-[5vw] py-10 text-center text-dim">
      <div className="inline-flex items-center gap-2.5 font-display font-extrabold text-text mb-2.5">
        <BrandLogo className="w-[26px] h-[26px]" />گت‌استوک
      </div>
      <p className="m-0">{content["footer.tagline"]}</p>
      {(content["footer.social_instagram"] || content["footer.social_telegram"]) && (
        <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-[.82rem]">
          {content["footer.social_instagram"] && (
            <a href={content["footer.social_instagram"]} target="_blank" rel="noopener noreferrer" className={linkCls}>اینستاگرام</a>
          )}
          {content["footer.social_telegram"] && (
            <a href={content["footer.social_telegram"]} target="_blank" rel="noopener noreferrer" className={linkCls}>تلگرام</a>
          )}
        </div>
      )}
      <nav aria-label="پیوندهای سایت" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-3 text-[.82rem]">
        <Link href="/p/about" className={linkCls}>درباره ما</Link>
        <Link href="/p/faq" className={linkCls}>سؤالات متداول</Link>
        <Link href="/blog" className={linkCls}>وبلاگ</Link>
        <Link href="/affiliate" className={linkCls}>همکاری در فروش</Link>
      </nav>
      <nav aria-label="پیوندهای حقوقی" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-2 text-[.82rem]">
        {Object.values(LEGAL_LINKS).map((l) => (
          <Link key={l.href} href={l.href} className={linkCls}>{l.label}</Link>
        ))}
      </nav>
      <BusinessInfo content={content} />
      <ContactBlock content={content} />
      <EnamadSeal content={content} />
      <p className="max-w-[60ch] mx-auto mt-4 text-[.78rem] text-dim leading-[1.85]">
        © {currentJalaliYear()} {owner}
        {note && <> — {renderWithLinks(note)}</>}
      </p>
    </footer>
  );
}
