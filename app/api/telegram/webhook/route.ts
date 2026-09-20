import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { sendMessage, downloadTelegramFile } from "@/lib/telegram";
import { type OrderStatus } from "@/lib/orderState";
import { markItemReadyAndAdvanceOrder, MAX_ITEM_FILE_BYTES } from "@/lib/delivery";
import { checkRateLimit } from "@/lib/rateLimit";
import { validateInput, telegramUpdateInput, ValidationError, type TelegramUpdateInput } from "@/lib/validation";

const ORDER_ID_PATTERN = /شماره سفارش:\s*(\S+)/;
const SUPPORT_USER_ID_PATTERN = /شناسه کاربر:\s*(\S+)/;
const LARGE_MARKER_PATTERN = /^\/large\b|بزرگ/i;
const ITEM_INDEX_PATTERN = /آیتم\s*(\d+)|\/item\s*(\d+)/i;

// این وب‌هوک از سمت تلگرام (بدون session کاربر) فراخوانی می‌شود؛ محدودیت نرخ روی هر چت
// جلوی سوءاستفاده/ارسال انبوه را می‌گیرد، جدا از احراز هویت با secret token.
const WEBHOOK_RATE_LIMIT = 30;
const WEBHOOK_RATE_WINDOW_MS = 60_000;

