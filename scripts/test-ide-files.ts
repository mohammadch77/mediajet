// تست منطق فایل و قفل ابزار توسعه (بدون دیتابیس و سرور): مسیر امن، symlink، فایل‌های مسدود،
// ذخیره‌ی اتمیک + پشتیبان + تضاد هم‌زمان، حذف/بازگردانی، نقشه‌ی route و توکن بازکردن قفل.
//   npx tsx scripts/test-ide-files.ts

import fs from "fs";
import os from "os";
import path from "path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ide-test-"));
const root = path.join(tmp, "project");
const outside = path.join(tmp, "outside");
fs.mkdirSync(path.join(root, "app/api/hello"), { recursive: true });
fs.mkdirSync(path.join(root, "app/(shop)/cart"), { recursive: true });
fs.mkdirSync(path.join(root, "node_modules/x"), { recursive: true });
fs.mkdirSync(outside, { recursive: true });
fs.writeFileSync(path.join(root, "app/page.tsx"), "export default function P(){}\n");
fs.writeFileSync(path.join(root, "app/api/hello/route.ts"), "export async function GET(){}\n");
fs.writeFileSync(path.join(root, "app/(shop)/cart/page.tsx"), "x");
fs.writeFileSync(path.join(root, ".env"), "SECRET=1");
fs.writeFileSync(path.join(root, ".env.example"), "A=");
fs.writeFileSync(path.join(root, "bin.dat"), Buffer.from([1, 0, 2]));
fs.writeFileSync(path.join(outside, "secret.txt"), "top-secret");
fs.symlinkSync(outside, path.join(root, "link-out"));

process.env.IDE_ROOT = root;
process.env.IDE_BACKUP_DIR = path.join(tmp, "backups");
process.env.ENCRYPTION_KEY = "ab".repeat(32);

let passed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; console.log(`  ✅ ${label}`); }
  else { failures.push(label); console.log(`  ❌ ${label}`, detail ?? ""); }
}
async function rejects(fn: () => Promise<unknown>, status?: number): Promise<boolean> {
  try { await fn(); return false; } catch (e) { return status === undefined || (e as { status?: number }).status === status; }
}

