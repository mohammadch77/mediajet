// مسیریابی امن برای ابزار توسعه‌ی پنل ادمین. همه‌ی مسیرها نسبت به ریشه‌ی پروژه‌اند و هرگز
// از آن بیرون نمی‌روند (path traversal، symlink). فایل‌های محرمانه و پوشه‌های ساخته‌شده مسدودند.

import path from "path";
import fs from "fs/promises";

export class IdeError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "IdeError";
  }
}

/** ریشه‌ی پروژه؛ روی سرور همان پوشه‌ای که pm2 در آن اجرا می‌شود (/var/www). */
export const IDE_ROOT = path.resolve(process.env.IDE_ROOT || process.cwd());
/** نسخه‌های پشتیبان قبل از هر تغییر؛ بیرون از ریشه‌ی پروژه تا با زیپ/deploy قاطی نشود. */
export const IDE_BACKUP_DIR = path.resolve(process.env.IDE_BACKUP_DIR || "/var/backups/getstock-ide");

const BLOCKED_DIRS = new Set([".git", "node_modules", ".next"]);
const BLOCKED_EXTENSIONS = new Set([".pem", ".key", ".p12", ".pfx"]);

/** فایل‌های محرمانه: خواندن، نوشتن و حتی نمایش در درخت ممنوع است (برای ویرایش آن‌ها از SSH استفاده کن). */
function isBlockedName(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower === ".env" || (lower.startsWith(".env.") && lower !== ".env.example")) return true;
  if (lower === "tsconfig.tsbuildinfo") return true;
  return BLOCKED_EXTENSIONS.has(path.extname(lower));
}

export function isBlockedSegment(segment: string, isDir: boolean): boolean {
  return (isDir && BLOCKED_DIRS.has(segment)) || isBlockedName(segment);
}

/** مسیر نسبیِ نرمال‌شده (با /) یا خطا. رشته‌ی خالی یعنی خودِ ریشه. */
export function normalizeRelPath(input: string): string {
  if (typeof input !== "string" || input.includes("\0")) throw new IdeError("مسیر نامعتبر است.");
  const cleaned = input.replace(/\\/g, "/").replace(/^\/+/, "");
  const normalized = path.posix.normalize(cleaned || ".");
  if (normalized === ".") return "";
  if (normalized === ".." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
    throw new IdeError("مسیر خارج از پروژه است.");
  }
  return normalized;
}

function assertNotBlocked(rel: string): void {
  const parts = rel.split("/").filter(Boolean);
  parts.forEach((part, i) => {
    const isDir = i < parts.length - 1;
    if (isBlockedSegment(part, isDir) || BLOCKED_DIRS.has(part)) {
      throw new IdeError("این مسیر از ابزار توسعه مسدود است.", 403);
    }
  });
}

function isInside(root: string, target: string): boolean {
  return target === root || target.startsWith(root + path.sep);
}

/**
 * مسیر مطلق امن برای یک مسیر نسبی. نزدیک‌ترین پدرِ موجود با realpath بررسی می‌شود تا symlink
 * نتواند به بیرون از ریشه اشاره کند (برای فایل جدید هم کار می‌کند).
 */
export async function resolveSafe(relInput: string): Promise<{ rel: string; abs: string }> {
  const rel = normalizeRelPath(relInput);
  assertNotBlocked(rel);
  const abs = path.resolve(IDE_ROOT, rel);
  if (!isInside(IDE_ROOT, abs)) throw new IdeError("مسیر خارج از پروژه است.");

  const realRoot = await fs.realpath(IDE_ROOT);
  let probe = abs;
  for (;;) {
    try {
      const real = await fs.realpath(probe);
      if (!isInside(realRoot, real)) throw new IdeError("مسیر خارج از پروژه است.", 403);
      break;
    } catch (error) {
      if (error instanceof IdeError) throw error;
      const parent = path.dirname(probe);
      if (parent === probe) throw new IdeError("مسیر نامعتبر است.");
      probe = parent;
    }
  }
  return { rel, abs };
}