// POST /api/telegram/webhook
// دریافت آپدیت از تلگرام. فقط پیام‌های reply شده‌ی چت اپراتور یا چت پشتیبانی مجاز پذیرفته می‌شوند:
// - چت اپراتور: reply روی پیام سفارش با فایل (کوچک) یا دستور «/large» (بزرگ) آن آیتم را به ready می‌برد.
//   در سفارش چندآیتمی، شماره‌ی آیتم باید در متن/کپشن reply ذکر شود (مثلاً «آیتم 2»)؛ در سفارش
//   تک‌آیتمی نیازی به ذکر شماره نیست.
// - چت پشتیبانی: reply روی پیام اطلاع‌رسانی صندوق پشتیبانی، پیام پشتیبانی را برای همان کاربر ثبت می‌کند.
export async function POST(req: NextRequest) {
  if (!isFromOperatorWebhook(req)) {
    // توکن webhook نامعتبر: بدون افشای جزئیات، درخواست نادیده گرفته می‌شود.
    return NextResponse.json({ ok: true });
  }

  let input;
  try {
    const body = await req.json();
    input = validateInput(telegramUpdateInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true });
  }

  const message = input.message;
  if (!message) {
    return NextResponse.json({ ok: true });
  }

  const rateKey = `telegram-webhook:${message.chat.id}`;
  const limit = checkRateLimit(rateKey, WEBHOOK_RATE_LIMIT, WEBHOOK_RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json({ ok: true });
  }

  const supportChatId = process.env.TELEGRAM_CHAT_SUPPORT;
  if (supportChatId && String(message.chat.id) === supportChatId) {
    return handleSupportReply(message, supportChatId);
  }

  const operatorChatId = process.env.TELEGRAM_CHAT_OPERATOR;
  if (!operatorChatId || String(message.chat.id) !== operatorChatId) {
    // پیام از چتی غیر از اپراتور یا پشتیبانی مجاز؛ نادیده گرفته می‌شود.
    return NextResponse.json({ ok: true });
  }

  const replyText = message.reply_to_message?.text;
  const orderId = replyText ? ORDER_ID_PATTERN.exec(replyText)?.[1] : undefined;
  if (!orderId) {
    return NextResponse.json({ ok: true });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) {
    await sendMessage(operatorChatId, `⚠️ سفارش با شماره ${orderId} یافت نشد.`);
    return NextResponse.json({ ok: true });
  }
  if (order.items.length === 0) {
    await sendMessage(operatorChatId, `⚠️ سفارش ${orderId} بدون آیتم است.`);
    return NextResponse.json({ ok: true });
  }

  const markerText = `${message.text ?? ""} ${message.caption ?? ""}`;
  const item = resolveTargetItem(order.items, markerText);
  if (!item) {
    if (order.items.length === 1) {
      await sendMessage(operatorChatId, `⚠️ خطای داخلی در تشخیص آیتم سفارش ${orderId}.`);
    } else {
      const list = order.items.map((it, i) => `${i + 1}. ${it.productUrl}`).join("\n");
      await sendMessage(
        operatorChatId,
        `⚠️ این سفارش ${order.items.length} آیتم دارد؛ شماره‌ی آیتم را در reply بنویس (مثلاً «آیتم 2»):\n${list}`,
      );
    }
    return NextResponse.json({ ok: true });
  }

  const isLarge = LARGE_MARKER_PATTERN.test(markerText.trim());
  const actor = `operator:${operatorChatId}`;

  try {
    if (isLarge) {
      await prisma.$transaction(async (tx) => {
        await tx.delivery.upsert({
          where: { orderItemId: item.id },
          create: { orderItemId: item.id, isLarge: true },
          update: { isLarge: true, deliveredAt: new Date() },
        });
        await markItemReadyAndAdvanceOrder(tx, {
          orderId: order.id,
          orderItemId: item.id,
          fromOrderStatus: order.status as OrderStatus,
          actor,
          note: `تحویل فایل بزرگ آیتم ${item.id} از طریق بات تلگرام`,
        });
      });
      await sendMessage(operatorChatId, `✅ آیتم ${orderItemLabel(order.items, item.id)} سفارش ${orderId} به‌عنوان فایل بزرگ ثبت شد.`);
    } else if (message.document) {
      if ((message.document.file_size ?? 0) > MAX_ITEM_FILE_BYTES) {
        await sendMessage(
          operatorChatId,
          `⚠️ حجم فایل آیتم ${orderItemLabel(order.items, item.id)} سفارش ${orderId} بیش از ۲۰ مگابایت است؛ با دستور «بزرگ» علامت‌گذاری کن.`,
        );
        return NextResponse.json({ ok: true });
      }

      const buffer = await downloadTelegramFile(message.document.file_id, message.document.file_name);
      const storageKey = buildStorageKey(order.id, message.document.file_name);
      await fileStorage.save(storageKey, buffer);

      await prisma.$transaction(async (tx) => {
        const now = new Date();
        await tx.delivery.upsert({
          where: { orderItemId: item.id },
          create: {
            orderItemId: item.id,
            storageKey,
            fileName: message.document!.file_name ?? "file",
            mimeType: message.document!.mime_type ?? "application/octet-stream",
            fileSizeBytes: buffer.length,
            isLarge: false,
            telegramFileId: message.document!.file_id,
            isOnDisk: true,
            lastAccessedAt: now,
          },
          update: {
            storageKey,
            fileName: message.document!.file_name ?? "file",
            mimeType: message.document!.mime_type ?? "application/octet-stream",
            fileSizeBytes: buffer.length,
            isLarge: false,
            telegramFileId: message.document!.file_id,
            isOnDisk: true,
            lastAccessedAt: now,
            deliveredAt: now,
          },
        });
        await markItemReadyAndAdvanceOrder(tx, {
          orderId: order.id,
          orderItemId: item.id,
          fromOrderStatus: order.status as OrderStatus,
          actor,
          note: `تحویل فایل آیتم ${item.id} از طریق بات تلگرام`,
        });
      });
      await sendMessage(
        operatorChatId,
        `✅ فایل آیتم ${orderItemLabel(order.items, item.id)} سفارش ${orderId} ذخیره شد و آماده‌ی دانلود شد.`,
      );
    }
  } catch (error) {
    console.error(`[تلگرام وب‌هوک خطا] پردازش سفارش ${orderId} با خطا مواجه شد:`, error);
    await sendMessage(
      operatorChatId,
      `⚠️ ثبت تحویل سفارش ${orderId} با خطا مواجه شد: ${error instanceof Error ? error.message : "خطای نامشخص"}`,
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * آیتم مقصد را از روی متن/کپشن reply تشخیص می‌دهد: اگر سفارش تک‌آیتمی است همان یک آیتم؛
 * اگر چندآیتمی است، باید شماره‌ی آیتم (۱-پایه، هم‌ترتیب با شماره‌گذاری پیام اطلاع‌رسانی)
 * با الگوی «آیتم N» یا «/item N» در متن ذکر شده باشد. این تنها راه قابل‌اطمینان تشخیص
 * آیتم از طریق reply تلگرام است چون تلگرام چیزی فراتر از متن پیام reply‌شده در اختیار ما
 * نمی‌گذارد؛ شماره‌گذاری در notifyOrderCreated دقیقاً با ترتیب order.items (createdAt asc)
 * یکسان نگه داشته می‌شود تا این تطبیق درست بماند.
 */
function resolveTargetItem<T extends { id: string }>(items: T[], markerText: string): T | undefined {
  if (items.length === 1) {
    return items[0];
  }
  const match = ITEM_INDEX_PATTERN.exec(markerText);
  const indexStr = match?.[1] ?? match?.[2];
  if (!indexStr) {
    return undefined;
  }
  const index = Number(indexStr) - 1;
  return items[index];
}

function orderItemLabel(items: { id: string }[], itemId: string): string {
  const index = items.findIndex((i) => i.id === itemId);
  return index === -1 ? itemId : String(index + 1);
}

/** پیام reply در چت پشتیبانی را به یک SupportMessage برای کاربر مرجع تبدیل می‌کند. */
async function handleSupportReply(
  message: NonNullable<TelegramUpdateInput["message"]>,
  supportChatId: string,
): Promise<NextResponse> {
  const replyText = message.reply_to_message?.text;
  const userId = replyText ? SUPPORT_USER_ID_PATTERN.exec(replyText)?.[1] : undefined;
  if (!userId) {
    return NextResponse.json({ ok: true });
  }

  const text = message.text ?? message.caption;
  if (!text) {
    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    await sendMessage(supportChatId, `⚠️ کاربر با شناسه ${userId} یافت نشد.`);
    return NextResponse.json({ ok: true });
  }

  await prisma.supportMessage.create({
    data: { userId, sender: "support", text, readByUser: false },
  });

  return NextResponse.json({ ok: true });
}

function isFromOperatorWebhook(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) {
    // در محیط توسعه بدون secret تنظیم‌شده، بررسی رد نمی‌شود تا تست محلی ممکن باشد.
    return true;
  }
  const received = req.headers.get("x-telegram-bot-api-secret-token");
  return received === expected;
}

function buildStorageKey(orderId: string, fileName?: string): string {
  const ext = fileName?.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
  return `deliveries/${orderId}/${crypto.randomUUID()}${ext}`;
}
