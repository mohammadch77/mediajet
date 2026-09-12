// پول همه‌جا به ریال (integer) نگه‌داری می‌شود و به تومان نمایش داده می‌شود.
// هیچ‌جا از float برای پول استفاده نمی‌کنیم.

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
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
