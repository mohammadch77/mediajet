// ثبت خطاهای برنامه در DB (ErrorLog): ساخت fingerprint، استخراج مکان خطا، پاک‌سازی داده‌ی حساس
// و ادغام خطاهای تکراری. ثبت هرگز خطا پرتاب نمی‌کند تا خودِ لاگ‌گیری باعث خطای تازه نشود.

import { createHash } from "crypto";
import { prisma } from "./db";
import { mapClientLocation } from "./sourceMap";

export type ErrorSource = "client" | "server";
export type ErrorKind = "error" | "unhandledrejection" | "boundary" | "api" | "network" | "server";

export type RecordErrorInput = {
  source: ErrorSource;
  kind: ErrorKind;
  message: string;
  stack?: string | null;
  componentStack?: string | null;
  url?: string | null;
  statusCode?: number | null;
  digest?: string | null;
  userAgent?: string | null;
  userId?: string | null;
};

export type StackFrame = { fn: string | null; file: string; line: number; column: number };

const MAX_MESSAGE = 600;
const MAX_STACK = 8000;
const MAX_COMPONENT_STACK = 3000;
const MAX_FRAMES_RESOLVED = 14;
const MAX_ROWS = 5000;
const RESOLVED_KEEP_DAYS = 90;

/** query و hash آدرس‌ها (ممکن است توکن بازیابی/ref داشته باشند) از متن حذف می‌شود. */
export function stripUrlSecrets(text: string): string {
  return text.replace(/(https?:\/\/[^\s)'"<>?#]+)[?#][^\s)'"<>]*/g, "$1");
}

export function cleanPageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url, "https://x.invalid").pathname.slice(0, 300);
  } catch {
    return url.split(/[?#]/)[0].slice(0, 300);
  }
}

export function parseStackFrames(stack: string | null | undefined): StackFrame[] {
  if (!stack) return [];
  const frames: StackFrame[] = [];
  for (const raw of stack.split("\n")) {
    const text = raw.trim();
    // Chrome/Node:  at fn (file:line:col)  |  at file:line:col
    let m = /^at (?:(.*?) \()?(.+?):(\d+):(\d+)\)?$/.exec(text);
    // Firefox/Safari:  fn@file:line:col
    if (!m) {
      const f = /^(.*?)@(.+?):(\d+):(\d+)$/.exec(text);
      if (f) m = [f[0], f[1], f[2], f[3], f[4]] as unknown as RegExpExecArray;
    }
    if (m) frames.push({ fn: m[1] || null, file: m[2], line: Number(m[3]), column: Number(m[4]) });
    if (frames.length >= 40) break;
  }
  return frames;
}

function isLibraryPath(file: string): boolean {
  return /node_modules|next\/dist|react-dom|\/framework[-.]|webpack-runtime|node:internal/.test(file);
}

/** برای خط‌های stack با bundle کلاینت، مکان اصلی را از source map می‌گیرد و بهترین فریمِ کد خودمان را برمی‌گزیند. */
type BestLocation = { file: string; line: number; column: number; fn: string | null; mapped: boolean };

async function resolveLocation(frames: StackFrame[]): Promise<{ best: BestLocation | null; resolvedStack: string | null }> {
  if (frames.length === 0) return { best: null, resolvedStack: null };
  const lines: string[] = [];
  let best: BestLocation | null = null;
  let firstRaw: BestLocation | null = null;

  for (const frame of frames.slice(0, MAX_FRAMES_RESOLVED)) {
    const mapped = frame.file.includes("/_next/static/")
      ? await mapClientLocation(frame.file, frame.line, frame.column).catch(() => null)
      : null;
    const file = mapped ? mapped.file : cleanFramePath(frame.file);
    const line = mapped ? mapped.line : frame.line;
    const column = mapped ? mapped.column : frame.column;
    const fn = mapped?.name ?? frame.fn;
    lines.push(`at ${fn ? fn + " " : ""}(${file}:${line}:${column})${mapped ? "" : " [bundle]"}`);
    if (!firstRaw) firstRaw = { file, line, column, fn, mapped: !!mapped };
    if (!best && !isLibraryPath(file) && (mapped || !frame.file.includes("/_next/static/"))) {
      best = { file, line, column, fn, mapped: !!mapped };
    }
  }
  return { best: best ?? firstRaw, resolvedStack: lines.join("\n") };
}

function cleanFramePath(file: string): string {
  const cwd = process.cwd().replace(/\\/g, "/");
  let f = file.replace(/^file:\/\//, "").replace(/^webpack-internal:\/\/\/(\([^)]*\)\/)?/, "").replace(/^webpack:\/\/[^/]*\//, "");
  f = f.replace(/^\.\//, "");
  if (f.startsWith(cwd + "/")) f = f.slice(cwd.length + 1);
  return f;
}

function normalizeForFingerprint(message: string): string {
  return message
    .replace(/[0-9a-f]{8,}/gi, "H")
    .replace(/\d+/g, "N")
    .slice(0, 200);
}

const recentFingerprints = new Map<string, number>();
const DEDUPE_WINDOW_MS = 2000;

/** خطا را ثبت یا با نمونه‌ی قبلی ادغام می‌کند. هرگز throw نمی‌کند. */
export async function recordError(input: RecordErrorInput): Promise<void> {
  try {
    const message = stripUrlSecrets(String(input.message ?? "")).slice(0, MAX_MESSAGE) || "(بدون پیام)";
    const stack = input.stack ? stripUrlSecrets(input.stack).slice(0, MAX_STACK) : null;
    const frames = parseStackFrames(stack);
    const { best, resolvedStack } = await resolveLocation(frames);

    const fingerprint = createHash("sha256")
      .update([input.source, input.kind, input.statusCode ?? "", normalizeForFingerprint(message), best ? `${best.file}:${best.line}:${best.column}` : ""].join("|"))
      .digest("hex")
      .slice(0, 40);

    // سیل خطای یکسان در چند میلی‌ثانیه (مثلاً حلقه‌ی رندر) فقط یک بار به DB می‌رسد.
    const now = Date.now();
    const last = recentFingerprints.get(fingerprint);
    if (last && now - last < DEDUPE_WINDOW_MS) return;
    recentFingerprints.set(fingerprint, now);
    if (recentFingerprints.size > 500) recentFingerprints.clear();

    const data = {
      source: input.source,
      kind: input.kind,
      message,
      stack,
      resolvedStack,
      componentStack: input.componentStack ? stripUrlSecrets(input.componentStack).slice(0, MAX_COMPONENT_STACK) : null,
      file: best?.file ?? null,
      line: best?.line ?? null,
      column: best?.column ?? null,
      functionName: best?.fn ?? null,
      locationMapped: best?.mapped ?? false,
      url: cleanPageUrl(input.url),
      statusCode: input.statusCode ?? null,
      digest: input.digest?.slice(0, 100) ?? null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      lastUserId: input.userId ?? null,
    };

    await prisma.errorLog.upsert({
      where: { fingerprint },
      create: { fingerprint, ...data },
      // تکرار یک خطای «حل‌شده» یعنی برگشته (regression): دوباره باز می‌شود.
      update: { count: { increment: 1 }, lastSeenAt: new Date(), status: "open", resolvedAt: null, url: data.url, lastUserId: data.lastUserId, userAgent: data.userAgent, digest: data.digest ?? undefined },
    });

    if (Math.random() < 0.02) void pruneErrorLogs();
  } catch {
    // خودِ لاگ‌گیری نباید خطای تازه بسازد.
  }
}

/** حل‌شده‌های قدیمی و ردیف‌های بیش از سقف حذف می‌شوند تا جدول بی‌نهایت بزرگ نشود. */
export async function pruneErrorLogs(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - RESOLVED_KEEP_DAYS * 24 * 3600 * 1000);
    await prisma.errorLog.deleteMany({ where: { status: "resolved", lastSeenAt: { lt: cutoff } } });
    const total = await prisma.errorLog.count();
    if (total > MAX_ROWS) {
      const old = await prisma.errorLog.findMany({ orderBy: { lastSeenAt: "asc" }, take: total - MAX_ROWS, select: { id: true } });
      await prisma.errorLog.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }
  } catch {
    /* بی‌اثر */
  }
}
