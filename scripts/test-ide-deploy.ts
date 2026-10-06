// تست ماشین deploy (بدون دیتابیس): با npm/npx/pm2 جعلی روی PATH، اسکریپت ساخته و اجرا می‌شود.
// شکست tsc باید جلوی build و restart را بگیرد؛ دو deploy هم‌زمان رد می‌شود.
//   npx tsx scripts/test-ide-deploy.ts

import fs from "fs";
import os from "os";
import path from "path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ide-deploy-"));
const root = path.join(tmp, "project");
const bin = path.join(tmp, "bin");
fs.mkdirSync(root, { recursive: true });
fs.mkdirSync(bin, { recursive: true });
const calls = path.join(tmp, "calls.txt");

function fake(name: string, body: string) {
  fs.writeFileSync(path.join(bin, name), `#!/bin/bash\necho "${name} $@" >> "${calls}"\n${body}\n`, { mode: 0o755 });
}
fake("npm", "sleep 0.2");
fake("pm2", "true");
fake("npx", 'if [ "$1" = "tsc" ] && [ -f "' + path.join(tmp, "tsc-fail") + '" ]; then echo "type error!"; exit 2; fi');

process.env.PATH = `${bin}:${process.env.PATH}`;
process.env.IDE_ROOT = root;
process.env.IDE_BACKUP_DIR = path.join(tmp, "backups");
process.env.IDE_PM2_NAME = "getstock";

let passed = 0;
const failures: string[] = [];
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; console.log(`  ✅ ${label}`); }
  else { failures.push(label); console.log(`  ❌ ${label}`, detail ?? ""); }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const called = () => (fs.existsSync(calls) ? fs.readFileSync(calls, "utf8") : "");

async function waitDone(d: typeof import("../lib/ide/deploy"), id: string) {
  for (let i = 0; i < 100; i++) {
    const s = await d.getDeployStatus(id);
    if (s.state !== "running") return s;
    await sleep(100);
  }
  throw new Error("deploy تمام نشد");
}

async function main() {
  const d = await import("../lib/ide/deploy");

  console.log("— اسکریپت");
  const plain = d.buildDeployScript({ install: false, migrate: false });
  check("بدون install/migrate", !plain.includes("npm install") && !plain.includes("prisma") && plain.includes("npm run build") && plain.includes("pm2 restart getstock"));
  const full = d.buildDeployScript({ install: true, migrate: true });
  check("با install و migrate به ترتیب", full.indexOf("npm install") < full.indexOf("prisma migrate deploy") && full.indexOf("prisma migrate deploy") < full.indexOf("tsc") && full.indexOf("tsc") < full.indexOf("npm run build") && full.indexOf("npm run build") < full.indexOf("pm2 restart"));

  console.log("— اجرای موفق");
  const id = await d.startDeploy({ install: false, migrate: true });
  const second = await d.startDeploy({ install: false, migrate: false }).then(() => false, (e) => e.status === 409);
  check("deploy هم‌زمان رد شد", second);
  const ok = await waitDone(d, id);
  check("موفق", ok.state === "success", ok);
  const c = called();
  check("ترتیب دستورها", c.indexOf("prisma migrate deploy") < c.indexOf("tsc") && c.indexOf("tsc") < c.indexOf("run build") && c.indexOf("run build") < c.indexOf("pm2 restart getstock"), c);
  check("مارکر داخلی در لاگ نیست", !ok.log.includes("__IDE_DEPLOY_DONE__"));
  check("latestDeployId", (await d.latestDeployId()) === id);

  console.log("— شکست tsc جلوی build/restart را می‌گیرد");
  fs.writeFileSync(path.join(tmp, "tsc-fail"), "1");
  fs.rmSync(calls);
  const id2 = await d.startDeploy({ install: false, migrate: false });
  const bad = await waitDone(d, id2);
  check("وضعیت failed", bad.state === "failed", bad);
  check("خطا در لاگ", bad.log.includes("type error!"));
  check("build و restart اجرا نشد", !called().includes("run build") && !called().includes("pm2"), called());

  check("شناسه‌ی نامعتبر", await d.getDeployStatus("../../etc").then(() => false, () => true));

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${passed} گام موفق، ${failures.length} ناموفق`);
  if (failures.length) { console.log("ناموفق:", failures); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
