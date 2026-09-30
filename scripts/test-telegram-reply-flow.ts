// شبیه‌سازی دقیق آپدیت‌های تلگرام روی هندلر وب‌هوک (بدون سرور dev)، با چت اپراتور/پشتیبانی/مالی یکسان.
// توکن بات خالی می‌شود تا ارسال/دانلود در حالت شبیه‌سازی باشد و هیچ درخواست واقعی به تلگرام نرود.
// اجرا: npx tsx --env-file=.env scripts/test-telegram-reply-flow.ts

import { NextRequest } from "next/server";
import { prisma } from "../lib/db";
import { formatOrderNumber } from "../lib/orderNumber";
import { LARGE_FILE_USER_HINT } from "../lib/delivery";

const CHAT = "8846909966";
const SECRET = "test-secret";
process.env.TELEGRAM_BOT_TOKEN = "";
process.env.TELEGRAM_CHAT_FINANCE = CHAT;
process.env.TELEGRAM_CHAT_OPERATOR = CHAT;
process.env.TELEGRAM_CHAT_SUPPORT = CHAT;
process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? "✅" : "❌"} ${label}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
  if (!cond) failures++;
}

let msgId = 1;
async function send(message: Record<string, unknown>, secret = SECRET) {
  const { POST } = await import("../app/api/telegram/webhook/route");
  const req = new NextRequest("http://localhost/api/telegram/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret },
    body: JSON.stringify({ update_id: msgId, message: { message_id: msgId++, chat: { id: Number(CHAT) }, ...message } }),
  });
  return POST(req);
}

const orderText = (ref: string) => `📦 سفارش جدید برای پردازش\nشماره سفارش: ${ref}\n۱. https://a\n۲. https://b`;
const codeOf = (o: { orderNumber: number }) => formatOrderNumber(o.orderNumber);

async function captureLogs(fn: () => Promise<void>): Promise<string> {
  const logs: string[] = [];
  const origLog = console.log;
  console.log = (...a: unknown[]) => { logs.push(a.join(" ")); };
  try {
    await fn();
  } finally {
    console.log = origLog;
  }
  return logs.join("\n");
}

async function createOrder(userId: string, urls: string[]) {
  const order = await prisma.order.create({
    data: { userId, totalPriceRial: 1_000_000n, paymentMethod: "wallet", status: "queued" },
  });
  for (const [position, url] of urls.entries()) {
    await prisma.orderItem.create({
      data: { orderId: order.id, position, sourceSite: "Freepik", category: "vector", productUrl: url, priceRial: 500_000n },
    });
  }
  return order;
}

const itemsOf = (orderId: string) =>
  prisma.orderItem.findMany({ where: { orderId }, orderBy: { position: "asc" }, include: { delivery: true } });

