import type { ReactNode } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { LEGAL_LINKS, currentJalaliYear, visibleFooterNote } from "@/lib/legal";

const FUNCTION_WORDS = new Set(["و", "یا", "با", "در", "از", "به", "تا", "که", "را", "بر", "برای", "هم"]);
const LINK_CLS = "font-bold text-text underline-offset-4 transition hover:text-cyan hover:underline";

/**
 * متن پانوشت را به نودهای React تبدیل می‌کند؛ HTML خام تزریق نمی‌شود، پس امن است. فقط آدرس http(s) پذیرفته می‌شود.
 * آدرس هرگز نمایش داده نمی‌شود و «خودِ کلمه» لینک است:
 *  - «[پیشروناد](https://…)» ← فقط «پیشروناد» لینک است.
 *  - «پیشروناد https://…» یا «پیشروناد (https://…)» ← کلمه‌ی پیش از آدرس لینک می‌شود.
 *  - آدرسِ تنها (بدون کلمه‌ی قبل از آن) ← فقط نام دامنه، به‌صورت لینک.
 */
function renderWithLinks(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|([^\s()[\]]+)[ \t]*\(?(https?:\/\/[^\s()]+)\)?|\(?(https?:\/\/[^\s()]+)\)?/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const link = (key: number, url: string, label: string) => (
    <a key={key} href={url} target="_blank" rel="noopener noreferrer" className={LINK_CLS}>
      {label}
    </a>
  );
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(link(m.index, m[2], m[1]));
    } else if (m[3] !== undefined) {
      // علامت‌های انتهای کلمه («:» «،» …) بیرون از لینک می‌مانند.
      const stripped = m[3].replace(/[:：،,؛;\-–—]+$/, "");
      // حرف ربط و اضافه («و»، «با»، «در»…) هرگز متن لینک نمی‌شود.
      const word = FUNCTION_WORDS.has(stripped) ? "" : stripped;
      const tail = m[3].slice(word.length);
      if (word) {
        nodes.push(link(m.index, m[4], word));
        if (tail) nodes.push(tail);
      } else {
        nodes.push(m[3] + " ", link(m.index, m[4], m[4].replace(/^https?:\/\//, "").replace(/\/$/, "")));
      }
    } else {
      nodes.push(link(m.index, m[5], m[5].replace(/^https?:\/\//, "").replace(/\/$/, "")));
    }
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
    <div className="inline-flex rounded-2xl bg-white/95 p-2.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,.6)] border border-[rgb(var(--c-primary2)/.2)]">
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

const linkCls = "inline-block py-1 text-dim hover:text-text transition-colors";

const SOCIAL_ICONS = {
  instagram: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm5 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm5.5-.5v.01",
  telegram: "M22 3 2 11l6.5 2.5L11 21l3.5-5.5L20 20 22 3zM8.5 13.5 18 7",
} as const;

function SocialLink({ href, label, icon }: { href: string; label: string; icon: keyof typeof SOCIAL_ICONS }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="w-10 h-10 grid place-items-center rounded-xl border border-[rgb(var(--c-primary2)/.22)] bg-[rgb(var(--c-ov)/.05)] text-dim hover:text-text hover:border-[rgb(var(--c-cyan)/.5)] hover:-translate-y-0.5 transition"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={SOCIAL_ICONS[icon]} />
      </svg>
    </a>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="font-display font-bold text-text text-[.95rem] mb-3">{title}</h3>
      {children}
    </div>
  );
}

/** ستون «تماس»؛ فقط مواردی که ادمین پر کرده نمایش داده می‌شود (چیزی ساخته نمی‌شود). */
function ContactColumn({ content }: { content: Record<string, string> }) {
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
    <FooterColumn title="تماس با ما">
      <ul className="list-none p-0 m-0 text-[.86rem] leading-[1.9] text-dim space-y-1">
        {description && <li>{description}</li>}
        {phone && (
          <li>
            <a href={`tel:${phone.replace(/\s+/g, "")}`} dir="ltr" className="hover:text-text transition-colors">{phone}</a>
          </li>
        )}
        {email && (
          <li>
            <a href={`mailto:${email}`} dir="ltr" className="hover:text-text transition-colors break-all">{email}</a>
          </li>
        )}
        {telegramHref && (
          <li>
            <a href={telegramHref} target="_blank" rel="noopener noreferrer" className="hover:text-text transition-colors">تلگرام پشتیبانی</a>
          </li>
        )}
        {address && <li>{address}</li>}
        {hours && <li>ساعات کاری: {hours}</li>}
      </ul>
    </FooterColumn>
  );
}

/**
 * فوتر مشترک همه‌ی صفحه‌های عمومی: نوار دعوت به اقدام، معرفی برند و شبکه‌های اجتماعی،
 * ستون‌های پیوند (سایت، حقوقی، تماس)، نماد اعتماد و نوار پایانی با © و مشخصات کسب‌وکار.
 * `cta=false` در صفحه‌ی اصلی که خودش مسیر سفارش را دارد.
 */
export default function SiteFooter({ content, cta = true }: { content: Record<string, string>; cta?: boolean }) {
  const note = visibleFooterNote(content["footer.copyright"]);
  const businessName = content["legal.business_name"]?.trim();
  const businessId = content["legal.business_id"]?.trim();
  const instagram = content["footer.social_instagram"]?.trim();
  const telegram = content["footer.social_telegram"]?.trim();
  return (
    <footer className="relative overflow-hidden mt-8 border-t border-[rgb(var(--c-primary2)/.14)]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgb(var(--c-cyan)/.7)] to-transparent" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -right-24 w-[480px] h-[480px] rounded-full opacity-[.16] blur-3xl" style={{ background: "radial-gradient(circle, rgb(var(--c-primary)), transparent 70%)" }} />
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-24 w-[360px] h-[360px] rounded-full opacity-[.10] blur-3xl" style={{ background: "radial-gradient(circle, rgb(var(--c-accent)), transparent 70%)" }} />

      <div className="relative max-w-[1200px] mx-auto px-[5vw] pt-12 sm:pt-16 pb-8">
        {cta && (
          <div className="mb-12 sm:mb-14 rounded-3xl border border-[rgb(var(--c-primary2)/.22)] bg-gradient-to-br from-[rgb(var(--c-primary)/.16)] to-[rgb(var(--c-cyan)/.08)] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
            <div className="flex-1">
              <div className="font-display font-extrabold text-[1.25rem] sm:text-[1.5rem] leading-[1.6]">فایل مورد نظرت را سفارش بده</div>
              <p className="m-0 mt-1 text-dim text-[.92rem] leading-[1.9]">لینک محصول را بفرست، هزینه را به ریال بپرداز و فایل را در پنلت تحویل بگیر.</p>
            </div>
            <Link
              href="/#cats"
              className="shrink-0 text-center font-bold text-[.95rem] text-on-solid rounded-[14px] px-7 py-3.5 bg-gradient-to-br from-accent to-accent2 shadow-[0_12px_30px_-12px_rgb(var(--c-accent)/.8)] transition hover:-translate-y-0.5"
            >
              مرور دسته‌ها
            </Link>
          </div>
        )}

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 font-display font-extrabold text-[1.2rem] text-text">
              <BrandLogo className="w-[34px] h-[34px] shadow-[0_0_60px_-10px_#6B5BFF]" />
              گت‌استوک
            </Link>
            <p className="mt-3 mb-0 text-dim text-[.9rem] leading-[1.95] max-w-[34ch]">{content["footer.tagline"]}</p>
            {(instagram || telegram) && (
              <div className="flex items-center gap-2.5 mt-5">
                {instagram && <SocialLink href={instagram} label="اینستاگرام" icon="instagram" />}
                {telegram && <SocialLink href={telegram} label="تلگرام" icon="telegram" />}
              </div>
            )}
          </div>

          <FooterColumn title="گت‌استوک">
            <nav aria-label="پیوندهای سایت">
              <ul className="list-none p-0 m-0 text-[.88rem]">
                <li><Link href="/about" className={linkCls}>درباره ما</Link></li>
                <li><Link href="/faq" className={linkCls}>سؤالات متداول</Link></li>
                <li><Link href="/blog" className={linkCls}>وبلاگ</Link></li>
                <li><Link href="/affiliate" className={linkCls}>همکاری در فروش</Link></li>
              </ul>
            </nav>
          </FooterColumn>

          <FooterColumn title="قوانین و حریم خصوصی">
            <nav aria-label="پیوندهای حقوقی">
              <ul className="list-none p-0 m-0 text-[.88rem]">
                {Object.values(LEGAL_LINKS).map((l) => (
                  <li key={l.href}><Link href={l.href} className={linkCls}>{l.label}</Link></li>
                ))}
              </ul>
            </nav>
          </FooterColumn>

          <div className="space-y-6">
            <ContactColumn content={content} />
            <EnamadSeal content={content} />
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[rgb(var(--c-primary2)/.14)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[.8rem] text-dim leading-[1.9]">
          <p className="m-0">
            © {currentJalaliYear()} {businessName || "گت‌استوک"}
            {businessId && (
              <>
                {" "}— شناسه: <span dir="ltr" className="latin">{businessId}</span>
              </>
            )}
          </p>
          {note && <p className="m-0 max-w-[60ch]">{renderWithLinks(note)}</p>}
        </div>
      </div>
    </footer>
  );
}
