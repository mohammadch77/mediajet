import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import {
  sendMessage,
  downloadTelegramFile,
  getTelegramConfig,
  answerCallbackQuery,
  sendSupportHistory,
  sendUserOrdersSummary,
  SUPPORT_CALLBACK,
} from "@/lib/telegram";
import { createSupportReply } from "@/lib/notifications";
import { formatOrderNumber, parseOrderNumber } from "@/lib/orderNumber";
import { type OrderStatus } from "@/lib/orderState";
import {
  markItemReadyAndAdvanceOrder,
  markItemLargeAndNotifyUser,
  MAX_ITEM_FILE_BYTES,
  DELIVERABLE_ORDER_STATUSES,
} from "@/lib/delivery";
import { toEnglishDigits, toPersianDigits } from "@/lib/money";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateInput, telegramUpdateInput, ValidationError, type TelegramUpdateInput } from "@/lib/validation";

type TelegramMessage = NonNullable<TelegramUpdateInput["message"]>;
type IncomingFile = { file_id: string; file_name?: string; mime_type?: string; file_size?: number };

const ORDER_ID_PATTERN = /شماره سفارش:\s*(\S+)/;
const SUPPORT_USER_ID_PATTERN = /شناسه کاربر:\s*(\S+)/;
const LARGE_MARKER_PATTERN = /^\/large\b|بزرگ/i;
// روی متنی اعمال می‌شود که قبلاً با toEnglishDigits نرمال شده؛ پس «آیتم ۲» هم مطابقت دارد.
const ITEM_INDEX_PATTERN = /آیتم\s*(\d+)|\/item\s*(\d+)/i;

// این وب‌هوک از سمت تلگرام (بدون session کاربر) فراخوانی می‌شود؛ محدودیت نرخ روی هر چت
// جلوی سوءاستفاده/ارسال انبوه را می‌گیرد، جدا از احراز هویت با secret token.
const WEBHOOK_RATE_LIMIT = 30;
const WEBHOOK_RATE_WINDOW_MS = 60_000;

const log = (msg: string) => console.log(`[تلگرام وب‌هوک] ${msg}`);

// POST /api/telegram/webhook
// دریافت آپدیت از تلگرام. فقط reply روی پیام‌های خود بات در چت‌های مجاز پذیرفته می‌شود.
// نوع reply از روی محتوای پیام reply‌شده تشخیص داده می‌شود (نه فقط شناسه‌ی چت)، تا وقتی چت
// اپراتور و پشتیبانی یکی است هم هر دو جریان کار کنند:
// - reply روی پیام سفارش («شماره سفارش: …») در چت اپراتور: فایل یا «بزرگ»/«/large» آیتم را ready می‌کند.
//   در سفارش چندآیتمی شماره‌ی آیتم باید ذکر شود («آیتم ۲» یا «آیتم 2»).
// - reply روی پیام صندوق پشتیبانی («شناسه کاربر: …») در چت پشتیبانی: پاسخ برای همان کاربر ثبت می‌شود.
export async function POST(req: NextRequest) {
  if (!(await isFromOperatorWebhook(req))) {
    log("secret token نامعتبر یا ناموجود؛ درخواست نادیده گرفته شد.");
    return ok();
  }

  let input;
  try {
    input = validateInput(telegramUpdateInput, await req.json());
  } catch (error) {
    log(`بدنه‌ی آپدیت نامعتبر: ${error instanceof ValidationError ? error.message : String(error)}`);
    return ok();
  }

  if (input.callback_query) {
    await handleCallbackQuery(input.callback_query);
    return ok();
  }

  const message = input.message;
  if (!message) {
    log("آپدیت بدون message (مثلاً edited_message)؛ نادیده گرفته شد.");
    return ok();
  }

  const chatId = String(message.chat.id);
  log(`پیام ${message.message_id} از چت ${chatId} | reply=${Boolean(message.reply_to_message)} | فایل=${Boolean(extractFile(message))}`);

  const limit = checkRateLimit(`telegram-webhook:${chatId}`, WEBHOOK_RATE_LIMIT, WEBHOOK_RATE_WINDOW_MS);
  if (!limit.allowed) {
    log(`محدودیت نرخ برای چت ${chatId}؛ نادیده گرفته شد.`);
    return ok();
  }

  const replied = message.reply_to_message;
  const repliedText = replied?.text ?? replied?.caption;
  if (!repliedText) {
    log("پیام reply نیست (یا پیام reply‌شده متن ندارد)؛ نادیده گرفته شد.");
    return ok();
  }

  const [operatorChatId, supportChatId] = await Promise.all([
    getTelegramConfig("TELEGRAM_CHAT_OPERATOR"),
    getTelegramConfig("TELEGRAM_CHAT_SUPPORT"),
  ]);

  const orderRef = ORDER_ID_PATTERN.exec(repliedText)?.[1];
  if (orderRef && chatId === operatorChatId) {
    await handleOrderReply(message, operatorChatId, orderRef);
    return ok();
  }

  const supportUserId = SUPPORT_USER_ID_PATTERN.exec(repliedText)?.[1];
  if (supportUserId && chatId === supportChatId) {
    await handleSupportReply(message, supportChatId, supportUserId);
    return ok();
  }

  log(`reply در چت ${chatId} با هیچ جریانی تطبیق نداشت (order=${orderRef ?? "-"}, userId=${supportUserId ?? "-"}, operatorChat=${operatorChatId ?? "-"}, supportChat=${supportChatId ?? "-"}).`);
  return ok();
}

