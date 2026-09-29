import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { NOTIFICATION_HREF } from "@/lib/notifications";
import { validateInput, markNotificationsReadInput, ValidationError } from "@/lib/validation";

const LIST_LIMIT = 15;

// GET /api/notifications
// اعلان‌های اخیر کاربر جاری و تعداد خوانده‌نشده‌ها (برای زنگوله‌ی هدر).
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای مشاهده‌ی اعلان‌ها باید وارد شوید." }, { status: 401 });
  }

  const [unreadCount, items] = await Promise.all([
    prisma.notification.count({ where: { userId: currentUser.id, readAt: null } }),
    prisma.notification.findMany({
      where: { userId: currentUser.id },
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
    }),
  ]);

  return NextResponse.json({
    unreadCount,
    items: items.map((n) => ({
      id: n.id,
      text: n.text,
      href: n.href,
      read: n.readAt !== null,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

// PATCH /api/notifications  body: { id } | { all: true } | { tab: "orders" | "messages" }
// یک اعلان، همه، یا اعلان‌های مربوط به یک تب پنل کاربر را خوانده‌شده علامت می‌زند.
export async function PATCH(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای این عملیات باید وارد شوید." }, { status: 401 });
  }

  let input;
  try {
    input = validateInput(markNotificationsReadInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // userId از session در شرط آمده تا کاربر نتواند اعلان دیگران را تغییر دهد.
  await prisma.notification.updateMany({
    where: {
      userId: currentUser.id,
      readAt: null,
      ...("id" in input && { id: input.id }),
      ...("tab" in input && { href: NOTIFICATION_HREF[input.tab] }),
    },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
