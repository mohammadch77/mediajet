// تبدیل تاریخ میلادی به شمسی برای نمایش در کل اپ.
// dayjs + jalaliday: سبک (~هسته‌ی dayjs چند کیلوبایت + پلاگین)، بدون وابستگی به moment
// (که دیگر نگهداری فعال ندارد)، و محاسبه‌ی تقویم جلالی را به‌صورت پلاگین رسمی پشتیبانی می‌کند.

import dayjs from "dayjs";
import jalaliday from "jalaliday";
import { toPersianDigits } from "./money";

dayjs.extend(jalaliday);

/** تاریخ را به‌صورت «۱۴۰۳/۰۶/۲۲» شمسی برمی‌گرداند. */
export function toJalaliDate(date: Date | string): string {
  const formatted = dayjs(date).calendar("jalali").format("YYYY/MM/DD");
  return toPersianDigits(formatted);
}

/** تاریخ و ساعت را به‌صورت «۱۴۰۳/۰۶/۲۲ - ۱۴:۰۵» شمسی برمی‌گرداند. */
export function toJalaliDateTime(date: Date | string): string {
  const formatted = dayjs(date).calendar("jalali").format("YYYY/MM/DD - HH:mm");
  return toPersianDigits(formatted);
}