/** دکمه‌های inline پیام پشتیبانی: «کل گفتگو» و «سفارش‌های کاربر». فقط از چت پشتیبانی پذیرفته می‌شود. */
async function handleCallbackQuery(query: NonNullable<TelegramUpdateInput["callback_query"]>): Promise<void> {
  const chatId = query.message ? String(query.message.chat.id) : null;
  const supportChatId = await getTelegramConfig("TELEGRAM_CHAT_SUPPORT");
  if (!chatId || chatId !== supportChatId) {
    log(`callback از چت غیرمجاز ${chatId ?? "-"}؛ نادیده گرفته شد.`);
    await answerCallbackQuery(query.id);
    return;
  }
  if (!checkRateLimit(`telegram-webhook:${chatId}`, WEBHOOK_RATE_LIMIT, WEBHOOK_RATE_WINDOW_MS).allowed) {
    await answerCallbackQuery(query.id, "تعداد درخواست‌ها زیاد است؛ کمی صبر کن.");
    return;
  }

  const [action, userId] = (query.data ?? "").split(":");
  await answerCallbackQuery(query.id);
  if (!userId) return;
  if (action === SUPPORT_CALLBACK.history) {
    await sendSupportHistory(chatId, userId);
  } else if (action === SUPPORT_CALLBACK.orders) {
    await sendUserOrdersSummary(chatId, userId);
  }
  log(`callback ${action} برای کاربر ${userId} پاسخ داده شد.`);
}

/** «MJ-1024» → جست‌وجو با orderNumber؛ پیام‌های قدیمی‌تر تلگرام هنوز id کامل دارند. */
function findOrderByRef(orderRef: string) {
  const orderNumber = parseOrderNumber(toEnglishDigits(orderRef));
  return prisma.order.findUnique({
    where: orderNumber !== null ? { orderNumber } : { id: orderRef },
    include: { items: { orderBy: { position: "asc" } } },
  });
}

