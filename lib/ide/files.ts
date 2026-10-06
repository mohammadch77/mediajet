// عملیات فایل ابزار توسعه: درخت، خواندن، ذخیره‌ی اتمیک با کنترل تغییر هم‌زمان، ساخت، حذف و نسخه‌های پشتیبان.
// قبل از هر نوشتن/حذف، نسخه‌ی فعلی در IDE_BACKUP_DIR ذخیره می‌شود تا همیشه بشود برگرداند.

import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { IDE_BACKUP_DIR, IDE_ROOT, IdeError, isBlockedSegment, resolveSafe } from "./paths";

export const MAX_READ_BYTES = 1024 * 1024; // ۱ مگابایت
export const MAX_WRITE_BYTES = 2 * 1024 * 1024; // ۲ مگابایت
const MAX_VERSIONS_LISTED = 50;

export type TreeEntry = { name: string; path: string; type: "dir" | "file"; size: number };

export function sha256(content: Buffer | string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/** یک سطح از درخت (بارگذاری تنبل). symlinkها دنبال نمی‌شوند. */
export async function listTree(relInput: string): Promise<TreeEntry[]> {
  const { rel, abs } = await resolveSafe(relInput);
  const entries = await fs.readdir(abs, { withFileTypes: true }).catch(() => {
    throw new IdeError("پوشه پیدا نشد.", 404);
  });

  const result: TreeEntry[] = [];
  for (const entry of entries) {
    const isDir = entry.isDirectory();
    if (!isDir && !entry.isFile()) continue;
    if (isBlockedSegment(entry.name, isDir)) continue;
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    const size = isDir ? 0 : (await fs.stat(path.join(abs, entry.name))).size;
    result.push({ name: entry.name, path: childRel, type: isDir ? "dir" : "file", size });
  }
  return result.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
}

export async function readTextFile(relInput: string) {
  const { rel, abs } = await resolveSafe(relInput);
  const stat = await fs.stat(abs).catch(() => {
    throw new IdeError("فایل پیدا نشد.", 404);
  });
  if (!stat.isFile()) throw new IdeError("این مسیر فایل نیست.");
  if (stat.size > MAX_READ_BYTES) throw new IdeError("فایل بزرگ‌تر از ۱ مگابایت است و در ویرایشگر باز نمی‌شود.", 413);

  const buffer = await fs.readFile(abs);
  if (buffer.includes(0)) throw new IdeError("این فایل باینری است و در ویرایشگر باز نمی‌شود.", 415);
  const content = buffer.toString("utf8");
  return { path: rel, content, sha: sha256(buffer), size: stat.size, modifiedAt: stat.mtime.toISOString() };
}

// --- نسخه‌های پشتیبان -------------------------------------------------------

function backupDirFor(rel: string): string {
  return path.join(IDE_BACKUP_DIR, "files", ...rel.split("/"));
}

export async function backupCurrent(rel: string, abs: string): Promise<void> {
  const current = await fs.readFile(abs).catch(() => null);
  if (!current) return;
  const dir = backupDirFor(rel);
  await fs.mkdir(dir, { recursive: true });
  // شناسه‌ی نسخه = زمان به میلی‌ثانیه؛ در برخورد (دو ذخیره در یک میلی‌ثانیه) پسوند شمارنده می‌گیرد.
  let id = String(Date.now());
  for (let n = 1; await fs.stat(path.join(dir, id)).then(() => true, () => false); n++) {
    id = `${Date.now()}-${n}`;
  }
  await fs.writeFile(path.join(dir, id), current, { mode: 0o600 });
}

export type VersionEntry = { id: string; createdAt: string; size: number };

export async function listVersions(relInput: string): Promise<VersionEntry[]> {
  const { rel } = await resolveSafe(relInput);
  const dir = backupDirFor(rel);
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const versions: VersionEntry[] = [];
  for (const name of names) {
    const stat = await fs.stat(path.join(dir, name)).catch(() => null);
    const ms = Number(name.split("-")[0]);
    if (stat?.isFile() && Number.isFinite(ms)) {
      versions.push({ id: name, createdAt: new Date(ms).toISOString(), size: stat.size });
    }
  }
  return versions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id.localeCompare(a.id))).slice(0, MAX_VERSIONS_LISTED);
}

// --- نوشتن ------------------------------------------------------------------

