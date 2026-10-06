// تست زیپ ابزار توسعه (بدون دیتابیس): دانلود (مسدودها حذف می‌شوند)، پیش‌نمایش، اعمال با پشتیبان،
// حمله‌ی zip-slip، فایل‌های محرمانه، حذف پیشوند پوشه، symlink و idempotency.
//   npx tsx scripts/test-ide-zip.ts

import AdmZip from "adm-zip";
import fs from "fs";
import os from "os";
import path from "path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ide-zip-"));
const root = path.join(tmp, "project");
fs.mkdirSync(path.join(root, "app"), { recursive: true });
fs.mkdirSync(path.join(root, "node_modules/x"), { recursive: true });
fs.mkdirSync(path.join(root, ".next"), { recursive: true });
fs.mkdirSync(path.join(root, "storage"), { recursive: true });
fs.writeFileSync(path.join(root, "package.json"), '{"name":"t"}');
fs.writeFileSync(path.join(root, "app/page.tsx"), "old");
fs.writeFileSync(path.join(root, ".env"), "SECRET=1");
fs.writeFileSync(path.join(root, "server.pem"), "KEY");
fs.writeFileSync(path.join(root, "node_modules/x/i.js"), "x");
fs.writeFileSync(path.join(root, ".next/b.js"), "x");
fs.writeFileSync(path.join(root, "storage/u.bin"), "x");
fs.writeFileSync(path.join(root, "debug.log"), "x");

process.env.IDE_ROOT = root;
process.env.IDE_BACKUP_DIR = path.join(tmp, "backups");

let passed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; console.log(`  ✅ ${label}`); }
  else { failures.push(label); console.log(`  ❌ ${label}`, detail ?? ""); }
}
async function rejects(fn: () => Promise<unknown>): Promise<boolean> {
  try { await fn(); return false; } catch { return true; }
}

async function main() {
  const z = await import("../lib/ide/zip");
  const files = await import("../lib/ide/files");

  console.log("— دانلود");
  const { buffer, fileCount } = await z.buildProjectZip();
  const names = new AdmZip(buffer).getEntries().map((e) => e.entryName).sort();
  check("فقط کد منبع", JSON.stringify(names) === JSON.stringify(["app/page.tsx", "package.json"]), names);
  check("fileCount درست", fileCount === 2);

  console.log("— پیش‌نمایش و اعمال");
  const up = new AdmZip();
  up.addFile("package.json", Buffer.from('{"name":"t"}')); // بدون تغییر
  up.addFile("app/page.tsx", Buffer.from("new")); // تغییر
  up.addFile("app/extra.ts", Buffer.from("added")); // جدید
  up.addFile(".env", Buffer.from("HACK=1")); // محرمانه
  up.addFile("node_modules/evil/i.js", Buffer.from("evil")); // مسدود
  up.addFile("ab/escape.txt", Buffer.from("escape")); // پایین‌تر به ../escape.txt تبدیل می‌شود
  up.addFile("xabs/path.txt", Buffer.from("abs")); // پایین‌تر به /abs/path.txt تبدیل می‌شود
  // کتابخانه هنگام addFile نام را پاک‌سازی می‌کند؛ برای ساخت زیپ مخرب واقعی، بایت‌های نام (هم‌طول) را مستقیم عوض می‌کنیم.
  const malicious = Buffer.from(up.toBuffer().toString("latin1").replaceAll("ab/escape.txt", "../escape.txt").replaceAll("xabs/path.txt", "/abs/path.txt"), "latin1");
  check("زیپ مخرب واقعاً ../ دارد", new AdmZip(malicious).getEntries().some((e) => e.rawEntryName.toString().startsWith("../")));
  const plan = await z.planZipApply("adm1", malicious);
  check("افزوده=۱ تغییر=۱ بدون‌تغییر=۱", plan.added === 1 && plan.modified === 1 && plan.unchanged === 1, plan);
  check("مسدودها در skipped", plan.skipped.length >= 4, plan.skipped);
  check("پیش‌نمایش چیزی ننوشت", fs.readFileSync(path.join(root, "app/page.tsx"), "utf8") === "old" && !fs.existsSync(path.join(root, "app/extra.ts")));
  check("zip-slip نوشته نشد (نه بیرون ریشه)", !fs.existsSync(path.join(tmp, "escape.txt")) && !fs.existsSync(path.join(tmp, "../escape.txt")));

  check("ادمین دیگر نمی‌تواند اعمال کند", await rejects(() => z.applyZipPlan("adm2", plan.planId)));
  check("شناسه‌ی جعلی رد", await rejects(() => z.applyZipPlan("adm1", "adm1-../../etc/passwd")));
  const result = await z.applyZipPlan("adm1", plan.planId);
  check("۲ فایل اعمال شد", result.applied === 2, result);
  check("محتوا عوض شد", fs.readFileSync(path.join(root, "app/page.tsx"), "utf8") === "new");
  check("فایل جدید ساخته شد", fs.readFileSync(path.join(root, "app/extra.ts"), "utf8") === "added");
  check(".env دست‌نخورده", fs.readFileSync(path.join(root, ".env"), "utf8") === "SECRET=1");
  check("node_modules دست‌نخورده", !fs.existsSync(path.join(root, "node_modules/evil")));
  const versions = await files.listVersions("app/page.tsx");
  check("فایل جایگزین‌شده پشتیبان دارد", versions.length === 1 && fs.readFileSync(path.join(tmp, "backups/files/app/page.tsx", versions[0].id), "utf8") === "old");
  check("اعمال دوباره ممکن نیست (staging پاک شد)", await rejects(() => z.applyZipPlan("adm1", plan.planId)));

  console.log("— پیشوند پوشه و ورودی‌های خراب");
  const wrapped = new AdmZip();
  wrapped.addFile("my-proj/package.json", Buffer.from('{"name":"t"}'));
  wrapped.addFile("my-proj/app/page.tsx", Buffer.from("wrapped"));
  const plan2 = await z.planZipApply("adm1", wrapped.toBuffer());
  check("پیشوند my-proj حذف شد", plan2.modified === 1 && plan2.changes[0].path === "app/page.tsx", plan2);
  check("فایل خراب رد", await rejects(() => z.planZipApply("adm1", Buffer.from("not a zip"))));
  check("زیپ خالی رد", await rejects(() => z.planZipApply("adm1", new AdmZip().toBuffer())));
  check("بدنه‌ی خالی رد", await rejects(() => z.planZipApply("adm1", Buffer.alloc(0))));

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${passed} گام موفق، ${failures.length} ناموفق`);
  if (failures.length) { console.log("ناموفق:", failures); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