async function handleOrderReply(message: TelegramMessage, operatorChatId: string, orderRef: string): Promise<void> {
  const order = await findOrderByRef(orderRef);
  if (!order) {
    log(`سفارش ${orderRef} یافت نشد.`);
    await sendMessage(operatorChatId, `⚠️ سفارش با شماره ${orderRef} یافت نشد.`);
    return;
  }
  const orderCode = formatOrderNumber(order.orderNumber);
  if (!DELIVERABLE_ORDER_STATUSES.includes(order.status as OrderStatus)) {
    log(`سفارش ${orderCode} در وضعیت ${order.status} است؛ تحویل ممکن نیست.`);
    await sendMessage(operatorChatId, `⚠️ سفارش ${orderCode} در وضعیت «${order.status}» است و تحویل آیتم برایش ممکن نیست.`);
    return;
  }

  const markerText = toEnglishDigits(`${message.text ?? ""} ${message.caption ?? ""}`).trim();
  const item = resolveTargetItem(order.items, markerText);
  if (!item) {
    log(`آیتم سفارش ${orderCode} از متن «${markerText}» تشخیص داده نشد (${order.items.length} آیتم).`);
    const list = order.items.map((it, i) => `${toPersianDigits(i + 1)}. ${it.productUrl}`).join("\n");
    await sendMessage(
      operatorChatId,
      [
        `⚠️ این سفارش ${toPersianDigits(order.items.length)} آیتم دارد؛ شماره‌ی آیتم را در متن یا کپشن reply بنویس (مثلاً «آیتم ۲»).`,
        `شماره سفارش: ${orderCode}`,
        list,
      ].join("\n"),
    );
    return;
  }

  const itemLabel = toPersianDigits(order.items.findIndex((i) => i.id === item.id) + 1);
  const file = extractFile(message);
  const tooBig = (file?.file_size ?? 0) > MAX_ITEM_FILE_BYTES;
  const isLarge = LARGE_MARKER_PATTERN.test(markerText) || tooBig;
  const actor = `operator:${operatorChatId}`;
  log(`سفارش ${orderCode} آیتم ${itemLabel} (${item.id}) | بزرگ=${isLarge} | حجم=${file?.file_size ?? "-"}`);

  try {
    if (isLarge) {
      await prisma.$transaction((tx) =>
        markItemLargeAndNotifyUser(tx, {
          orderId: order.id,
          orderItemId: item.id,
          itemLabel,
          fromOrderStatus: order.status as OrderStatus,
          actor,
          note: `تحویل فایل بزرگ آیتم ${item.id} از طریق بات تلگرام`,
        }),
      );
      log(`آیتم ${item.id} به‌عنوان فایل بزرگ ثبت شد.`);
      await sendMessage(
        operatorChatId,
        tooBig
          ? `✅ حجم فایل آیتم ${itemLabel} سفارش ${orderCode} بیش از ۲۰ مگابایت بود؛ به‌صورت خودکار «فایل بزرگ» ثبت شد و به کاربر در صندوق پشتیبانی اطلاع داده شد. لینک را از طریق پشتیبانی برایش بفرست.`
          : `✅ آیتم ${itemLabel} سفارش ${orderCode} به‌عنوان فایل بزرگ ثبت شد و به کاربر در صندوق پشتیبانی اطلاع داده شد.`,
      );
      return;
    }

    if (!file) {
      log("reply بدون فایل و بدون دستور «بزرگ»؛ راهنما برای اپراتور ارسال شد.");
      await sendMessage(
        operatorChatId,
        `⚠️ برای تحویل آیتم ${itemLabel} سفارش ${orderCode}، فایل را به‌صورت reply بفرست یا «بزرگ» بنویس.`,
      );
      return;
    }

    const buffer = await downloadTelegramFile(file.file_id, file.file_name);
    log(`فایل دانلود شد (${buffer.length} بایت).`);
    const storageKey = buildStorageKey(order.id, file.file_name);
    await fileStorage.save(storageKey, buffer);
    log(`فایل در ${storageKey} ذخیره شد.`);

    const fileData = {
      storageKey,
      fileName: file.file_name ?? "file",
      mimeType: file.mime_type ?? "application/octet-stream",
      fileSizeBytes: buffer.length,
      isLarge: false,
      telegramFileId: file.file_id,
      isOnDisk: true,
    };
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.delivery.upsert({
        where: { orderItemId: item.id },
        create: { orderItemId: item.id, ...fileData, lastAccessedAt: now },
        update: { ...fileData, fileUrl: null, lastAccessedAt: now, deliveredAt: now },
      });
      await markItemReadyAndAdvanceOrder(tx, {
        orderId: order.id,
        orderItemId: item.id,
        fromOrderStatus: order.status as OrderStatus,
        actor,
        note: `تحویل فایل آیتم ${item.id} از طریق بات تلگرام`,
      });
    });
    log(`آیتم ${item.id} ready شد.`);
    await sendMessage(operatorChatId, `✅ فایل آیتم ${itemLabel} سفارش ${orderCode} ذخیره شد و آماده‌ی دانلود است.`);
  } catch (error) {
    console.error(`[تلگرام وب‌هوک خطا] پردازش سفارش ${orderCode} با خطا مواجه شد:`, error);
    await sendMessage(
      operatorChatId,
      `⚠️ ثبت تحویل سفارش ${orderCode} با خطا مواجه شد: ${error instanceof Error ? error.message : "خطای نامشخص"}`,
    );
  }
}