export async function atomicWrite(abs: string, content: Buffer, mode?: number): Promise<void> {
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.ide-${process.pid}-${Date.now()}.tmp`;
  await fs.writeFile(tmp, content, mode !== undefined ? { mode } : undefined);
  await fs.rename(tmp, abs);
}

/**
 * ذخیره‌ی فایل موجود. baseSha هش نسخه‌ای است که ویرایشگر باز کرده؛ اگر فایل روی دیسک در این فاصله
 * عوض شده باشد (مثلاً deploy یا ویرایش دیگر)، به‌جای بازنویسی بی‌صدا خطای ۴۰۹ می‌دهد.
 */
export async function saveTextFile(relInput: string, content: string, baseSha: string) {
  const { rel, abs } = await resolveSafe(relInput);
  const buffer = Buffer.from(content, "utf8");
  if (buffer.length > MAX_WRITE_BYTES) throw new IdeError("فایل بزرگ‌تر از ۲ مگابایت است.", 413);

  const stat = await fs.stat(abs).catch(() => null);
  if (!stat?.isFile()) throw new IdeError("فایل پیدا نشد.", 404);
  const current = await fs.readFile(abs);
  if (sha256(current) !== baseSha) {
    throw new IdeError("این فایل بعد از باز کردنش تغییر کرده است. دوباره بازش کن تا تغییرات از دست نرود.", 409);
  }

  await backupCurrent(rel, abs);
  await atomicWrite(abs, buffer, stat.mode & 0o777);
  return { path: rel, sha: sha256(buffer), size: buffer.length };
}

export async function createTextFile(relInput: string, content = "") {
  const { rel, abs } = await resolveSafe(relInput);
  if (!rel) throw new IdeError("نام فایل الزامی است.");
  const buffer = Buffer.from(content, "utf8");
  if (buffer.length > MAX_WRITE_BYTES) throw new IdeError("فایل بزرگ‌تر از ۲ مگابایت است.", 413);
  if (await fs.stat(abs).then(() => true, () => false)) throw new IdeError("این فایل از قبل وجود دارد.", 409);

  await atomicWrite(abs, buffer);
  return { path: rel, sha: sha256(buffer), size: buffer.length };
}

export async function deleteFile(relInput: string): Promise<string> {
  const { rel, abs } = await resolveSafe(relInput);
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat?.isFile()) throw new IdeError("فایل پیدا نشد.", 404);
  await backupCurrent(rel, abs);
  await fs.unlink(abs);
  return rel;
}

export async function restoreVersion(relInput: string, versionId: string) {
  const { rel, abs } = await resolveSafe(relInput);
  if (!/^\d+(-\d+)?$/.test(versionId)) throw new IdeError("شناسه‌ی نسخه نامعتبر است.");
  const versionPath = path.join(backupDirFor(rel), versionId);
  const content = await fs.readFile(versionPath).catch(() => {
    throw new IdeError("این نسخه پیدا نشد.", 404);
  });

  const stat = await fs.stat(abs).catch(() => null);
  // خودِ بازگردانی هم برگشت‌پذیر است: نسخه‌ی فعلی قبل از جایگزینی پشتیبان‌گیری می‌شود.
  if (stat?.isFile()) await backupCurrent(rel, abs);
  await atomicWrite(abs, content, stat ? stat.mode & 0o777 : undefined);
  return { path: rel, sha: sha256(content), size: content.length };
}

// --- مسیرهای برنامه (نقشه‌ی route) -----------------------------------------

export type RouteEntry = { url: string; file: string; kind: "page" | "api" | "layout" };

/** فایل‌های app/** را به آدرس‌های سایت تبدیل می‌کند تا با یک کلیک سراغ کد هر صفحه/API بروی. */
export async function listRoutes(): Promise<RouteEntry[]> {
  const appDir = path.join(IDE_ROOT, "app");
  const routes: RouteEntry[] = [];

  async function walk(dir: string, segments: string[]): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (isBlockedSegment(entry.name, true)) continue;
        const isGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
        await walk(path.join(dir, entry.name), isGroup ? segments : [...segments, entry.name]);
        continue;
      }
      const kind =
        /^page\.(tsx|ts|jsx|js)$/.test(entry.name) ? "page" :
        /^route\.(ts|js)$/.test(entry.name) ? "api" :
        /^layout\.(tsx|ts|jsx|js)$/.test(entry.name) ? "layout" : null;
      if (!kind) continue;
      const file = ["app", ...path.relative(appDir, path.join(dir, entry.name)).split(path.sep)].join("/");
      routes.push({ url: "/" + segments.join("/"), file, kind });
    }
  }

  await walk(appDir, []);
  return routes.sort((a, b) => a.url.localeCompare(b.url) || a.kind.localeCompare(b.kind));
}
