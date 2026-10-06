// Deploy از داخل پنل: (اختیاری) نصب وابستگی‌ها و migration دیتابیس، سپس typecheck ← build ← ری‌استارت.
// اسکریپت فقط از رشته‌های ثابت ساخته می‌شود؛ هیچ ورودی کاربر داخل دستور shell نمی‌رود (فقط دو boolean).
// اگر typecheck یا build شکست بخورد، ری‌استارت انجام نمی‌شود و نسخه‌ی در حال اجرا دست‌نخورده می‌ماند.
// فرایند با setsid از درخت فرایند برنامه جدا می‌شود تا `pm2 restart` خودش را نکُشد و لاگ تا آخر نوشته شود.

import crypto from "crypto";
import { spawn } from "child_process";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { IDE_BACKUP_DIR, IDE_ROOT, IdeError } from "./paths";

export const DEPLOY_DONE_MARKER = "__IDE_DEPLOY_DONE__";
const DEPLOY_STALE_MS = 30 * 60 * 1000;
const LOG_TAIL_BYTES = 64 * 1024;

export type DeployOptions = { install: boolean; migrate: boolean };
export type DeployStatus = {
  id: string;
  state: "running" | "success" | "failed";
  startedAt: string;
  log: string;
};

const deployDir = () => path.join(IDE_BACKUP_DIR, "deploy");
const logPath = (id: string) => path.join(deployDir(), `${id}.log`);
const lockPath = () => path.join(deployDir(), "current.lock");

/** نام فرایند در pm2 (پیش‌فرض getstock). فقط حروف/عدد/خط‌تیره/نقطه مجاز است. */
function pm2Name(): string {
  const name = process.env.IDE_PM2_NAME || "getstock";
  if (!/^[A-Za-z0-9_.-]{1,60}$/.test(name)) throw new IdeError("IDE_PM2_NAME نامعتبر است.", 500);
  return name;
}

export function buildDeployScript(options: DeployOptions): string {
  const step = (title: string, cmd: string) =>
    `echo ""\necho "=== ${title} ==="\n${cmd} || { echo "${DEPLOY_DONE_MARKER} failed"; exit 1; }`;
  const lines = ["set -u", `cd "${IDE_ROOT}"`];
  if (options.install) lines.push(step("نصب وابستگی‌ها (npm install)", "npm install --no-audit --no-fund"));
  if (options.migrate) {
    lines.push(step("اعمال migrationهای دیتابیس", "npx prisma migrate deploy"));
    lines.push(step("ساخت Prisma Client", "npx prisma generate"));
  }
  lines.push(step("بررسی نوع‌ها (tsc)", "npx tsc --noEmit"));
  lines.push(step("ساخت برنامه (next build)", "npm run build"));
  lines.push(step("ری‌استارت برنامه (pm2)", `pm2 restart ${pm2Name()}`));
  lines.push(`echo "${DEPLOY_DONE_MARKER} success"`);
  return lines.join("\n") + "\n";
}

async function readLog(id: string): Promise<string> {
  const handle = await fsp.open(logPath(id), "r").catch(() => null);
  if (!handle) return "";
  try {
    const { size } = await handle.stat();
    const start = Math.max(0, size - LOG_TAIL_BYTES);
    const buffer = Buffer.alloc(size - start);
    await handle.read(buffer, 0, buffer.length, start);
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

export async function getDeployStatus(id: string): Promise<DeployStatus> {
  if (!/^[0-9a-f]{20}$/.test(id)) throw new IdeError("شناسه‌ی deploy نامعتبر است.");
  const stat = await fsp.stat(logPath(id)).catch(() => null);
  if (!stat) throw new IdeError("این deploy پیدا نشد.", 404);
  const log = await readLog(id);
  const done = log.match(new RegExp(`${DEPLOY_DONE_MARKER} (success|failed)`));
  // اگر مارکر نیامده ولی مدت‌ها لاگ جدیدی نیامده، فرایند مرده است.
  const stale = !done && Date.now() - stat.mtimeMs > DEPLOY_STALE_MS;
  return {
    id,
    state: done ? (done[1] as "success" | "failed") : stale ? "failed" : "running",
    startedAt: stat.birthtime.toISOString(),
    log: log.replaceAll(new RegExp(`${DEPLOY_DONE_MARKER}.*\\n?`, "g"), ""),
  };
}

/** شناسه‌ی deployِ در حال اجرا (اگر باشد). */
async function runningDeployId(): Promise<string | null> {
  const id = (await fsp.readFile(lockPath(), "utf8").catch(() => "")).trim();
  if (!id) return null;
  const status = await getDeployStatus(id).catch(() => null);
  return status?.state === "running" ? id : null;
}

export async function startDeploy(options: DeployOptions): Promise<string> {
  const script = buildDeployScript(options);
  await fsp.mkdir(deployDir(), { recursive: true });
  if (await runningDeployId()) throw new IdeError("یک deploy در حال اجراست؛ صبر کن تمام شود.", 409);

  const id = crypto.randomBytes(10).toString("hex");
  const out = fs.openSync(logPath(id), "a", 0o600);
  fs.writeSync(out, `deploy ${id} — ${new Date().toISOString()} (install=${options.install}, migrate=${options.migrate})\n`);
  await fsp.writeFile(lockPath(), id);

  const scriptFile = path.join(deployDir(), `${id}.sh`);
  await fsp.writeFile(scriptFile, script, { mode: 0o700 });

  // setsid: فرایند جدید در نشست جدا؛ با ری‌استارت برنامه کشته نمی‌شود.
  const child = spawn("setsid", ["bash", scriptFile], {
    cwd: IDE_ROOT,
    detached: true,
    stdio: ["ignore", out, out],
  });
  child.on("error", (error) => {
    fs.writeSync(out, `\nخطا در اجرای deploy: ${error.message}\n${DEPLOY_DONE_MARKER} failed\n`);
  });
  child.unref();
  fs.closeSync(out);
  return id;
}

export async function latestDeployId(): Promise<string | null> {
  const names = await fsp.readdir(deployDir()).catch(() => [] as string[]);
  const logs = names.filter((n) => /^[0-9a-f]{20}\.log$/.test(n));
  let best: { id: string; mtime: number } | null = null;
  for (const name of logs) {
    const stat = await fsp.stat(path.join(deployDir(), name)).catch(() => null);
    if (stat && (!best || stat.mtimeMs > best.mtime)) best = { id: name.slice(0, 20), mtime: stat.mtimeMs };
  }
  return best?.id ?? null;
}