/** تلگرام عکس/ویدیو/صدا را در فیلدهای جدا می‌فرستد؛ همه به یک شکل تبدیل می‌شوند. */
function extractFile(message: TelegramMessage): IncomingFile | undefined {
  if (message.document) return message.document;
  if (message.video) return { file_name: "video.mp4", ...message.video };
  if (message.audio) return { file_name: "audio.mp3", ...message.audio };
  if (message.animation) return { file_name: "animation.mp4", ...message.animation };
  if (message.photo?.length) {
    // تلگرام چند اندازه از یک عکس می‌فرستد؛ آخرین، بزرگ‌ترین است.
    const largest = message.photo[message.photo.length - 1];
    return { file_name: "photo.jpg", mime_type: "image/jpeg", ...largest };
  }
  return undefined;
}

/**
 * آیتم مقصد: در سفارش تک‌آیتمی همان یک آیتم؛ در چندآیتمی، شماره‌ی ۱-پایه با الگوی «آیتم N»
 * یا «/item N» که با ترتیب order.items (createdAt asc) در پیام notifyOrderCreated یکسان است.
 */
function resolveTargetItem<T extends { id: string }>(items: T[], markerText: string): T | undefined {
  if (items.length === 1) {
    return items[0];
  }
  const match = ITEM_INDEX_PATTERN.exec(markerText);
  const indexStr = match?.[1] ?? match?.[2];
  return indexStr ? items[Number(indexStr) - 1] : undefined;
}

async function handleSupportReply(message: TelegramMessage, supportChatId: string, userId: string): Promise<void> {
  const text = message.text ?? message.caption;
  if (!text) {
    log("پاسخ پشتیبانی بدون متن؛ نادیده گرفته شد.");
    await sendMessage(supportChatId, "⚠️ پاسخ پشتیبانی فعلاً فقط به‌صورت متن پذیرفته می‌شود.");
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    await sendMessage(supportChatId, `⚠️ کاربر با شناسه ${userId} یافت نشد.`);
    return;
  }

  await prisma.$transaction((tx) => createSupportReply(tx, { userId, text }));
  log(`پاسخ پشتیبانی برای کاربر ${userId} ثبت شد.`);
}

async function isFromOperatorWebhook(req: NextRequest): Promise<boolean> {
  const expected = await getTelegramConfig("TELEGRAM_WEBHOOK_SECRET");
  if (!expected) {
    // در محیط توسعه بدون secret تنظیم‌شده، بررسی رد نمی‌شود تا تست محلی ممکن باشد.
    return true;
  }
  const received = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function buildStorageKey(orderId: string, fileName?: string): string {
  const ext = fileName?.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
  return `deliveries/${orderId}/${crypto.randomUUID()}${ext}`;
}

function ok() {
  return NextResponse.json({ ok: true });
}
