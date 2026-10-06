// حالت «در حال به‌روزرسانی»: یک فایل پرچم روی دیسک. nginx با `-f` وجودش را بررسی می‌کند و صفحه‌ی ثابت
// maintenance.html را با کد ۵۰۳ نشان می‌دهد؛ پس حتی وقتی برنامه‌ی Node پایین باشد هم کار می‌کند.
import fs from "fs";
import path from "path";

export const MAINTENANCE_FLAG_PATH = path.resolve(process.env.MAINTENANCE_FLAG_PATH || path.join(process.cwd(), "maintenance.flag"));

export function isMaintenanceOn(): boolean {
  try {
    return fs.existsSync(MAINTENANCE_FLAG_PATH);
  } catch {
    return false;
  }
}

/** پرچم را می‌سازد/حذف می‌کند. عملیات idempotent است (دوباره روشن‌کردن خطا نمی‌دهد). */
export function setMaintenance(on: boolean): void {
  if (on) fs.writeFileSync(MAINTENANCE_FLAG_PATH, new Date().toISOString(), { mode: 0o644 });
  else fs.rmSync(MAINTENANCE_FLAG_PATH, { force: true });
}
