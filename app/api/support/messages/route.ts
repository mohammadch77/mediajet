import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { validateInput, sendSupportMessageInput, ValidationError } from "@/lib/validation";
import { notifySupportMessage } from "@/lib/telegram";

// GET /api/support/messages
// تاریخچه‌ی پیام‌های صندوق پشتیبانی کاربر جاری (فقط پیام‌های خودش).
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای مشاهده‌ی پیام‌ها باید وارد شوید." }, { status: 401 });
  }

  const messages = await prisma.supportMessage.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      readByUser: m.readByUser,
      createdAt: m.createdAt.toISOString(),
    })),
    hasUnread: messages.some((m) => m.sender === "support" && !m.readByUser),
  });
}

// POST /api/support/messages
// ثبت پیام جدید کاربر و اطلاع‌رسانی غیرمسدودکننده به تلگرام پشتیبانی.
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای ارسال پیام باید وارد شوید." }, { status: 401 });
  }

  let input;
  try {
    const body = await req.json();
    input = validateInput(sendSupportMessageInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  const message = await prisma.supportMessage.create({
    data: {
      userId: currentUser.id,
      sender: "user",
      text: input.text,
      readByUser: true,
    },
  });

  notifySupportMessage({ userId: currentUser.id, messageId: message.id, text: input.text });

  return NextResponse.json({
    id: message.id,
    sender: message.sender,
    text: message.text,
    readByUser: message.readByUser,
    createdAt: message.createdAt.toISOString(),
  });
}

// PATCH /api/support/messages
// همه‌ی پیام‌های خوانده‌نشده‌ی پشتیبانی برای کاربر جاری را خوانده‌شده علامت می‌زند.
export async function PATCH() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای این عملیات باید وارد شوید." }, { status: 401 });
  }

  await prisma.supportMessage.updateMany({
    where: { userId: currentUser.id, sender: "support", readByUser: false },
    data: { readByUser: true },
  });

  return NextResponse.json({ ok: true });
}
