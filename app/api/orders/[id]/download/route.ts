import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { fileStorage } from "@/lib/storage";
import { ensureFileOnDisk } from "@/lib/fileCleanup";

// GET /api/orders/[id]/download
// دانلود فایل تحویلی سفارش؛ فقط مالک سفارش و فقط برای فایل‌های کوچک (غیر «بزرگ») مجاز است.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای دانلود باید وارد شوید." }, { status: 401 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { delivery: true } });

  if (!order || order.userId !== currentUser.id) {
    return NextResponse.json({ error: "سفارش یافت نشد." }, { status: 404 });
  }

  const delivery = order.delivery;
  if (!delivery || !delivery.storageKey || delivery.isLarge) {
    return NextResponse.json({ error: "فایل این سفارش برای دانلود مستقیم در دسترس نیست." }, { status: 404 });
  }

  try {
    await ensureFileOnDisk(delivery);
  } catch (error) {
    console.error(`[دانلود خطا] بازیابی فایل تحویل سفارش ${id} با خطا مواجه شد:`, error);
    return NextResponse.json({ error: "فایل روی سرور یافت نشد." }, { status: 404 });
  }

  let data: Buffer;
  try {
    data = await fileStorage.read(delivery.storageKey);
  } catch {
    return NextResponse.json({ error: "فایل روی سرور یافت نشد." }, { status: 404 });
  }

  const fileName = delivery.fileName ?? "file";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": delivery.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Content-Length": String(data.length),
    },
  });
}
