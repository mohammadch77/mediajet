// تست همگام‌سازی با یک سرور GitHub ساختگی (Git Data API) و پوشه‌ی موقت.
import http from "http";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { createHash } from "crypto";

const tmp = path.join(os.tmpdir(), `ide-sync-${process.pid}`);
process.env.IDE_ROOT = path.join(tmp, "root");
process.env.IDE_BACKUP_DIR = path.join(tmp, "backup");

let passed = 0;
function ok(cond: unknown, label: string) {
  if (!cond) { console.error("FAIL:", label); process.exit(1); }
  passed++;
  console.log("ok", passed, label);
}
const gsha = (b: Buffer) => createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex");

// ریموت ساختگی
const blobs = new Map<string, Buffer>();
let remoteFiles = new Map<string, string>(); // path → blob sha
let commitN = 1;
let treeFiles = new Map<string, Map<string, string>>();
let headCommit = "c1";
const trees = new Map<string, Map<string, string>>();
function putBlob(b: Buffer) { const s = gsha(b); blobs.set(s, b); return s; }
function setRemote(p: string, content: string) { remoteFiles.set(p, putBlob(Buffer.from(content))); }
function snapshotTree() { const id = `t${commitN}`; trees.set(id, new Map(remoteFiles)); return id; }
let headTree = "";

function readBody(req: http.IncomingMessage) {
  return new Promise<any>((res) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => res(d ? JSON.parse(d) : {})); });
}
const server = http.createServer(async (req, res) => {
  const url = req.url!.replace("/repos/o/r", "");
  const body = await readBody(req);
  const send = (code: number, obj: unknown) => { res.statusCode = code; res.setHeader("content-type", "application/json"); res.end(JSON.stringify(obj)); };
  if (req.headers.authorization !== "Bearer tok") return send(401, {});
  if (url.startsWith("/branches/")) return send(200, { commit: { sha: headCommit, commit: { tree: { sha: headTree } } } });
  if (url.startsWith("/git/trees/") && req.method === "GET") {
    const t = trees.get(url.split("/")[3].split("?")[0])!;
    return send(200, { truncated: false, tree: [...t].map(([p, sha]) => ({ path: p, mode: "100644", type: "blob", sha, size: blobs.get(sha)!.length })) });
  }
  if (url.startsWith("/git/blobs/") && req.method === "GET") return send(200, { encoding: "base64", content: blobs.get(url.split("/")[3])!.toString("base64") });
  if (url === "/git/blobs") return send(201, { sha: putBlob(Buffer.from(body.content, "base64")) });
  if (url === "/git/trees") {
    const next = new Map(trees.get(body.base_tree)!);
    for (const e of body.tree) { if (e.sha === null) next.delete(e.path); else next.set(e.path, e.sha); }
    const id = `t${++commitN}`; trees.set(id, next); return send(201, { sha: id });
  }
  if (url === "/git/commits") { if (body.parents[0] !== headCommit) return send(409, {}); (globalThis as any).pending = { tree: body.tree, msg: body.message }; return send(201, { sha: `c${commitN}` }); }
  if (url.startsWith("/git/refs/heads/")) {
    if (body.force !== false) return send(422, {});
    const p = (globalThis as any).pending; headCommit = body.sha; headTree = p.tree; remoteFiles = new Map(trees.get(p.tree)!); return send(200, {});
  }
  send(404, {});
});