async function main() {
  const files = await import("../lib/ide/files");
  const paths = await import("../lib/ide/paths");
  const unlock = await import("../lib/ide/unlock");

  console.log("— مسیر امن");
  check("../ رد می‌شود", await rejects(() => files.readTextFile("../outside/secret.txt")));
  check("مسیر مطلق به ریشه نسبی می‌شود، نه سیستم", await rejects(() => files.readTextFile("/etc/passwd"), 404));
  check("symlink به بیرون رد می‌شود", await rejects(() => files.readTextFile("link-out/secret.txt"), 403));
  check(".env مسدود است", await rejects(() => files.readTextFile(".env"), 403));
  check(".env.example مجاز است", (await files.readTextFile(".env.example")).content === "A=");
  check("node_modules مسدود است", await rejects(() => files.listTree("node_modules"), 403));
  check("null byte رد می‌شود", await rejects(() => files.readTextFile("app/page.tsx\0.png")));
  check("فایل باینری باز نمی‌شود", await rejects(() => files.readTextFile("bin.dat"), 415));
  check("normalize: a/../app/page.tsx", paths.normalizeRelPath("app/../app/page.tsx") === "app/page.tsx");

  console.log("— درخت");
  const tree = await files.listTree("");
  const names = tree.map((e) => e.name);
  check(".env و node_modules در درخت نیستند", !names.includes(".env") && !names.includes("node_modules"), names);
  check("symlink در درخت نیست", !names.includes("link-out"), names);
  check("پوشه‌ها قبل از فایل‌ها", tree[0].type === "dir");

  console.log("— ذخیره، پشتیبان، تضاد");
  const opened = await files.readTextFile("app/page.tsx");
  const saved = await files.saveTextFile("app/page.tsx", "v2\n", opened.sha);
  check("ذخیره موفق", fs.readFileSync(path.join(root, "app/page.tsx"), "utf8") === "v2\n");
  check("sha جدید برگشت", saved.sha !== opened.sha);
  check("ذخیره با sha قدیمی ۴۰۹", await rejects(() => files.saveTextFile("app/page.tsx", "v3\n", opened.sha), 409));
  check("فایل tmp جا نمانده", !fs.readdirSync(path.join(root, "app")).some((n) => n.endsWith(".tmp")));
  let versions = await files.listVersions("app/page.tsx");
  check("یک نسخه‌ی پشتیبان", versions.length === 1, versions);
  check("پشتیبان همان محتوای قبلی", fs.readFileSync(path.join(tmp, "backups/files/app/page.tsx", versions[0].id), "utf8") === "export default function P(){}\n");

  console.log("— ساخت، حذف، بازگردانی");
  await files.createTextFile("app/new/file.ts", "hello");
  check("ساخت فایل (با پوشه‌ی جدید)", fs.readFileSync(path.join(root, "app/new/file.ts"), "utf8") === "hello");
  check("ساخت فایل تکراری ۴۰۹", await rejects(() => files.createTextFile("app/new/file.ts"), 409));
  check("ساخت .env مسدود", await rejects(() => files.createTextFile(".env.local", "x"), 403));
  await files.deleteFile("app/new/file.ts");
  check("حذف انجام شد", !fs.existsSync(path.join(root, "app/new/file.ts")));
  const delVersions = await files.listVersions("app/new/file.ts");
  check("حذف پشتیبان گرفت", delVersions.length === 1);
  await files.restoreVersion("app/new/file.ts", delVersions[0].id);
  check("بازگردانی فایل حذف‌شده", fs.readFileSync(path.join(root, "app/new/file.ts"), "utf8") === "hello");
  versions = await files.listVersions("app/page.tsx");
  await files.restoreVersion("app/page.tsx", versions[0].id);
  check("بازگردانی نسخه‌ی قبلی", fs.readFileSync(path.join(root, "app/page.tsx"), "utf8") === "export default function P(){}\n");
  check("بازگردانی هم پشتیبان گرفت", (await files.listVersions("app/page.tsx")).length === 2);
  check("شناسه‌ی نسخه‌ی نامعتبر رد", await rejects(() => files.restoreVersion("app/page.tsx", "../../etc")));
  check("فایل بزرگ‌تر از سقف رد", await rejects(() => files.createTextFile("big.txt", "x".repeat(2 * 1024 * 1024 + 1)), 413));

  console.log("— نقشه‌ی route");
  const routes = await files.listRoutes();
  const byUrl = (u: string, k: string) => routes.some((r) => r.url === u && r.kind === k);
  check("/ صفحه", byUrl("/", "page"));
  check("/api/hello API", byUrl("/api/hello", "api"));
  check("گروه (shop) از URL حذف می‌شود", byUrl("/cart", "page"), routes);

  console.log("— توکن بازکردن قفل");
  const token = unlock.createUnlockToken("admin1");
  check("توکن معتبر", unlock.verifyUnlockToken(token, "admin1"));
  check("ادمین دیگر رد", !unlock.verifyUnlockToken(token, "admin2"));
  check("منقضی رد", !unlock.verifyUnlockToken(unlock.createUnlockToken("admin1", Date.now() - unlock.IDE_UNLOCK_TTL_MS - 1000), "admin1"));
  check("دستکاری‌شده رد", !unlock.verifyUnlockToken(token.replace(/.$/, (c) => (c === "0" ? "1" : "0")), "admin1"));
  check("خالی رد", !unlock.verifyUnlockToken(undefined, "admin1") && !unlock.verifyUnlockToken("a.b", "admin1"));

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${passed} گام موفق، ${failures.length} ناموفق`);
  if (failures.length) { console.log("ناموفق:", failures); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
