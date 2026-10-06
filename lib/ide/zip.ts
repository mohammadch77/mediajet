// زیپ پروژه: دانلود کل کد و «اعمال زیپ» (آپلود ← پیش‌نمایش تغییرات ← تأیید). ورودی زیپ هرگز اعتماد
// نمی‌شود: مسیرها نرمال و امن‌سازی می‌شوند، فایل‌های مسدود/محرمانه رد می‌شوند، سقف حجم و تعداد
// برای جلوگیری از zip bomb اعمال می‌شود و هر فایلِ بازنویسی‌شده قبلش پشتیبان‌گیری می‌شود.

import AdmZip from "adm-zip";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { atomicWrite, backupCurrent, sha256 } from "./files";
import { IDE_BACKUP_DIR, IDE_ROOT, IdeError, isBlockedSegment, normalizeRelPath, resolveSafe } from "./paths";

export const MAX_ZIP_UPLOAD_BYTES = 50 * 1024 * 1024; // ۵۰ مگابایت (فشرده)
const MAX_ZIP_ENTRIES = 20_000;
const MAX_ZIP_TOTAL_BYTES = 300 * 1024 * 1024; // مجموع حجم بازشده
const MAX_ZIP_FILE_BYTES = 50 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;
const STAGING_TTL_MS = 30 * 60 * 1000;
const PLAN_LIST_LIMIT = 300;

/** پوشه‌هایی که در دانلود نیستند (ساخته‌شده یا داده‌ی زمان اجرا). */
const DOWNLOAD_EXCLUDED_DIRS = new Set(["storage", "out", "build", "dist"]);

function skipForDownload(name: string, isDir: boolean, abs: string): boolean {
  if (isBlockedSegment(name, isDir)) return true;
  if (isDir && DOWNLOAD_EXCLUDED_DIRS.has(name)) return true;
  if (!isDir && name.endsWith(".log")) return true;
  return abs === IDE_BACKUP_DIR;
}

/** زیپ کل کد منبع پروژه (بدون node_modules، .next، .git، .env و کلیدها). */
export async function buildProjectZip(): Promise<{ buffer: Buffer; fileCount: number }> {
  const zip = new AdmZip();
  let fileCount = 0;
  let total = 0;

  async function walk(dir: string, relDir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const isDir = entry.isDirectory();
      if (!isDir && !entry.isFile()) continue; // symlink و موارد خاص دنبال نمی‌شوند
      if (skipForDownload(entry.name, isDir, abs)) continue;
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (isDir) {
        await walk(abs, rel);
        continue;
      }
      const data = await fs.readFile(abs);
      total += data.length;
      if (total > MAX_DOWNLOAD_BYTES) throw new IdeError("حجم پروژه برای دانلود زیپ بیش از حد است.", 413);
      zip.addFile(rel, data);
      fileCount++;
    }
  }

  await walk(IDE_ROOT, "");
  return { buffer: zip.toBuffer(), fileCount };
}

// --- اعمال زیپ ---------------------------------------------------------------

export type ZipFileChange = { path: string; status: "added" | "modified"; size: number };
export type ZipPlan = {
  planId: string;
  added: number;
  modified: number;
  unchanged: number;
  skipped: { path: string; reason: string }[];
  changes: ZipFileChange[]; // حداکثر PLAN_LIST_LIMIT مورد اول؛ تعداد کل در added/modified
  truncated: boolean;
};

type ParsedEntry = { rel: string; data: Buffer };

function isSymlinkEntry(entry: AdmZip.IZipEntry): boolean {
  return ((entry.attr >>> 16) & 0o170000) === 0o120000;
}