async function main() {
  await fs.mkdir(path.join(process.env.IDE_ROOT!, "src"), { recursive: true });
  await fs.mkdir(process.env.IDE_BACKUP_DIR!, { recursive: true });
  const w = (p: string, c: string) => fs.writeFile(path.join(process.env.IDE_ROOT!, p), c);
  const r = (p: string) => fs.readFile(path.join(process.env.IDE_ROOT!, p), "utf8");
  await w("a.txt", "A1"); await w("src/b.ts", "B1"); await w(".env", "SECRET=1");
  setRemote("a.txt", "A1"); setRemote("src/b.ts", "B1"); setRemote(".env", "REMOTE_SECRET");
  headTree = snapshotTree();

  await new Promise<void>((r2) => server.listen(0, r2));
  const port = (server.address() as any).port;
  const { buildConfig } = await import("../lib/ide/github");
  const { getSyncStatus, pushChanges, pullChanges, gitBlobSha } = await import("../lib/ide/sync");
  const cfg = buildConfig("tok", "o/r", "master", `http://127.0.0.1:${port}`);

  ok(gitBlobSha(Buffer.from("hello\n")) === "ce013625030ba8dba906f756967f9e9ca394464a", "git blob sha مطابق git");

  let st = await getSyncStatus(cfg);
  ok(st.items.length === 0 && st.inSync === 2, "اول: همه هم‌خوان، .env نادیده");

  await w("a.txt", "A2"); await w("src/new.ts", "N1"); await fs.unlink(path.join(process.env.IDE_ROOT!, "src/b.ts"));
  st = await getSyncStatus(cfg);
  ok(st.items.length === 3 && st.items.every((i) => i.state === "push"), "سه تغییر محلی = push");

  let res = await pushChanges(cfg, "test push");
  ok(res.count === 3, "push سه فایل");
  ok(remoteFiles.get("a.txt") === gsha(Buffer.from("A2")) && !remoteFiles.has("src/b.ts") && remoteFiles.has("src/new.ts"), "ریموت به‌روز شد (ویرایش/حذف/جدید)");
  ok(remoteFiles.has(".env"), ".env ریموت دست‌نخورده");
  st = await getSyncStatus(cfg);
  ok(st.items.length === 0, "بعد از push هم‌خوان");

  // تغییر در ریموت → pull
  setRemote("a.txt", "A3"); setRemote("src/c.ts", "C1"); remoteFiles.delete("src/new.ts");
  headCommit = "c9"; headTree = snapshotTree();
  st = await getSyncStatus(cfg);
  ok(st.items.length === 3 && st.items.every((i) => i.state === "pull"), "سه تغییر ریموت = pull");
  res = await pullChanges(cfg);
  ok(res.count === 3 && (await r("a.txt")) === "A3" && (await r("src/c.ts")) === "C1", "pull اعمال شد");
  ok(!(await fs.stat(path.join(process.env.IDE_ROOT!, "src/new.ts")).then(() => true, () => false)), "حذف ریموت محلی شد");
  ok((await r(".env")) === "SECRET=1", ".env محلی دست‌نخورده");

  // conflict
  await w("a.txt", "LOCAL");
  setRemote("a.txt", "REMOTE"); headCommit = "c10"; headTree = snapshotTree();
  st = await getSyncStatus(cfg);
  ok(st.items.length === 1 && st.items[0].state === "conflict", "تعارض تشخیص داده شد");
  let blocked = false;
  try { await pullChanges(cfg); } catch { blocked = true; }
  ok(blocked, "pull بدون انتخاب صریح روی conflict چیزی ندارد");
  ok((await r("a.txt")) === "LOCAL", "فایل محلی در تعارض دست‌نخورده");
  await pullChanges(cfg, ["a.txt"]);
  ok((await r("a.txt")) === "REMOTE", "انتخاب ریموت اعمال شد");
  const bak = await fs.readdir(path.join(process.env.IDE_BACKUP_DIR!, "files", "a.txt")).catch(() => []);
  ok(bak.length >= 1, "نسخه‌ی قبلی فایل قبل از بازنویسی بکاپ شد");

  // push conflict با انتخاب محلی
  await w("a.txt", "LOCAL2"); setRemote("a.txt", "REMOTE2"); headCommit = "c11"; headTree = snapshotTree();
  await pushChanges(cfg, "force local", ["a.txt"]);
  ok(remoteFiles.get("a.txt") === gsha(Buffer.from("LOCAL2")), "انتخاب سرور روی ریموت اعمال شد");

  // مسیر مخرب
  let bad = false;
  try { await pullChanges(cfg, ["../etc/passwd"]); } catch { bad = true; }
  ok(bad, "مسیر مخرب رد شد");

  // توکن اشتباه
  let unauth = false;
  try { await getSyncStatus(buildConfig("bad", "o/r", "master", `http://127.0.0.1:${port}`)); } catch (e) { unauth = !String((e as Error).message).includes("bad"); }
  ok(unauth, "توکن نامعتبر خطای فارسی بدون نشت توکن");

  console.log(`\nهمه ${passed} مرحله موفق`);
  server.close();
  await fs.rm(tmp, { recursive: true, force: true });
}
main().catch((e) => { console.error(e); process.exit(1); });
