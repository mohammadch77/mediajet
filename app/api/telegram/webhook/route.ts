import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { sendMessage, downloadTelegramFile } from "@/lib/telegram";
import { assertTransition, type OrderStatus } from "@/lib/orderState";
import { validateInput, telegramUpdateInput, ValidationError, type TelegramUpdateInput } from "@/lib/validation";

const MAX_SMALL_FILE_BYTES = 20 * 1024 * 1024; // ۲۰ مگابایت؛ سقف دانلود فایل از طریق بات تلگرام
const ORDER_ID_PATTERN = /شماره سفارش:\s*(\S+)/;
const SUPPORT_USER_ID_PATTERN = /شناسه کاربر:\s*(\S+)/;
const LARGE_MARKER_PATTERN = /^\/large\b|بزرگ/i;

// POST /api/telegram/webhook
// دریافت آپدیت از تلگرام. فقط پیام‌های reply شده‌ی چت اپراتور یا چت پشتیبانی مجاز پذیرفته می‌شوند:
// - چت اپراتور: reply روی پیام سفارش با فایل (کوچک) یا دستور «/large» (بزرگ) سفارش را به ready می‌برد.
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

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) {
    await sendMessage(operatorChatId, `⚠️ سفارش با شماره ${orderId} یافت نشد.`);
    return NextResponse.json({ ok: true });
  }
  // TODO(cart-ui): فعلاً فقط اولین آیتم سفارش از طریق بات تلگرام تحویل داده می‌شود.
  const item = order.items[0];
  if (!item) {
    await sendMessage(operatorChatId, `⚠️ سفارش ${orderId} بدون آیتم است.`);
    return NextResponse.json({ ok: true });
  }

  const markerText = `${message.text ?? ""} ${message.caption ?? ""}`;
  const isLarge = LARGE_MARKER_PATTERN.test(markerText.trim());

  try {
    if (isLarge) {
      await deliverLarge(order.id, item.id, order.status as OrderStatus, `operator:${operatorChatId}`);
      await sendMessage(operatorChatId, `✅ سفارش ${orderId} به‌عنوان فایل بزرگ ثبت شد.`);
    } else if (message.document) {
      if ((message.document.file_size ?? 0) > MAX_SMALL_FILE_BYTES) {
        await sendMessage(
          operatorChatId,
          `⚠️ حجم فایل سفارش ${orderId} بیش از ۲۰ مگابایت است؛ با دستور «بزرگ» علامت‌گذاری کن.`,
        );
        return NextResponse.json({ ok: true });
      }

      const buffer = await downloadTelegramFile(message.document.file_id, message.document.file_name);
      const storageKey = buildStorageKey(order.id, message.document.file_name);
      await fileStorage.save(storageKey, buffer);

      await deliverSmall(
        order.id,
        item.id,
        order.status as OrderStatus,
        `operator:${operatorChatId}`,
        {
          storageKey,
          fileName: message.document.file_name ?? "file",
          mimeType: message.document.mime_type ?? "application/octet-stream",
          fileSizeBytes: buffer.length,
          telegramFileId: message.document.file_id,
        },
      );
      await sendMessage(operatorChatId, `✅ فایل سفارش ${orderId} ذخیره شد و سفارش آماده‌ی دانلود شد.`);
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

/** سفارش را (در صورت نیاز از queued عبور از processing) به ready می‌برد؛ اگر از قبل ready/delivered باشد بی‌اثر است. */
async function advanceToReady(
  tx: Prisma.TransactionClient,
  orderId: string,
  orderItemId: string,
  fromStatus: OrderStatus,
  actor: string,
): Promise<void> {
  await tx.orderItem.update({ where: { id: orderItemId }, data: { status: "ready" } });

  let current = fromStatus;

  if (current === "ready" || current === "delivered") {
    return;
  }

  if (current === "queued") {
    assertTransition(current, "processing");
    await tx.order.update({ where: { id: orderId }, data: { status: "processing" } });
    await tx.orderEvent.create({
      data: {
        orderId,
        fromStatus: current,
        toStatus: "processing",
        actor: "system",
        note: "شروع پردازش خودکار پیش از تحویل فایل",
      },
    });
    current = "processing";
  }

  assertTransition(current, "ready");
  await tx.order.update({ where: { id: orderId }, data: { status: "ready" } });
  await tx.orderEvent.create({
    data: { orderId, fromStatus: current, toStatus: "ready", actor, note: "تحویل فایل از طریق بات تلگرام" },
  });
}

async function deliverSmall(
  orderId: string,
  orderItemId: string,
  fromStatus: OrderStatus,
  actor: string,
  file: {
    storageKey: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    telegramFileId: string;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await advanceToReady(tx, orderId, orderItemId, fromStatus, actor);
    const now = new Date();
    await tx.delivery.upsert({
      where: { orderItemId },
      create: {
        orderItemId,
        storageKey: file.storageKey,
        fileName: file.fileName,
        mimeType: file.mimeType,
        fileSizeBytes: file.fileSizeBytes,
        isLarge: false,
        telegramFileId: file.telegramFileId,
        isOnDisk: true,
        lastAccessedAt: now,
      },
      update: {
        storageKey: file.storageKey,
        fileName: file.fileName,
        mimeType: file.mimeType,
        fileSizeBytes: file.fileSizeBytes,
        isLarge: false,
        telegramFileId: file.telegramFileId,
        isOnDisk: true,
        lastAccessedAt: now,
        deliveredAt: now,
      },
    });
  });
}

async function deliverLarge(
  orderId: string,
  orderItemId: string,
  fromStatus: OrderStatus,
  actor: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await advanceToReady(tx, orderId, orderItemId, fromStatus, actor);
    await tx.delivery.upsert({
      where: { orderItemId },
      create: { orderItemId, isLarge: true },
      update: { isLarge: true, deliveredAt: new Date() },
    });
  });
}
