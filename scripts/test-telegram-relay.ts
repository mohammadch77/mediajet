// تست رله‌ی تلگرام (بدون اتصال واقعی به تلگرام، بدون نیاز به سرور dev):
// [۱] بدون TELEGRAM_API_BASE همه‌ی تماس‌ها به https://api.telegram.org می‌روند (رفتار قبلی).
// [۲] با TELEGRAM_API_BASE در .env، sendMessage / answerCallbackQuery / getFile / دانلود فایل همه به رله
//     (یک سرور HTTP محلی که نقش Worker را بازی می‌کند) می‌روند، با X-Relay-Secret و ساختار مسیر حفظ‌شده.
// [۳] مقدار پنل ادمین (دیتابیس) بر .env اولویت دارد و بدون ری‌استارت اثر می‌کند؛ با حذفش به .env برمی‌گردد.
// [۴] خود Worker (telegram-relay/src/index.js): احراز هویت، محدودیت مسیر، فوروارد عین درخواست، عدم نشت secret.
// اجرا: npx tsx --env-file=.env scripts/test-telegram-relay.ts

import http from "http";
import type { AddressInfo } from "net";
import { prisma } from "../lib/db";
import { getSetting, setSetting, deleteSetting } from "../lib/settings";
import { sendMessage, answerCallbackQuery, downloadTelegramFile } from "../lib/telegram";
import { check, run } from "./testUtils";
import worker from "../telegram-relay/src/index.js";

const TOKEN = "123456:TEST-relay_token";
const FILE_BYTES = Buffer.from("relay-file-content");

type Hit = { method: string; url: string; secret: string | undefined; body: string };

function startFakeRelay(): Promise<{ base: string; hits: Hit[]; close: () => void }> {
  const hits: Hit[] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      hits.push({ method: req.method!, url: req.url!, secret: req.headers["x-relay-secret"] as string | undefined, body });
      if (req.url!.startsWith(`/file/bot${TOKEN}/`)) {
        res.writeHead(200, { "Content-Type": "application/octet-stream" });
        res.end(FILE_BYTES);
      } else if (req.url!.includes("/getFile")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, result: { file_path: "documents/file_7.zip" } }));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, result: true }));
      }
    });
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({ base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, hits, close: () => server.close() }),
    ),
  );
}

const KEYS = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_API_BASE", "TELEGRAM_RELAY_SECRET"] as const;

