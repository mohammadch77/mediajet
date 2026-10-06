// تست بخش‌های بدون DB سیستم لاگ خطا: پارس استک، پاک‌سازی، مسیر امن source map و نگاشت واقعی.
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import Module from "module";

let passed = 0;
function ok(cond: unknown, label: string) {
  if (!cond) { console.error("FAIL:", label); process.exit(1); }
  passed++;
}

// errorLog به DB وصل می‌شود؛ برای تست مستقل، ماژول db با نمونه‌ی ساختگی جایگزین می‌شود.
type Upsert = { where: { fingerprint: string }; create: Record<string, unknown>; update: Record<string, unknown> };
const upserts: Upsert[] = [];
const origLoad = (Module as unknown as { _load: (...a: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...a: unknown[]) => unknown })._load = function (request: unknown, ...rest: unknown[]) {
  if (typeof request === "string" && /(^|\/)db$/.test(request)) {
    return { prisma: { errorLog: { upsert: async (a: Upsert) => { upserts.push(a); }, deleteMany: async () => ({}), count: async () => 0, findMany: async () => [] } } };
  }
  return origLoad.call(this, request, ...rest);
};

async function main() {
  const tmp = path.join(os.tmpdir(), `errlog-${process.pid}`);
  const staticDir = path.join(tmp, ".next", "static", "chunks", "app");
  await fs.mkdir(staticDir, { recursive: true });
  process.chdir(tmp);

  const { parseStackFrames, stripUrlSecrets, cleanPageUrl, recordError } = await import("../lib/errorLog");
  const { mapFilePathForUrl, mapClientLocation, cleanSourcePath } = await import("../lib/sourceMap");

  // پارس استک Chrome و Firefox
  const chrome = parseStackFrames("Error: x\n    at fn (https://getstock.ir/_next/static/chunks/app/page-ab.js:1:2345)\n    at https://getstock.ir/a.js:5:6");
  ok(chrome.length === 2 && chrome[0].fn === "fn" && chrome[0].line === 1 && chrome[0].column === 2345, "پارس استک Chrome");
  ok(chrome[1].fn === null && chrome[1].file === "https://getstock.ir/a.js", "فریم بدون نام تابع");
  const ff = parseStackFrames("handler@https://getstock.ir/x.js:10:20");
  ok(ff.length === 1 && ff[0].fn === "handler" && ff[0].line === 10, "پارس استک Firefox");

  // پاک‌سازی
  ok(stripUrlSecrets("fail https://getstock.ir/reset-password?token=SECRET123#x ok") === "fail https://getstock.ir/reset-password ok", "حذف query/hash از آدرس‌ها");
  ok(cleanPageUrl("https://getstock.ir/reset-password?token=abc") === "/reset-password", "cleanPageUrl");

  // path guard
  ok(mapFilePathForUrl("https://x/_next/static/chunks/app/page-ab.js") !== null, "مسیر معتبر");
  ok(mapFilePathForUrl("https://x/_next/static/../../etc/passwd.js") === null, "traversal رد شد");
  ok(mapFilePathForUrl("https://x/_next/static/%2e%2e/%2e%2e/secret.js") === null, "traversal کدشده رد شد");
  ok(mapFilePathForUrl("https://x/other/page.js") === null, "بیرون از _next/static رد شد");
  ok(cleanSourcePath("webpack://_N_E/./components/OrderDrawer.tsx") === "components/OrderDrawer.tsx", "cleanSourcePath webpack");

  // نگاشت واقعی با یک source map ساده (خط ۱ ستون ۰ باندل → src/a.ts:3:4)
  const map = { version: 3, file: "page-ab.js", sources: ["webpack://_N_E/./components/Foo.tsx"], names: ["boom"], mappings: "AAGIA" };
  await fs.writeFile(path.join(staticDir, "page-ab.js.map"), JSON.stringify(map));
  const mapped = await mapClientLocation("https://getstock.ir/_next/static/chunks/app/page-ab.js", 1, 1);
  ok(mapped && mapped.file === "components/Foo.tsx" && mapped.line === 4 && mapped.column === 5, "نگاشت به کد اصلی (خط ۴ ستون ۵)");
  ok((await mapClientLocation("https://getstock.ir/_next/static/chunks/app/missing.js", 1, 1)) === null, "نقشه‌ی ناموجود → null");

  // recordError: خط اصلی از source map می‌آید و fingerprint پایدار است
  const stack = "Error: boom\n    at boom (https://getstock.ir/_next/static/chunks/app/page-ab.js:1:1)";
  await recordError({ source: "client", kind: "error", message: "boom 123 https://getstock.ir/p?token=zzz", stack, url: "https://getstock.ir/cart?x=1", userId: "u1" });
  const first = upserts[0];
  ok(first && first.create.file === "components/Foo.tsx" && first.create.line === 4 && first.create.locationMapped === true, "recordError: مکان از source map");
  ok(first.create.url === "/cart" && !String(first.create.message).includes("token=zzz"), "recordError: URL و پیام پاک‌سازی شد");
  ok(String(first.create.resolvedStack).includes("components/Foo.tsx:4:5"), "resolvedStack با مسیر اصلی");
  await new Promise((r) => setTimeout(r, 2100));
  await recordError({ source: "client", kind: "error", message: "boom 456 https://getstock.ir/p?token=yyy", stack });
  ok(upserts[1].where.fingerprint === first.where.fingerprint, "عدد/توکن متفاوت → همان fingerprint");
  await recordError({ source: "client", kind: "error", message: "boom 789 https://getstock.ir/p?token=a", stack });
  ok(upserts.length === 2, "تکرار در ۲ ثانیه ثبت نشد (dedupe)");

  // هرگز throw نمی‌کند
  await recordError({ source: "server", kind: "server", message: "", stack: null });
  ok(true, "recordError با ورودی خالی throw نکرد");

  console.log(`همه ${passed} مرحله موفق`);
  await fs.rm(tmp, { recursive: true, force: true });
}
main().catch((e) => { console.error(e); process.exit(1); });
