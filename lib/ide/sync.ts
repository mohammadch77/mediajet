// همگام‌سازی دوطرفه‌ی کد سرور ↔ گیت‌هاب با الگوریتم سه‌طرفه (محلی / ریموت / نقطه‌ی مشترک قبلی).
// «نقطه‌ی مشترک» (manifest) آخرین SHA هر فایل در آخرین همگام‌سازی موفق است و در IDE_BACKUP_DIR/sync
// نگهداری می‌شود (نه داخل پروژه). فایل فقط یک‌طرفه تغییر کرده → خودکار؛ دوطرفه → conflict و
// فقط با انتخاب صریح ادمین (محلی یا ریموت) حل می‌شود. هیچ‌چیز بی‌پشتوانه بازنویسی نمی‌شود: هر
// فایل محلی قبل از تغییر در همان مخزن نسخه‌های IDE بکاپ می‌گیرد.

import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { IDE_BACKUP_DIR, IDE_ROOT, IdeError, isNonSource, normalizeRelPath, resolveSafe } from "./paths";
import { MAX_WRITE_BYTES, atomicWrite, backupCurrent } from "./files";
import { GithubConfig, createCommit, getBlob, getBranchHead, getTree } from "./github";

export const SYNC_MAX_FILES = 5000;
export const SYNC_MAX_PULL_FILES = 300;
export const SYNC_MAX_PUSH_BYTES = 20 * 1024 * 1024;

export type SyncState = "push" | "pull" | "conflict";
export type SyncItem = {
  path: string;
  state: SyncState;
  /** تغییر محلی چیست: edited | added | deleted */
  local: "edited" | "added" | "deleted" | "same";
  remote: "edited" | "added" | "deleted" | "same";
};
export type SyncStatus = {
  branch: string;
  head: string;
  inSync: number;
  items: SyncItem[];
  skipped: string[];
};

type Manifest = { files: Record<string, string> };
type LocalFile = { sha: string; size: number; executable: boolean };

const MANIFEST_PATH = path.join(IDE_BACKUP_DIR, "sync", "manifest.json");

let busy = false;
async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  if (busy) throw new IdeError("یک همگام‌سازی دیگر در حال اجراست.", 409);
  busy = true;
  try {
    return await fn();
  } finally {
    busy = false;
  }
}

export function gitBlobSha(content: Buffer): string {
  return createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");
}

async function loadManifest(): Promise<Manifest> {
  try {
    const raw = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
    if (raw && typeof raw.files === "object" && raw.files) return { files: raw.files as Record<string, string> };
  } catch {
    /* اولین همگام‌سازی */
  }
  return { files: {} };
}

async function saveManifest(manifest: Manifest): Promise<void> {
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await atomicWrite(MANIFEST_PATH, Buffer.from(JSON.stringify(manifest), "utf8"), 0o600);
}

async function scanLocal(skipped: string[]): Promise<Map<string, LocalFile>> {
  const out = new Map<string, LocalFile>();
  async function walk(dirAbs: string, relPrefix: string) {
    const entries = await fs.readdir(dirAbs, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dirAbs, entry.name);
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) continue;
      const isDir = entry.isDirectory();
      if (isNonSource(entry.name, isDir, abs)) continue;
      if (isDir) {
        await walk(abs, rel);
      } else if (entry.isFile()) {
        const stat = await fs.stat(abs);
        if (stat.size > MAX_WRITE_BYTES) {
          skipped.push(rel);
          continue;
        }
        if (out.size >= SYNC_MAX_FILES) throw new IdeError("تعداد فایل‌ها برای همگام‌سازی بیش از حد است.", 413);
        out.set(rel, { sha: gitBlobSha(await fs.readFile(abs)), size: stat.size, executable: (stat.mode & 0o111) !== 0 });
      }
    }
  }
  await walk(IDE_ROOT, "");
  return out;
}

function remoteIgnored(rel: string): boolean {
  const parts = rel.split("/");
  return parts.some((part, i) => isNonSource(part, i < parts.length - 1));
}

function classify(local: string | null, remote: string | null, base: string | null) {
  if (local === remote) return null;
  const kind = (value: string | null, ref: string | null): SyncItem["local"] =>
    value === ref ? "same" : value === null ? "deleted" : ref === null ? "added" : "edited";
  const l = kind(local, base);
  const r = kind(remote, base);
  let state: SyncState;
  if (l === "same") state = "pull";
  else if (r === "same") state = "push";
  else state = "conflict";
  return { state, local: l, remote: r };
}

type Snapshot = {
  status: SyncStatus;
  headInfo: Awaited<ReturnType<typeof getBranchHead>>;
  local: Map<string, LocalFile>;
  remote: Map<string, { sha: string; mode: string; size: number }>;
  manifest: Manifest;
};