run(async () => {
  // تنظیمات پنل این کلیدها روی env اولویت دارند؛ اگر ادمین مقداری ذخیره کرده، تست دست به آن نمی‌زند.
  for (const key of KEYS) {
    if (await getSetting(key)) {
      throw new Error(`${key} در پنل ادمین تنظیم شده؛ این تست فقط وقتی اجرا می‌شود که این کلیدها در پنل خالی باشند.`);
    }
  }
  const savedEnv = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  const realFetch = globalThis.fetch;
  const admin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });

  try {
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;

    // [۱] اتصال مستقیم
    delete process.env.TELEGRAM_API_BASE;
    delete process.env.TELEGRAM_RELAY_SECRET;
    const directCalls: { url: string; secret: string | null }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      directCalls.push({ url: String(input), secret: new Headers(init?.headers).get("X-Relay-Secret") });
      return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
    }) as typeof fetch;
    await sendMessage("42", "direct");
    globalThis.fetch = realFetch;
    check(
      "[۱] بدون TELEGRAM_API_BASE → https://api.telegram.org/bot<token>/sendMessage بدون هدر رله",
      directCalls.length === 1 && directCalls[0].url === `https://api.telegram.org/bot${TOKEN}/sendMessage` && directCalls[0].secret === null,
      directCalls.map((c) => c.url.replace(TOKEN, "<token>")),
    );

    // [۲] رله از .env
    const relayEnv = await startFakeRelay();
    process.env.TELEGRAM_API_BASE = relayEnv.base + "/";
    process.env.TELEGRAM_RELAY_SECRET = "env-secret";
    await sendMessage("42", "via relay");
    await answerCallbackQuery("cbq-1", "ok");
    const bytes = await downloadTelegramFile("FILE_ID_7", "a.zip");
    relayEnv.close();
    const paths = relayEnv.hits.map((h) => h.url);
    check(
      "[۲] چهار تماس به رله با مسیرهای /bot<token>/... و /file/bot<token>/...",
      JSON.stringify(paths) ===
        JSON.stringify([
          `/bot${TOKEN}/sendMessage`,
          `/bot${TOKEN}/answerCallbackQuery`,
          `/bot${TOKEN}/getFile?file_id=FILE_ID_7`,
          `/file/bot${TOKEN}/documents/file_7.zip`,
        ]),
      paths.map((p) => p.replace(TOKEN, "<token>")),
    );
    check("[۲] همه‌ی تماس‌ها هدر X-Relay-Secret دارند", relayEnv.hits.every((h) => h.secret === "env-secret"));
    check("[۲] body پیام دست‌نخورده فوروارد شد", JSON.parse(relayEnv.hits[0].body).text === "via relay");
    check("[۲] فایل دانلودشده از رله همان محتواست", bytes.equals(FILE_BYTES));

    // [۳] پنل ادمین بر env اولویت دارد و بدون ری‌استارت اثر می‌کند
    if (!admin) {
      check("[۳] کاربر ادمین برای ثبت تنظیم پنل وجود دارد", false);
    } else {
      const relayPanel = await startFakeRelay();
      await setSetting("TELEGRAM_API_BASE", relayPanel.base, admin.id);
      await setSetting("TELEGRAM_RELAY_SECRET", "panel-secret", admin.id);
      await sendMessage("42", "panel");
      check(
        "[۳] مقدار پنل جایگزین .env شد (بدون ری‌استارت)",
        relayPanel.hits.length === 1 && relayPanel.hits[0].secret === "panel-secret",
        relayPanel.hits.map((h) => h.secret),
      );
      await deleteSetting("TELEGRAM_API_BASE");
      await deleteSetting("TELEGRAM_RELAY_SECRET");
      relayPanel.close();

      const relayBack = await startFakeRelay();
      process.env.TELEGRAM_API_BASE = relayBack.base;
      await sendMessage("42", "back to env");
      relayBack.close();
      check("[۳] بعد از حذف مقدار پنل، دوباره .env استفاده می‌شود", relayBack.hits.length === 1 && relayBack.hits[0].secret === "env-secret");
    }

    // [۴] خود Worker
    const subtle = crypto.subtle as SubtleCrypto & { timingSafeEqual?: (a: ArrayBuffer, b: ArrayBuffer) => boolean };
    if (!subtle.timingSafeEqual) {
      // فقط در Workers runtime وجود دارد؛ برای اجرای Node یک معادل ساده.
      subtle.timingSafeEqual = (a, b) => Buffer.from(a).equals(Buffer.from(b));
    }
    const env = { RELAY_SECRET: "worker-secret" };
    const upstream: { url: string; method: string; headers: Headers; body: string }[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body ? await new Response(init.body).text() : "";
      upstream.push({ url: String(input), method: init?.method ?? "GET", headers: new Headers(init?.headers), body });
      return new Response("upstream-body", { status: 200, headers: { "Content-Type": "text/plain" } });
    }) as typeof fetch;
    const W = "https://relay.example.workers.dev";
    const send = (path: string, init: RequestInit = {}) => worker.fetch(new Request(W + path, init), env) as Promise<Response>;

    const noSecret = await send(`/bot${TOKEN}/getMe`);
    const wrongSecret = await send(`/bot${TOKEN}/getMe`, { headers: { "X-Relay-Secret": "nope" } });
    const badPath = await send(`/admin`, { headers: { "X-Relay-Secret": "worker-secret" } });
    check("[۴] بدون secret → 401، secret اشتباه → 401، مسیر غیرمجاز → 404", noSecret.status === 401 && wrongSecret.status === 401 && badPath.status === 404, [
      noSecret.status,
      wrongSecret.status,
      badPath.status,
    ]);
    check("[۴] درخواست‌های ردشده به تلگرام فوروارد نشدند", upstream.length === 0, upstream.length);

    const post = await send(`/bot${TOKEN}/sendMessage?x=1`, {
      method: "POST",
      headers: { "X-Relay-Secret": "worker-secret", "Content-Type": "application/json", "X-Forwarded-For": "1.2.3.4" },
      body: JSON.stringify({ chat_id: 1, text: "hi" }),
    });
    const fileRes = await send(`/file/bot${TOKEN}/documents/a.zip`, { headers: { "X-Relay-Secret": "worker-secret" } });
    globalThis.fetch = realFetch;

    check(
      "[۴] مسیر و query عیناً به api.telegram.org فوروارد شد (پیام و فایل)",
      upstream[0]?.url === `https://api.telegram.org/bot${TOKEN}/sendMessage?x=1` &&
        upstream[1]?.url === `https://api.telegram.org/file/bot${TOKEN}/documents/a.zip`,
      upstream.map((u) => u.url.replace(TOKEN, "<token>")),
    );
    check(
      "[۴] method، body و Content-Type حفظ شد",
      upstream[0]?.method === "POST" && upstream[0].body === '{"chat_id":1,"text":"hi"}' && upstream[0].headers.get("content-type") === "application/json",
    );
    check(
      "[۴] X-Relay-Secret و هدرهای کلاینت به تلگرام نشت نکردند",
      !upstream[0]?.headers.has("x-relay-secret") && !upstream[0]?.headers.has("x-forwarded-for"),
      [...(upstream[0]?.headers.keys() ?? [])],
    );
    check("[۴] پاسخ تلگرام عیناً برگشت", post.status === 200 && (await post.text()) === "upstream-body" && fileRes.status === 200);
  } finally {
    globalThis.fetch = realFetch;
    for (const key of KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    await deleteSetting("TELEGRAM_API_BASE");
    await deleteSetting("TELEGRAM_RELAY_SECRET");
  }
});
