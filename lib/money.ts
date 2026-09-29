// پول همه‌جا به ریال (integer) نگه‌داری می‌شود و به تومان نمایش داده می‌شود.
// هیچ‌جا از float برای پول استفاده نمی‌کنیم.

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** ارقام فارسی (۰-۹) و عربی (٠-٩) را به ارقام لاتین تبدیل می‌کند. */
export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** ریال → رشته‌ی فارسیِ تومان با جداکننده‌ی هزارگان */
export function rialToTomanLabel(rial: number): string {
  const toman = Math.round(rial / 10);
  return toPersianDigits(toman.toLocaleString("en-US")) + " تومان";
}

/** رشته‌ی فارسیِ ریال با جداکننده */
export function rialLabel(rial: number): string {
  return toPersianDigits(Math.round(rial).toLocaleString("en-US")) + " ریال";
}