async function main() {
  const user = await prisma.user.create({
    data: { mobile: "0935" + Math.floor(1000000 + Math.random() * 8999999), name: "کاربر تست" },
  });

  try {
    // ۰. پیام سفارش به اپراتور باید کاربر را معرفی کند
    const single = await createOrder(user.id, ["https://freepik.com/a"]);
    const { notifyOrderCreated, notifySupportMessage } = await import("../lib/telegram");
    const opLogs = await captureLogs(async () => {
      notifyOrderCreated({ orderId: single.id, priceLabel: "۱۰۰ تومان", items: [{ productUrl: "https://freepik.com/a" }] });
      await new Promise((r) => setTimeout(r, 1000));
    });
    check("پیام اپراتور شامل نام و موبایل کاربر است", opLogs.includes(`کاربر: کاربر تست (${user.mobile})`));
    check("پیام اپراتور شماره‌ی کوتاه سفارش دارد", opLogs.includes(`شماره سفارش: ${codeOf(single)}`), codeOf(single));

    // ۱. secret نادرست → بی‌اثر
    await send({ document: { file_id: "x", file_name: "a.zip", file_size: 10 }, reply_to_message: { text: orderText(codeOf(single)) } }, "wrong");
    check("secret نادرست نادیده گرفته شد", (await itemsOf(single.id))[0].status === "pending");

    // ۲. سفارش تک‌آیتمی + فایل با کپشن «آیتم ۱» (ارقام فارسی) در چتی که هم اپراتور و هم پشتیبانی است
    await send({
      caption: "آیتم ۱",
      document: { file_id: "doc-1", file_name: "design.zip", mime_type: "application/zip", file_size: 1234 },
      reply_to_message: { text: orderText(codeOf(single)) },
    });
    const s = (await itemsOf(single.id))[0];
    check("آیتم تک‌آیتمی ready شد و فایل ذخیره شد", s.status === "ready" && !!s.delivery?.storageKey, s.status);
    check("وضعیت سفارش تک‌آیتمی ready شد", (await prisma.order.findUnique({ where: { id: single.id } }))?.status === "ready");
    const readyNotif = await prisma.notification.findFirst({ where: { userId: user.id, href: "/dashboard?tab=orders" } });
    check("اعلان «فایل آماده است» برای کاربر ساخته شد", !!readyNotif?.text.includes(codeOf(single)), readyNotif?.text);

    // ۲-ب. پیام‌های قدیمی تلگرام که id کامل دارند هم هنوز کار می‌کنند
    const legacy = await createOrder(user.id, ["https://legacy"]);
    await send({ document: { file_id: "doc-legacy", file_name: "l.zip", file_size: 10 }, reply_to_message: { text: orderText(legacy.id) } });
    check("reply روی پیام قدیمی (id کامل) هم کار کرد", (await itemsOf(legacy.id))[0].status === "ready");

    // ۳. سفارش دوآیتمی: عکس با کپشن «آیتم ۲»
    const multi = await createOrder(user.id, ["https://a", "https://b"]);
    await send({
      caption: "آیتم ۲",
      photo: [{ file_id: "p-small", file_size: 100 }, { file_id: "p-big", file_size: 5000 }],
      reply_to_message: { text: orderText(codeOf(multi)) },
    });
    let m = await itemsOf(multi.id);
    check("عکس با «آیتم ۲» روی آیتم دوم نشست", m[0].status === "pending" && m[1].status === "ready" && m[1].delivery?.telegramFileId === "p-big");

    // ۴. همان سفارش: «بزرگ آیتم ۱» → فایل بزرگ + پیام در صندوق پشتیبانی کاربر
    await send({ text: "بزرگ آیتم ۱", reply_to_message: { text: orderText(codeOf(multi)) } });
    m = await itemsOf(multi.id);
    check("آیتم ۱ به‌عنوان فایل بزرگ ready شد", m[0].status === "ready" && m[0].delivery?.isLarge === true);
    let supportMsgs = await prisma.supportMessage.findMany({ where: { userId: user.id } });
    check("پیام پشتیبانی برای فایل بزرگ ساخته شد", supportMsgs.length === 1, supportMsgs.map((x) => x.text));
    check("سفارش دوآیتمی پس از تحویل هر دو ready شد", (await prisma.order.findUnique({ where: { id: multi.id } }))?.status === "ready");

    // ۵. تکرار «بزرگ» پیام تکراری نمی‌سازد
    await send({ text: "بزرگ آیتم ۱", reply_to_message: { text: orderText(codeOf(multi)) } });
    supportMsgs = await prisma.supportMessage.findMany({ where: { userId: user.id } });
    check("علامت‌گذاری تکراری پیام تکراری نساخت", supportMsgs.length === 1);

    // ۶. فایل بالای ۲۰ مگ بدون دستور «بزرگ» → خودکار بزرگ
    const big = await createOrder(user.id, ["https://c"]);
    await send({
      document: { file_id: "huge", file_name: "huge.mp4", file_size: 25 * 1024 * 1024 },
      reply_to_message: { text: orderText(codeOf(big)) },
    });
    const b = (await itemsOf(big.id))[0];
    check("فایل ۲۵ مگ خودکار «بزرگ» ثبت شد", b.status === "ready" && b.delivery?.isLarge === true && !b.delivery?.storageKey);
    supportMsgs = await prisma.supportMessage.findMany({ where: { userId: user.id } });
    check("برای فایل ۲۵ مگ هم پیام پشتیبانی ساخته شد", supportMsgs.length === 2);
    const bigMsg = supportMsgs.find((x) => x.text.includes(codeOf(big)))?.text ?? "";
    check(
      "پیام فایل بزرگ شماره‌ی کوتاه و راهنمای «پیام‌ها» را دارد، بدون شناسه‌ی بلند یا آیدی تلگرام",
      bigMsg.includes(LARGE_FILE_USER_HINT) && !bigMsg.includes(big.id) && !bigMsg.includes("@"),
      bigMsg,
    );

    // ۷. پاسخ پشتیبانی در همان چت مشترک
    await send({ text: "سلام، لینک را فرستادیم.", reply_to_message: { text: `💬 پیام جدید از کاربر\nشناسه کاربر: ${user.id}\n\nسلام` } });
    const reply = await prisma.supportMessage.findFirst({ where: { userId: user.id, text: "سلام، لینک را فرستادیم." } });
    check("پاسخ پشتیبانی در چت مشترک برای کاربر ثبت شد", !!reply);
    const msgNotifs = await prisma.notification.count({ where: { userId: user.id, href: "/dashboard?tab=messages" } });
    check("برای پیام‌های پشتیبانی (۲ فایل بزرگ + ۱ پاسخ) اعلان ساخته شد", msgNotifs === 3, msgNotifs);

    // ۸. پیام جدید کاربر → پیام پشتیبانی با معرفی کاربر، گفتگوی اخیر و دکمه‌ها
    const userMsg = await prisma.supportMessage.create({
      data: { userId: user.id, sender: "user", text: "لینک <فایل> را نگرفتم", readByUser: true },
    });
    const supportLogs = await captureLogs(async () => {
      notifySupportMessage({ userId: user.id, messageId: userMsg.id, text: userMsg.text });
      await new Promise((r) => setTimeout(r, 1000));
    });
    check("پیام پشتیبانی نام و موبایل کاربر را دارد", supportLogs.includes(`کاربر تست (${user.mobile})`));
    check("پیام پشتیبانی گفتگوی اخیر را دارد", supportLogs.includes("گفتگوی اخیر") && supportLogs.includes("سلام، لینک را فرستادیم."));
    check("متن کاربر HTML-escape شده", supportLogs.includes("&lt;فایل&gt;"));
    check("خط شناسه‌ی کاربر برای reply حفظ شده", supportLogs.includes(`شناسه کاربر: <code>${user.id}</code>`));

    // ۹. دکمه‌های «کل گفتگو» و «سفارش‌های کاربر»
    const { POST } = await import("../app/api/telegram/webhook/route");
    const callback = (data: string, chatId = CHAT) =>
      captureLogs(async () => {
        await POST(
          new NextRequest("http://localhost/api/telegram/webhook", {
            method: "POST",
            headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": SECRET },
            body: JSON.stringify({ update_id: 999, callback_query: { id: "cb", data, message: { chat: { id: chatId } } } }),
          }),
        );
      });
    const histLogs = await callback(`hist:${user.id}`);
    check("دکمه‌ی «کل گفتگو» کل پیام‌ها را فرستاد", histLogs.includes("کل گفتگو با") && histLogs.includes("لینک &lt;فایل&gt; را نگرفتم"));
    const ordersLogs = await callback(`orders:${user.id}`);
    check("دکمه‌ی «سفارش‌های کاربر» شماره‌های کوتاه را فهرست کرد", ordersLogs.includes(codeOf(big)) && ordersLogs.includes(codeOf(single)));
    const foreign = await callback(`hist:${user.id}`, "123");
    check("دکمه از چت غیرمجاز نادیده گرفته شد", !foreign.includes("کل گفتگو با"));
  } finally {
    // OrderEvent append-only است (trigger دیتابیس)، پس داده‌ی تست پاک نمی‌شود؛ مثل بقیه‌ی اسکریپت‌های تست.
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? "\nهمه‌ی تست‌ها پاس شدند." : `\n${failures} تست شکست خورد.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
