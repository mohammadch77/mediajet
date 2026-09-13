import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { sendMessage } from "@/lib/telegram";
import { assertTransition, type OrderStatus } from "@/lib/orderState";
import { validateInput, telegramUpdateInput, ValidationError } from "@/lib/validation";

const MAX_SMALL_FILE_BYTES = 20 * 1024 * 1024; // ۲۰ مگابایت؛ سقف دانلود فایل از طریق بات تلگرام
const ORDER_ID_PATTERN = /شماره سفارش:\s*(\S+)/;
const LARGE_MARKER_PATTERN = /^\/large\b|بزرگ/i;

// POST /api/telegram/webhook
// دریافت آپدیت از تلگرام. فقط پیام‌های reply شده‌ی چت اپراتور مجاز پذیرفته می‌شوند:
// - اگر پیام reply شامل فایل (document) باشد و علامت «بزرگ» نداشته باشد → فایل کوچک،
//   دانلود و در storage ذخیره می‌شود و سفارش به ready می‌رود.
// - اگر متن/کپشن reply شامل دستور «/large» یا کلمه‌ی «بزرگ» باشد → فایل بزرگ،
//   بدون ذخیره‌ی فایل، سفارش به ready می‌رود و پنل کاربر پیام پشتیبانی نشان می‌دهد.
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

  const operatorChatId = process.env.TELEGRAM_CHAT_OPERATOR;
  if (!operatorChatId || String(message.chat.id) !== operatorChatId) {
    // پیام از چتی غیر از اپراتور مجاز؛ نادیده گرفته می‌شود.
    return NextResponse.json({ ok: true });
  }

  const replyText = message.reply_to_message?.text;
  const orderId = replyText ? ORDER_ID_PATTERN.exec(replyText)?.[1] : undefined;
  if (!orderId) {
    return NextResponse.json({ ok: true });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    await sendMessage(operatorChatId, `⚠️ سفارش با شماره ${orderId} یافت نشد.`);
    return NextResponse.json({ ok: true });
  }

  const markerText = `${message.text ?? ""} ${message.caption ?? ""}`;
  const isLarge = LARGE_MARKER_PATTERN.test(markerText.trim());

  try {
    if (isLarge) {
      await deliverLarge(order.id, order.status as OrderStatus, `operator:${operatorChatId}`);
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
        order.status as OrderStatus,
        `operator:${operatorChatId}`,
        {
          storageKey,
          fileName: message.document.file_name ?? "file",
          mimeType: message.document.mime_type ?? "application/octet-stream",
          fileSizeBytes: buffer.length,
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

/** فایل را از تلگرام دانلود می‌کند. بدون TELEGRAM_BOT_TOKEN (حالت شبیه‌سازی)، محتوای جعلی تولید می‌شود. */
async function downloadTelegramFile(fileId: string, fileName?: string): Promise<Buffer> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log(`[تلگرام شبیه‌سازی] دانلود فایل ${fileName ?? fileId} به‌صورت شبیه‌سازی انجام شد.`);
    return Buffer.from(`simulated-file-content:${fileId}:${fileName ?? ""}`);
  }

  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  if (!infoRes.ok) {
    throw new Error("دریافت اطلاعات فایل از تلگرام ناموفق بود.");
  }
  const info = await infoRes.json();
  const filePath = info?.result?.file_path;
  if (!filePath) {
    throw new Error("مسیر فایل در پاسخ تلگرام یافت نشد.");
  }

  const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!fileRes.ok) {
    throw new Error("دانلود فایل از تلگرام ناموفق بود.");
  }
  return Buffer.from(await fileRes.arrayBuffer());
}

/** سفارش را (در صورت نیاز از queued عبور از processing) به ready می‌برد؛ اگر از قبل ready/delivered باشد بی‌اثر است. */
async function advanceToReady(
  tx: Prisma.TransactionClient,
  orderId: string,
  fromStatus: OrderStatus,
  actor: string,
): Promise<void> {
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
  fromStatus: OrderStatus,
  actor: string,
  file: { storageKey: string; fileName: string; mimeType: string; fileSizeBytes: number },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await advanceToReady(tx, orderId, fromStatus, actor);
    await tx.delivery.upsert({
      where: { orderId },
      create: {
        orderId,
        storageKey: file.storageKey,
        fileName: file.fileName,
        mimeType: file.mimeType,
        fileSizeBytes: file.fileSizeBytes,
        isLarge: false,
      },
      update: {
        storageKey: file.storageKey,
        fileName: file.fileName,
        mimeType: file.mimeType,
        fileSizeBytes: file.fileSizeBytes,
        isLarge: false,
        deliveredAt: new Date(),
      },
    });
  });
}

async function deliverLarge(orderId: string, fromStatus: OrderStatus, actor: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await advanceToReady(tx, orderId, fromStatus, actor);
    await tx.delivery.upsert({
      where: { orderId },
      create: { orderId, isLarge: true },
      update: { isLarge: true, deliveredAt: new Date() },
    });
  });
}
