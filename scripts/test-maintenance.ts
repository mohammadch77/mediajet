// تست حالت به‌روزرسانی: ساخت/حذف فایل پرچم و idempotent بودن.
import assert from "node:assert";
import os from "node:os";
import path from "node:path";
process.env.MAINTENANCE_FLAG_PATH = path.join(os.tmpdir(), `mj-flag-${process.pid}`);

async function main() {
  const { isMaintenanceOn, setMaintenance } = await import("../lib/maintenance");
  assert.equal(isMaintenanceOn(), false);
  setMaintenance(true);
  setMaintenance(true);
  assert.equal(isMaintenanceOn(), true);
  setMaintenance(false);
  setMaintenance(false);
  assert.equal(isMaintenanceOn(), false);
  console.log("تست حالت به‌روزرسانی موفق بود");
}
main();
