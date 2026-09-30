// تست یکپارچه‌ی ورود با ایمیل/رمز، OTP، بازیابی رمز و ادغام کاربران قدیمی — روی سرور dev واقعی (HTTP).
// پیامک‌ها در حالت شبیه‌سازی در کنسول سرور چاپ می‌شوند؛ این اسکریپت برای رسیدن به کد، ردیف OTP/بازیابی
// با مقدار معلوم را دقیقاً با همان هش سرور می‌سازد («پیامک رسید»).
// اجرا (سرور dev باید روشن باشد):
//   npx tsx --env-file=.env scripts/test-auth-flow.ts            → جریان‌ها و چک‌های امنیتی
//   npx tsx --env-file=.env scripts/test-auth-flow.ts ratelimit  → فقط rate limit (بعد از ری‌استارت سرور)

import crypto from "crypto";
import { prisma } from "../lib/db";
import { setSetting } from "../lib/settings";
import { requestPasswordReset, getResetMode, resetPasswordWithCode, resetPasswordWithToken } from "../lib/passwordReset";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const rand = () => Math.floor(1000000 + Math.random() * 8999999);

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? "✅" : "❌"} ${label}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!cond) failures++;
}

class Client {
  cookie = "";
  async call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(this.cookie && { cookie: this.cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    const match = setCookie && /mediajet_session=([^;]*)/.exec(setCookie);
    if (match) this.cookie = match[1] ? `mediajet_session=${match[1]}` : "";
    const text = await res.text();
    if (/\$2[aby]\$/.test(text)) throw new Error(`پاسخ ${path} شامل هش bcrypt است!`);
    return { status: res.status, data: text ? JSON.parse(text) : null };
  }
  post = (path: string, body?: unknown) => this.call("POST", path, body);
  me = async () => (await this.call("GET", "/api/auth/me")).data.user;
}

/** معادل رسیدن پیامک OTP: آخرین کد معتبر این شماره = code. */
async function plantOtp(mobile: string, code: string) {
  await prisma.otpCode.updateMany({ where: { mobile, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.otpCode.create({ data: { mobile, codeHash: sha256(`${mobile}:${code}`), expiresAt: new Date(Date.now() + 120_000) } });
}

/** معادل رسیدن پیامک بازیابی: یک درخواست بازیابی با توکن/کد معلوم. */
async function plantReset(userId: string, opts: { expired?: boolean } = {}) {
  const token = crypto.randomBytes(16).toString("base64url");
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  await prisma.passwordReset.create({
    data: {
      userId,
      tokenHash: sha256(token),
      codeHash: sha256(`reset:${userId}:${code}`),
      expiresAt: new Date(Date.now() + (opts.expired ? -1000 : 3_600_000)),
    },
  });
  return { token, code };
}

async function otpLogin(client: Client, mobile: string) {
  await plantOtp(mobile, "123456");
  return client.post("/api/auth/verify-otp", { mobile, code: "123456" });
}

async function flows() {
  const PASSWORD = "Passw0rd-" + rand();
  const mobile = "0939" + rand();
  const emailMixed = `Test.User${rand()}@Example.COM`;
  const email = emailMixed.toLowerCase();

  // ─── ثبت‌نام: موبایل → OTP → ایمیل/رمز ───
  const a = new Client();
  const otpReq = await a.post("/api/auth/request-otp", { mobile });
  check("ثبت‌نام: درخواست OTP", otpReq.status === 200, otpReq.status);
  const signup = await otpLogin(a, mobile);
  check("ثبت‌نام: تأیید OTP کاربر جدید می‌سازد و needsCredentials=true", signup.status === 200 && signup.data.needsCredentials === true && signup.data.user.hasPassword === false);
  check("ثبت‌نام: نشست ساخته شد", (await a.me())?.mobile === mobile);

  const weak = [
    [{ email, newPassword: "short1" }, "حداقل ۸"],
    [{ email, newPassword: "abcdefghij" }, "هم حرف و هم عدد"],
    [{ email, newPassword: "1234567890" }, "هم حرف و هم عدد"],
    [{ email, newPassword: "a1".repeat(40) }, "طولانی"],
    [{ email: "not-an-email", newPassword: PASSWORD }, "ایمیل معتبر نیست"],
  ] as const;
  for (const [body, expected] of weak) {
    const r = await a.post("/api/auth/credentials", body);
    check(`ولیدیشن رد شد: ${expected}`, r.status === 400 && String(r.data.error).includes(expected), r.data.error);
  }
  const anon = await new Client().post("/api/auth/credentials", { email, newPassword: PASSWORD });
  check("تنظیم رمز بدون نشست رد شد (401)", anon.status === 401);

  const setCred = await a.post("/api/auth/credentials", { email: emailMixed, newPassword: PASSWORD });
  check("ثبت‌نام: ایمیل/رمز ذخیره شد و ایمیل lowercase شد", setCred.status === 200 && setCred.data.user.email === email && setCred.data.user.hasPassword);
  const dbUser = await prisma.user.findUniqueOrThrow({ where: { mobile } });
  check(
    "رمز با bcrypt (cost 12) هش شده، نه خام",
    !!dbUser.passwordHash?.startsWith("$2") && dbUser.passwordHash.includes("$12$") && !dbUser.passwordHash.includes(PASSWORD),
  );

  const other = new Client();
  await otpLogin(other, "0938" + rand());
  const dup = await other.post("/api/auth/credentials", { email, newPassword: "Another1pass" });
  check("ایمیل تکراری برای حساب دیگر رد شد (409)", dup.status === 409, dup.data.error);

  // ─── ورود با ایمیل/رمز ───
  const b = new Client();
  const login = await b.post("/api/auth/login", { email: email.toUpperCase(), password: PASSWORD });
  check("ورود با ایمیل/رمز (بدون پیامک، ایمیل حساس به حروف نیست)", login.status === 200 && (await b.me())?.email === email);
  const wrongPw = await new Client().post("/api/auth/login", { email, password: PASSWORD + "x" });
  const noUser = await new Client().post("/api/auth/login", { email: `nobody${rand()}@example.com`, password: PASSWORD });
  check("رمز غلط → 401", wrongPw.status === 401);
  check("ایمیل ناموجود همان پیام رمز غلط را می‌گیرد (بدون افشای وجود حساب)", noUser.status === 401 && noUser.data.error === wrongPw.data.error, noUser.data.error);

  const t0 = Date.now();
  await new Client().post("/api/auth/login", { email: `nobody${rand()}@example.com`, password: PASSWORD });
  const tMissing = Date.now() - t0;
  const t1 = Date.now();
  await new Client().post("/api/auth/login", { email, password: PASSWORD + "y" });
  const tWrong = Date.now() - t1;
  check("زمان پاسخ ایمیل ناموجود ≈ رمز غلط (bcrypt روی هش ساختگی)", tMissing > 100 && Math.abs(tMissing - tWrong) < Math.max(tWrong, tMissing) * 0.6, { tMissing, tWrong });

  // ─── تغییر رمز: رمز فعلی الزامی، نشست‌های دیگر باطل ───
  const NEW_PASSWORD = "NewPassw0rd-" + rand();
  const noCurrent = await a.post("/api/auth/credentials", { email, newPassword: NEW_PASSWORD });
  const badCurrent = await a.post("/api/auth/credentials", { email, newPassword: NEW_PASSWORD, currentPassword: "wrong-1234" });
  check("تغییر رمز بدون رمز فعلی رد شد (403)", noCurrent.status === 403);
  check("تغییر رمز با رمز فعلی غلط رد شد (403)", badCurrent.status === 403);
  const change = await a.post("/api/auth/credentials", { email, newPassword: NEW_PASSWORD, currentPassword: PASSWORD });
  check("تغییر رمز با رمز فعلی درست", change.status === 200);
  check("بعد از تغییر رمز، نشست دستگاه دیگر باطل شد", (await b.me()) === null);
  check("نشست همین دستگاه باقی ماند", (await a.me())?.mobile === mobile);
  check("رمز قدیمی دیگر کار نمی‌کند", (await new Client().post("/api/auth/login", { email, password: PASSWORD })).status === 401);

  // ─── ورود با OTP هنوز کار می‌کند ───
  const c = new Client();
  const otpAgain = await otpLogin(c, mobile);
  check("ورود با OTP برای کاربر دارای رمز هم کار می‌کند (needsCredentials=false)", otpAgain.status === 200 && otpAgain.data.needsCredentials === false);

  // ─── ادغام کاربر قدیمی (فقط موبایل، مثل قبل از این تغییر) ───
  const legacyMobile = "0937" + rand();
  await prisma.user.create({ data: { mobile: legacyMobile, wallet: { create: { balanceRial: 0n } } } });
  const legacy = new Client();
  const legacyLogin = await otpLogin(legacy, legacyMobile);
  check("کاربر قدیمی با OTP وارد می‌شود (قفل نشده)", legacyLogin.status === 200);
  check("از کاربر قدیمی ایمیل/رمز خواسته می‌شود (needsCredentials=true)", legacyLogin.data.needsCredentials === true);
  const legacyEmail = `legacy${rand()}@example.com`;
  const legacySet = await legacy.post("/api/auth/credentials", { email: legacyEmail, newPassword: "Legacy1pass" });
  check("کاربر قدیمی ایمیل/رمز تنظیم کرد (بدون نیاز به رمز فعلی)", legacySet.status === 200);
  check("کاربر قدیمی حالا با ایمیل وارد می‌شود", (await new Client().post("/api/auth/login", { email: legacyEmail, password: "Legacy1pass" })).status === 200);

  // ─── درخواست بازیابی: پاسخ یکسان، بدون افشای حساب ───
  await setSetting("PASSWORD_RESET_SMS_MODE", "both", "test");
  const unknownMobile = "0936" + rand();
  const r1 = await new Client().post("/api/auth/password-reset/request", { mobile: unknownMobile });
  const r2 = await new Client().post("/api/auth/password-reset/request", { mobile });
  check("درخواست بازیابی برای شماره‌ی ناموجود و موجود پاسخ یکسان دارد", r1.status === 200 && JSON.stringify(r1.data) === JSON.stringify(r2.data), r1.data);
  check("حالت بازیابی از تنظیم خوانده شد (both)", r2.data.mode === "both");
  const userRow = await prisma.user.findUniqueOrThrow({ where: { mobile } });
  const resets = await prisma.passwordReset.findMany({ where: { userId: userRow.id } });
  check("برای شماره‌ی موجود درخواست ساخته شد (فقط هش ذخیره شد)", resets.length === 1 && /^[0-9a-f]{64}$/.test(resets[0].tokenHash) && /^[0-9a-f]{64}$/.test(resets[0].codeHash));
  check("انقضای درخواست ۱ ساعت است", Math.abs(resets[0].expiresAt.getTime() - resets[0].createdAt.getTime() - 3_600_000) < 2000);
  // از اینجا منطق تکراری مستقیم از lib صدا زده می‌شود تا سقف rate limit مسیرهای HTTP (که جدا تست می‌شود) پر نشود.
  await requestPasswordReset(mobile);
  check("درخواست دوباره در کمتر از ۶۰ ثانیه بی‌صدا نادیده گرفته شد (پیامک اضافه نرفت)", (await prisma.passwordReset.count({ where: { userId: userRow.id } })) === 1);
  await prisma.passwordReset.updateMany({ where: { userId: userRow.id }, data: { createdAt: new Date(Date.now() - 120_000) } });
  await requestPasswordReset(mobile);
  const afterSecond = await prisma.passwordReset.findMany({ where: { userId: userRow.id }, orderBy: { createdAt: "asc" } });
  check("درخواست جدید، درخواست قبلی را باطل کرد", afterSecond.length === 2 && afterSecond[0].usedAt !== null && afterSecond[1].usedAt === null);
  for (const mode of ["code", "link", "both"] as const) {
    await setSetting("PASSWORD_RESET_SMS_MODE", mode, "test");
    check(`حالت بازیابی قابل‌تنظیم است: ${mode}`, (await getResetMode()) === mode);
  }
  await setSetting("PASSWORD_RESET_SMS_MODE", "link", "test");
  const linkModeHttp = await new Client().post("/api/auth/password-reset/request", { mobile: "0935" + rand() });
  check("API هم حالت link را برمی‌گرداند (کلاینت فرم کد را نشان نمی‌دهد)", linkModeHttp.data.mode === "link");

  // ─── بازیابی با کد ───
  const beforeReset = new Client();
  await beforeReset.post("/api/auth/login", { email, password: NEW_PASSWORD });
  let { code } = await plantReset(userRow.id);
  const wrongCode = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) {
    await resetPasswordWithCode(mobile, wrongCode, "Reset1pass").catch(() => undefined);
  }
  const afterMax = await resetPasswordWithCode(mobile, code, "Reset1pass").then(() => "ok", (e: Error) => e.message);
  check("بعد از ۵ کد غلط، حتی کد درست هم باطل است", afterMax !== "ok", afterMax);

  ({ code } = await plantReset(userRow.id));
  const weakReset = await new Client().post("/api/auth/password-reset/confirm", { mobile, code, newPassword: "weak" });
  check("رمز ضعیف در بازیابی رد شد (کد مصرف نشد)", weakReset.status === 400);
  const RESET_PASSWORD = "ResetPassw0rd-" + rand();
  const d = new Client();
  const byCode = await d.post("/api/auth/password-reset/confirm", { mobile, code, newPassword: RESET_PASSWORD });
  check("بازیابی با کد موفق و کاربر وارد شد", byCode.status === 200 && (await d.me())?.mobile === mobile);
  check("بعد از بازیابی، همه‌ی نشست‌های قبلی باطل شدند", (await beforeReset.me()) === null && (await a.me()) === null);
  const reuseCode = await new Client().post("/api/auth/password-reset/confirm", { mobile, code, newPassword: "Another1pass" });
  check("کد بازیابی یک‌بارمصرف است", reuseCode.status === 422);
  check("ورود با رمز جدید", (await new Client().post("/api/auth/login", { email, password: RESET_PASSWORD })).status === 200);
  const wrongMobile = await resetPasswordWithCode(unknownMobile, code, "Another1pass").then(() => "ok", (e: Error) => e.message);
  check("کد برای شماره‌ی ناموجود همان پیام عمومی را می‌دهد", wrongMobile === reuseCode.data.error, wrongMobile);

  // ─── بازیابی با لینک ───
  const { token } = await plantReset(userRow.id);
  const badToken = await resetPasswordWithToken(crypto.randomBytes(16).toString("base64url"), "Link1pass").then(() => "ok", (e: Error) => e.message);
  check("توکن ساختگی رد شد", badToken !== "ok");
  const LINK_PASSWORD = "LinkPassw0rd-" + rand();
  const e = new Client();
  const byLink = await e.post("/api/auth/password-reset/confirm", { token, newPassword: LINK_PASSWORD });
  check("بازیابی با لینک موفق", byLink.status === 200 && (await e.me())?.mobile === mobile);
  check("لینک بازیابی یک‌بارمصرف است", (await new Client().post("/api/auth/password-reset/confirm", { token, newPassword: "Link2pass" })).status === 422);
  const { token: expiredToken } = await plantReset(userRow.id, { expired: true });
  const expired = await resetPasswordWithToken(expiredToken, "Link3pass").then(() => "ok", (e: Error) => e.message);
  check("لینک منقضی رد شد", expired !== "ok", expired);

  // دو درخواست هم‌زمان با یک توکن: فقط یکی موفق (مصرف اتمیک).
  const { token: raceToken } = await plantReset(userRow.id);
  const race = await Promise.allSettled([1, 2].map((n) => resetPasswordWithToken(raceToken, `Race${n}pass1`)));
  check("مصرف هم‌زمان یک توکن: دقیقاً یکی موفق", race.filter((r) => r.status === "fulfilled").length === 1, race.map((r) => r.status));

  // ─── کاربر قدیمی بدون ایمیل با بازیابی رمز: بعد از آن ایمیل ثبت می‌کند ───
  const legacy2Mobile = "0933" + rand();
  const legacy2 = await prisma.user.create({ data: { mobile: legacy2Mobile, wallet: { create: { balanceRial: 0n } } } });
  const { code: l2code } = await plantReset(legacy2.id);
  const f = new Client();
  const l2 = await f.post("/api/auth/password-reset/confirm", { mobile: legacy2Mobile, code: l2code, newPassword: "Legacy2pass" });
  check("کاربر قدیمی با بازیابی رمز گرفت (email=null، hasPassword=true)", l2.status === 200 && l2.data.user.email === null && l2.data.user.hasPassword);
  const l2email = await f.post("/api/auth/credentials", { email: `legacy2-${rand()}@example.com`, newPassword: "Legacy2pass", currentPassword: "Legacy2pass" });
  check("…و بعدش ایمیل ثبت کرد", l2email.status === 200 && !!l2email.data.user.email);

  await prisma.appSetting.deleteMany({ where: { key: "PASSWORD_RESET_SMS_MODE", updatedBy: "test" } });
}

async function rateLimits() {
  const email = `rl${rand()}@example.com`;
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    statuses.push((await new Client().post("/api/auth/login", { email, password: "Wrong1pass" })).status);
  }
  check("ورود: بعد از ۵ تلاش روی یک ایمیل → 429", statuses.slice(0, 5).every((s) => s === 401) && statuses[5] === 429, statuses);

  const ipStatuses: number[] = [];
  for (let i = 0; i < 5; i++) {
    ipStatuses.push((await new Client().post("/api/auth/login", { email: `rl-ip${i}-${rand()}@example.com`, password: "Wrong1pass" })).status);
  }
  check("ورود: سقف IP (۱۰ در ۱۵ دقیقه) با ایمیل‌های مختلف هم → 429", ipStatuses.slice(0, 4).every((s) => s === 401) && ipStatuses[4] === 429, ipStatuses);

  const mobile = "0932" + rand();
  const resetStatuses: number[] = [];
  for (let i = 0; i < 4; i++) {
    resetStatuses.push((await new Client().post("/api/auth/password-reset/request", { mobile })).status);
  }
  check("بازیابی: بعد از ۳ درخواست برای یک شماره → 429 (حتی شماره‌ی ناموجود)", resetStatuses.slice(0, 3).every((s) => s === 200) && resetStatuses[3] === 429, resetStatuses);

  const confirmStatuses: number[] = [];
  for (let i = 0; i < 11; i++) {
    confirmStatuses.push((await new Client().post("/api/auth/password-reset/confirm", { mobile, code: "000000", newPassword: "Guess1pass" })).status);
  }
  check("تأیید بازیابی: سقف IP → 429", confirmStatuses[10] === 429, confirmStatuses);
}

async function main() {
  try {
    if (process.argv[2] === "ratelimit") await rateLimits();
    else await flows();
  } finally {
    await prisma.$disconnect();
  }
  console.log(failures === 0 ? "\nهمه‌ی تست‌ها پاس شدند." : `\n${failures} تست شکست خورد.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
