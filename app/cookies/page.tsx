import type { Metadata } from "next";
import LegalPage, { LegalSection, LegalList } from "@/components/LegalPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "سیاست کوکی | گت‌استوک",
  description: "کوکی‌ها و ذخیره‌سازی مرورگر که گت‌استوک استفاده می‌کند و دلیل هرکدام.",
};

const ROWS: { name: string; kind: string; purpose: string; life: string }[] = [
  { name: "mediajet_session", kind: "کوکی ضروری", purpose: "نگه داشتن ورود شما به حساب. بدون آن امکان ورود و خرید نیست.", life: "تا ۳۰ روز یا تا خروج از حساب" },
  { name: "mj_ref", kind: "کوکی کارکردی", purpose: "اگر با لینک اختصاصی یک همکار وارد شوید، کد معرف را نگه می‌دارد تا هنگام ثبت‌نام، همکار معرف ثبت شود.", life: "۳۰ روز (فقط اگر با لینک همکار آمده باشید)" },
  { name: "charge_return", kind: "کوکی ضروری", purpose: "پس از بازگشت از درگاه پرداخت، شما را به مرحله‌ی قبلی (سبد خرید) برمی‌گرداند.", life: "حدود ۳۰ دقیقه" },
  { name: "getstock-theme", kind: "ذخیره‌سازی مرورگر (localStorage)", purpose: "یادآوری انتخاب تم تیره یا روشن.", life: "تا پاک کردن توسط شما" },
  { name: "gs-chunk-reload، gs-soft-recovery", kind: "ذخیره‌سازی نشست (sessionStorage)", purpose: "جلوگیری از بارگذاری مجدد بی‌پایان در صورت خطای بارگذاری صفحه.", life: "تا بسته شدن تب" },
];

export default function CookiesPage() {
  return (
    <LegalPage
      title="سیاست کوکی"
      intro="گت‌استوک فقط کوکی‌ها و ذخیره‌سازی‌هایی را استفاده می‌کند که برای کار کردن سایت لازم است. هیچ ابزار تحلیل رفتار، تبلیغات یا پیکسل شخص ثالث در سایت فعال نیست."
    >
      <LegalSection title="۱. فهرست کامل">
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[560px] text-[.85rem] border-collapse">
            <caption className="sr-only">فهرست کوکی‌ها و ذخیره‌سازی مرورگر</caption>
            <thead>
              <tr className="text-text text-start">
                <th scope="col" className="text-start p-2 border-b border-[rgb(var(--c-primary2)/.2)]">نام</th>
                <th scope="col" className="text-start p-2 border-b border-[rgb(var(--c-primary2)/.2)]">نوع</th>
                <th scope="col" className="text-start p-2 border-b border-[rgb(var(--c-primary2)/.2)]">کاربرد</th>
                <th scope="col" className="text-start p-2 border-b border-[rgb(var(--c-primary2)/.2)]">ماندگاری</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.name} className="align-top">
                  <td dir="ltr" className="latin p-2 border-b border-[rgb(var(--c-primary2)/.1)] text-text whitespace-nowrap">{r.name}</td>
                  <td className="p-2 border-b border-[rgb(var(--c-primary2)/.1)]">{r.kind}</td>
                  <td className="p-2 border-b border-[rgb(var(--c-primary2)/.1)]">{r.purpose}</td>
                  <td className="p-2 border-b border-[rgb(var(--c-primary2)/.1)]">{r.life}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>برای مدیران سایت، یک کوکی ضروری دیگر برای قفل بخش مدیریتی استفاده می‌شود که به بازدیدکنندگان عادی داده نمی‌شود.</p>
      </LegalSection>

      <LegalSection title="۲. چرا بنر رضایت کوکی ندارید؟">
        <p>
          کوکی‌های بالا یا برای ورود و پرداخت لازم‌اند، یا فقط عملکردی هستند (تم، کد معرف) و برای تبلیغ یا ردیابی شما در سایت‌های دیگر استفاده نمی‌شوند. چون کوکی تحلیلی یا تبلیغاتی نداریم، چیزی برای «روشن شدن بعد از رضایت» وجود ندارد. اگر در آینده چنین ابزاری اضافه شود، پیش از فعال‌شدنش بنر رضایت و به‌روزرسانی همین صفحه اضافه می‌شود.
        </p>
      </LegalSection>

      <LegalSection title="۳. چطور کوکی‌ها را مدیریت کنم؟">
        <LegalList
          items={[
            "از تنظیمات مرورگر می‌توانید کوکی‌ها را ببینید و پاک کنید. با پاک کردن کوکی نشست، از حساب خارج می‌شوید.",
            "با پاک کردن کوکی mj_ref، اتصال لینک همکار پیش از ثبت‌نام از بین می‌رود.",
          ]}
        />
      </LegalSection>

      <LegalSection title="۴. سرویس‌های شخص ثالث">
        <p>
          فونت‌ها و فایل‌های ظاهری سایت از خود سرور گت‌استوک ارائه می‌شود و برای آن‌ها به سرویس خارجی (مثل گوگل) درخواست نمی‌رود. نماد اعتماد الکترونیکی (اینماد) در پایین صفحه از سرور اینماد بارگذاری می‌شود و اینماد ممکن است برای نمایش آن اطلاعات فنی مرورگر شما (مثل نشانی آی‌پی) را دریافت کند. سایت پشت شبکه‌ی توزیع محتوای آروان‌کلود قرار دارد که ترافیک بین مرورگر شما و سرور از آن عبور می‌کند.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
