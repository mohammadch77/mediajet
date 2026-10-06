// برگرداندن مکان خطا در باندل کلاینت به کد اصلی با source mapهای ساخته‌شده در build
// (.next/static/**/*.js.map). فقط سمت سرور و فقط مسیرهای زیر .next/static خوانده می‌شود؛ مسیر فایل از
// استکِ ارسالی کلاینت می‌آید (قابل جعل)، پس تحت path guard سخت است.

import { promises as fs } from "fs";
import path from "path";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";

const STATIC_ROOT = path.join(process.cwd(), ".next", "static");
const MAX_CACHED_MAPS = 8;
const MAX_MAP_BYTES = 40 * 1024 * 1024;

const cache = new Map<string, TraceMap | null>();

export type MappedLocation = { file: string; line: number; column: number; name: string | null };

/** مسیر نسبیِ منبع را از پیشوندهای webpack پاک می‌کند: webpack://_N_E/./components/X.tsx → components/X.tsx */
export function cleanSourcePath(source: string): string {
  let s = source.replace(/^webpack-internal:\/\/\/(\([^)]*\)\/)?/, "").replace(/^webpack:\/\/[^/]*\//, "");
  s = s.replace(/^\.\//, "");
  const cwd = process.cwd().replace(/\\/g, "/");
  if (s.startsWith(cwd + "/")) s = s.slice(cwd.length + 1);
  return s;
}

/** URL فایل JS باندل → مسیر امن فایل .map روی دیسک، یا null اگر بیرون از .next/static یا نامعتبر باشد. */
export function mapFilePathForUrl(fileUrl: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(fileUrl, "https://x.invalid").pathname);
  } catch {
    return null;
  }
  const prefix = "/_next/static/";
  if (!pathname.startsWith(prefix) || pathname.includes("\0")) return null;
  const abs = path.resolve(STATIC_ROOT, pathname.slice(prefix.length) + ".map");
  if (!abs.startsWith(STATIC_ROOT + path.sep) || !abs.endsWith(".js.map")) return null;
  return abs;
}

async function loadMap(abs: string): Promise<TraceMap | null> {
  if (cache.has(abs)) return cache.get(abs) ?? null;
  let map: TraceMap | null = null;
  try {
    const stat = await fs.stat(abs);
    if (stat.size <= MAX_MAP_BYTES) map = new TraceMap(JSON.parse(await fs.readFile(abs, "utf8")));
  } catch {
    map = null; // بعد از build جدید، نقشه‌ی باندل قدیمی دیگر وجود ندارد
  }
  if (cache.size >= MAX_CACHED_MAPS) cache.delete(cache.keys().next().value as string);
  cache.set(abs, map);
  return map;
}

/** مکان (خط/ستون ۱‌پایه) در فایل باندل را به مکان کد اصلی ترجمه می‌کند؛ null یعنی نشد. */
export async function mapClientLocation(fileUrl: string, line: number, column: number): Promise<MappedLocation | null> {
  const abs = mapFilePathForUrl(fileUrl);
  if (!abs || line < 1 || column < 1) return null;
  const map = await loadMap(abs);
  if (!map) return null;
  const pos = originalPositionFor(map, { line, column: column - 1 });
  if (!pos.source || pos.line === null || pos.column === null) return null;
  return { file: cleanSourcePath(pos.source), line: pos.line, column: pos.column + 1, name: pos.name };
}