async function snapshot(cfg: GithubConfig): Promise<Snapshot> {
  const skipped: string[] = [];
  const [headInfo, local, manifest] = await Promise.all([getBranchHead(cfg), scanLocal(skipped), loadManifest()]);
  const remoteAll = await getTree(cfg, headInfo.treeSha);
  const remote = new Map([...remoteAll].filter(([p]) => !remoteIgnored(p)));

  const paths = new Set([...local.keys(), ...remote.keys()]);
  const items: SyncItem[] = [];
  let inSync = 0;
  let dirty = false;
  for (const p of [...paths].sort()) {
    const l = local.get(p)?.sha ?? null;
    const verdict = classify(l, remote.get(p)?.sha ?? null, manifest.files[p] ?? null);
    if (!verdict) {
      inSync++;
      // فایل هم‌خوان = نقطه‌ی مشترک؛ بدون ثبتش، اولین ویرایش بعدی اشتباهاً «تعارض» دیده می‌شود.
      if (l !== null && manifest.files[p] !== l) {
        manifest.files[p] = l;
        dirty = true;
      } else if (l === null) {
        if (p in manifest.files) {
          delete manifest.files[p];
          dirty = true;
        }
      }
    }
    else items.push({ path: p, ...verdict });
  }
  if (dirty) await saveManifest(manifest);
  return { status: { branch: cfg.branch, head: headInfo.commitSha, inSync, items, skipped }, headInfo, local, remote, manifest };
}

export function getSyncStatus(cfg: GithubConfig): Promise<SyncStatus> {
  return snapshot(cfg).then((s) => s.status);
}

function selectItems(items: SyncItem[], allowed: SyncState, requested?: string[]): SyncItem[] {
  if (!requested) return items.filter((i) => i.state === allowed);
  const wanted = new Set(requested.map(normalizeRelPath));
  const chosen = items.filter((i) => wanted.has(i.path) && (i.state === allowed || i.state === "conflict"));
  if (chosen.length !== wanted.size) throw new IdeError("وضعیت فایل‌ها عوض شده است؛ وضعیت را دوباره بگیر.", 409);
  return chosen;
}

/** تغییرات سرور را در یک کامیت روی گیت‌هاب می‌فرستد. conflict فقط با انتخاب صریح مسیر ارسال می‌شود. */
export function pushChanges(cfg: GithubConfig, message: string, requested?: string[]) {
  return exclusive(async () => {
    const snap = await snapshot(cfg);
    const chosen = selectItems(snap.status.items, "push", requested);
    if (chosen.length === 0) throw new IdeError("چیزی برای ارسال به گیت‌هاب نیست.", 400);

    let total = 0;
    const changes = [];
    for (const item of chosen) {
      const info = snap.local.get(item.path);
      if (!info) {
        changes.push({ path: item.path, content: null });
        continue;
      }
      const { abs } = await resolveSafe(item.path);
      total += info.size;
      changes.push({ path: item.path, content: await fs.readFile(abs), mode: info.executable ? "100755" : "100644" });
    }
    if (total > SYNC_MAX_PUSH_BYTES) throw new IdeError("حجم تغییرات برای یک ارسال بیش از حد است.", 413);

    const commit = await createCommit(cfg, snap.headInfo, changes, message);
    const manifest = snap.manifest;
    for (const item of chosen) {
      const info = snap.local.get(item.path);
      if (info) manifest.files[item.path] = info.sha;
      else delete manifest.files[item.path];
    }
    for (const [p, info] of snap.local) if (snap.remote.get(p)?.sha === info.sha) manifest.files[p] = info.sha;
    await saveManifest(manifest);
    return { commit, count: chosen.length };
  });
}

/** تغییرات گیت‌هاب را روی سرور اعمال می‌کند (با بکاپ نسخه‌ی قبلی). conflict فقط با انتخاب صریح. */
export function pullChanges(cfg: GithubConfig, requested?: string[]) {
  return exclusive(async () => {
    const snap = await snapshot(cfg);
    const chosen = selectItems(snap.status.items, "pull", requested);
    if (chosen.length === 0) throw new IdeError("چیزی برای دریافت از گیت‌هاب نیست.", 400);
    if (chosen.length > SYNC_MAX_PULL_FILES) throw new IdeError(`در هر دریافت حداکثر ${SYNC_MAX_PULL_FILES} فایل مجاز است.`, 413);

    // اول همه‌ی بلاب‌ها را بگیر؛ اگر شبکه قطع شود هیچ فایلی نیمه‌کاره عوض نشده است.
    const fetched = new Map<string, Buffer>();
    for (const item of chosen) {
      const entry = snap.remote.get(item.path);
      if (!entry) continue;
      const content = await getBlob(cfg, entry.sha);
      if (content.length > MAX_WRITE_BYTES) throw new IdeError(`فایل ${item.path} بزرگ‌تر از ۲ مگابایت است.`, 413);
      if (gitBlobSha(content) !== entry.sha) throw new IdeError("فایل دریافتی با هش گیت‌هاب نمی‌خواند.", 502);
      fetched.set(item.path, content);
    }

    const manifest = snap.manifest;
    for (const item of chosen) {
      const { rel, abs } = await resolveSafe(item.path);
      await backupCurrent(rel, abs);
      const entry = snap.remote.get(item.path);
      if (!entry) {
        await fs.unlink(abs).catch(() => undefined);
        delete manifest.files[item.path];
      } else {
        await atomicWrite(abs, fetched.get(item.path)!, entry.mode === "100755" ? 0o755 : 0o644);
        manifest.files[item.path] = entry.sha;
      }
    }
    for (const [p, info] of snap.local) if (snap.remote.get(p)?.sha === info.sha) manifest.files[p] = info.sha;
    await saveManifest(manifest);
    return { count: chosen.length, head: snap.headInfo.commitSha };
  });
}
