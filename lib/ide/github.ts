// کلاینت کوچک GitHub REST برای همگام‌سازی کد (Git Data API: blob/tree/commit/ref).
// توکن فقط در هدر Authorization می‌رود؛ هرگز در پیام خطا، لاگ یا پاسخ نمی‌آید.

import { IdeError } from "./paths";

export type GithubConfig = { token: string; repo: string; branch: string; apiBase: string };
export type RemoteEntry = { sha: string; mode: string; size: number };
export type BranchHead = { commitSha: string; treeSha: string };
export type CommitChange = { path: string; content: Buffer | null; mode?: string };

const REQUEST_TIMEOUT_MS = 25_000;

export async function getGithubConfig(): Promise<GithubConfig> {
  // import تنبل: ماژول تنظیمات به DB وصل است و تست‌های مستقل به آن نیازی ندارند.
  const { getSetting } = await import("@/lib/settings");
  const [token, repo, branch] = await Promise.all([
    getSetting("GITHUB_TOKEN"),
    getSetting("GITHUB_REPO"),
    getSetting("GITHUB_BRANCH"),
  ]);
  if (!token || !repo) {
    throw new IdeError("همگام‌سازی گیت‌هاب تنظیم نشده است. در «تنظیمات ← گیت‌هاب» توکن و ریپو را وارد کن.", 400);
  }
  return buildConfig(token, repo.trim(), (branch ?? "").trim() || "master");
}

export function buildConfig(token: string, repo: string, branch: string, apiBase?: string): GithubConfig {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new IdeError("ریپو باید به شکل owner/name باشد.", 400);
  if (!/^[A-Za-z0-9_./-]{1,100}$/.test(branch) || branch.includes("..")) throw new IdeError("نام شاخه نامعتبر است.", 400);
  return { token, repo, branch, apiBase: apiBase ?? process.env.GITHUB_API_BASE ?? "https://api.github.com" };
}

async function gh<T>(cfg: GithubConfig, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${cfg.apiBase}/repos/${cfg.repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "getstock-ide",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new IdeError("ارتباط با گیت‌هاب برقرار نشد؛ چند لحظه‌ی دیگر دوباره تلاش کن.", 502);
  }
  if (res.status === 401) throw new IdeError("توکن گیت‌هاب نامعتبر یا منقضی است.", 502);
  if (res.status === 403) throw new IdeError("توکن گیت‌هاب دسترسی کافی ندارد (یا سقف درخواست پر شده است).", 502);
  if (res.status === 404) throw new IdeError("ریپو یا شاخه در گیت‌هاب پیدا نشد (نام ریپو/شاخه و دسترسی توکن را بررسی کن).", 502);
  if (res.status === 409 || res.status === 422) {
    throw new IdeError("گیت‌هاب تغییر را نپذیرفت؛ احتمالاً شاخه همین حالا تغییر کرده است. دوباره وضعیت را بگیر.", 409);
  }
  if (!res.ok) throw new IdeError(`خطای گیت‌هاب (${res.status}).`, 502);
  return (await res.json()) as T;
}

export async function getBranchHead(cfg: GithubConfig): Promise<BranchHead> {
  const json = await gh<{ commit: { sha: string; commit: { tree: { sha: string } } } }>(
    cfg,
    "GET",
    `/branches/${cfg.branch.split("/").map(encodeURIComponent).join("/")}`,
  );
  return { commitSha: json.commit.sha, treeSha: json.commit.commit.tree.sha };
}

export async function getTree(cfg: GithubConfig, treeSha: string): Promise<Map<string, RemoteEntry>> {
  const json = await gh<{ truncated: boolean; tree: { path: string; mode: string; type: string; sha: string; size?: number }[] }>(
    cfg,
    "GET",
    `/git/trees/${treeSha}?recursive=1`,
  );
  if (json.truncated) throw new IdeError("ریپو برای همگام‌سازی بیش از حد بزرگ است.", 413);
  const map = new Map<string, RemoteEntry>();
  for (const entry of json.tree) {
    if (entry.type === "blob") map.set(entry.path, { sha: entry.sha, mode: entry.mode, size: entry.size ?? 0 });
  }
  return map;
}

export async function getBlob(cfg: GithubConfig, sha: string): Promise<Buffer> {
  const json = await gh<{ content: string; encoding: string }>(cfg, "GET", `/git/blobs/${sha}`);
  if (json.encoding !== "base64") throw new IdeError("فرمت فایل گیت‌هاب پشتیبانی نمی‌شود.", 502);
  return Buffer.from(json.content, "base64");
}

/** یک کامیت اتمیک روی head فعلی می‌سازد و شاخه را جلو می‌برد (بدون force). */
export async function createCommit(cfg: GithubConfig, head: BranchHead, changes: CommitChange[], message: string): Promise<string> {
  const tree: { path: string; mode: string; type: "blob"; sha: string | null }[] = [];
  for (const change of changes) {
    if (change.content === null) {
      tree.push({ path: change.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    const blob = await gh<{ sha: string }>(cfg, "POST", "/git/blobs", {
      content: change.content.toString("base64"),
      encoding: "base64",
    });
    tree.push({ path: change.path, mode: change.mode ?? "100644", type: "blob", sha: blob.sha });
  }

  const newTree = await gh<{ sha: string }>(cfg, "POST", "/git/trees", { base_tree: head.treeSha, tree });
  const commit = await gh<{ sha: string }>(cfg, "POST", "/git/commits", {
    message,
    tree: newTree.sha,
    parents: [head.commitSha],
  });
  await gh(cfg, "PATCH", `/git/refs/heads/${cfg.branch.split("/").map(encodeURIComponent).join("/")}`, {
    sha: commit.sha,
    force: false,
  });
  return commit.sha;
}