/** زیپ را اعتبارسنجی می‌کند و فایل‌های قابل‌اعمال و رد‌شده‌ها را برمی‌گرداند. */
function parseZip(buffer: Buffer): { files: ParsedEntry[]; skipped: { path: string; reason: string }[] } {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new IdeError("فایل زیپ نامعتبر یا خراب است.");
  }
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  if (entries.length === 0) throw new IdeError("زیپ خالی است.");
  if (entries.length > MAX_ZIP_ENTRIES) throw new IdeError("تعداد فایل‌های زیپ بیش از حد مجاز است.", 413);

  // سقف حجم بازشده از روی هدر؛ قبل از هر استخراج (ضد zip bomb)
  const declared = entries.reduce((sum, e) => sum + e.header.size, 0);
  if (declared > MAX_ZIP_TOTAL_BYTES) throw new IdeError("حجم بازشده‌ی زیپ بیش از حد مجاز است.", 413);

  // زیپِ یک پوشه (my-project/package.json …) ← پیشوند مشترک حذف شود.
  // نام خام (قبل از پاک‌سازی داخلی کتابخانه) تا ../ و مسیر مطلق «بی‌صدا» به ریشه منتقل نشوند، رد شوند.
  const names = entries.map((e) => e.rawEntryName.toString("utf8").replace(/\\/g, "/").replace(/^\.\//, ""));
  const hasRootPackage = names.includes("package.json");
  let prefix = "";
  if (!hasRootPackage) {
    const first = names[0].split("/")[0];
    if (names.every((n) => n.startsWith(first + "/")) && names.includes(`${first}/package.json`)) {
      prefix = first + "/";
    }
  }

  const files: ParsedEntry[] = [];
  const skipped: { path: string; reason: string }[] = [];
  entries.forEach((entry, i) => {
    const name = names[i].slice(prefix.length);
    if (isSymlinkEntry(entry)) return void skipped.push({ path: name, reason: "symlink" });
    if (entry.header.size > MAX_ZIP_FILE_BYTES) return void skipped.push({ path: name, reason: "حجم زیاد" });
    let rel: string;
    try {
      if (name.startsWith("/") || /^[A-Za-z]:/.test(name)) throw new IdeError("مسیر مطلق");
      rel = normalizeRelPath(name);
    } catch {
      return void skipped.push({ path: name, reason: "مسیر نامعتبر" });
    }
    if (!rel) return;
    const parts = rel.split("/");
    const blocked = parts.some((part, idx) => isBlockedSegment(part, idx < parts.length - 1));
    if (blocked) return void skipped.push({ path: rel, reason: "مسدود (محرمانه یا ساخته‌شده)" });
    files.push({ rel, data: entry.getData() });
  });
  return { files, skipped };
}

function stagingPath(planId: string): string {
  return path.join(IDE_BACKUP_DIR, "staging", `${planId}.zip`);
}

async function currentSha(abs: string): Promise<string | null> {
  const data = await fs.readFile(abs).catch(() => null);
  return data ? sha256(data) : null;
}

/** پیش‌نمایش: چه چیزی اضافه/تغییر می‌کند. زیپ تا تأیید در staging می‌ماند (۳۰ دقیقه). */
export async function planZipApply(adminId: string, buffer: Buffer): Promise<ZipPlan> {
  if (buffer.length === 0) throw new IdeError("فایلی ارسال نشد.");
  if (buffer.length > MAX_ZIP_UPLOAD_BYTES) throw new IdeError("حجم زیپ بیشتر از ۵۰ مگابایت است.", 413);
  const { files, skipped } = parseZip(buffer);

  const changes: ZipFileChange[] = [];
  let added = 0;
  let modified = 0;
  let unchanged = 0;
  for (const file of files) {
    const { abs } = await resolveSafe(file.rel);
    const existing = await currentSha(abs);
    if (existing === null) added++;
    else if (existing !== sha256(file.data)) modified++;
    else {
      unchanged++;
      continue;
    }
    if (changes.length < PLAN_LIST_LIMIT) {
      changes.push({ path: file.rel, status: existing === null ? "added" : "modified", size: file.data.length });
    }
  }

  const planId = `${adminId}-${crypto.randomBytes(12).toString("hex")}`;
  await fs.mkdir(path.dirname(stagingPath(planId)), { recursive: true });
  await fs.writeFile(stagingPath(planId), buffer, { mode: 0o600 });
  await cleanupStaging();

  return { planId, added, modified, unchanged, skipped: skipped.slice(0, 50), changes, truncated: added + modified > changes.length };
}

/**
 * اعمال پلنِ تأییدشده. زیپ از staging دوباره خوانده و اعتبارسنجی می‌شود (به پیش‌نمایش اعتماد نمی‌شود).
 * فایل‌های موجود فقط وقتی عوض می‌شوند که محتوا فرق کند و قبلش پشتیبان‌گیری می‌شوند.
 * فایل‌هایی که در زیپ نیستند حذف نمی‌شوند (اعمال فقط اضافه/جایگزین می‌کند).
 */
export async function applyZipPlan(adminId: string, planId: string) {
  if (!/^[A-Za-z0-9_-]+-[0-9a-f]{24}$/.test(planId) || !planId.startsWith(`${adminId}-`)) {
    throw new IdeError("شناسه‌ی پیش‌نمایش نامعتبر است.");
  }
  const buffer = await fs.readFile(stagingPath(planId)).catch(() => {
    throw new IdeError("پیش‌نمایش منقضی شده است. زیپ را دوباره آپلود کن.", 404);
  });

  const { files } = parseZip(buffer);
  let applied = 0;
  for (const file of files) {
    const { rel, abs } = await resolveSafe(file.rel);
    const existing = await currentSha(abs);
    if (existing === sha256(file.data)) continue;
    if (existing !== null) await backupCurrent(rel, abs);
    const stat = await fs.stat(abs).catch(() => null);
    await atomicWrite(abs, file.data, stat ? stat.mode & 0o777 : 0o644);
    applied++;
  }
  await fs.unlink(stagingPath(planId)).catch(() => undefined);
  return { applied };
}

async function cleanupStaging(): Promise<void> {
  const dir = path.join(IDE_BACKUP_DIR, "staging");
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const now = Date.now();
  for (const name of names) {
    const stat = await fs.stat(path.join(dir, name)).catch(() => null);
    if (stat && now - stat.mtimeMs > STAGING_TTL_MS) await fs.unlink(path.join(dir, name)).catch(() => undefined);
  }
}
