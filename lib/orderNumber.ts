const PREFIX = "MJ-";

/** شماره‌ی نمایشی سفارش، مثل MJ-1024. */
export function formatOrderNumber(orderNumber: number): string {
  return `${PREFIX}${orderNumber}`;
}

/** «MJ-1024» یا «mj1024» → 1024؛ در غیر این صورت null. ارقام باید لاتین باشند (toEnglishDigits). */
export function parseOrderNumber(input: string): number | null {
  const match = /^MJ-?(\d+)$/i.exec(input.trim());
  return match ? Number(match[1]) : null;
}
