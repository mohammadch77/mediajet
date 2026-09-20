import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { fileStorage } from "@/lib/storage";
import { ensureFileOnDisk } from "@/lib/fileCleanup";

// GET /api/orders/items/[itemId]/download
// دانلود فایل تحویلی یک آیتم سفارش (نه کل سفارش)؛ فقط مالک سفارش و فقط برای
// فایل‌های کوچک (غیر «بزرگ») مجاز است.
export async function GET(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "برای دانلود باید وارد شوید." }, { status: 401 });
  }

  const { itemId } = await params;
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { delivery: true, order: { select: { userId: true } } },
  });

  if (!item || item.order.userId !== currentUser.id) {
    return NextResponse.json({ error: "آیتم سفارش یافت نشد." }, { status: 404 });
  }

  const delivery = item.delivery;
  if (!delivery || !delivery.storageKey || delivery.isLarge) {
    return NextResponse.json({ error: "فایل این آیتم برای دانلود مستقیم در دسترس نیست." }, { status: 404 });
  }

  try {
    await ensureFileOnDisk(delivery);
  } catch (error) {
    console.error(`[دانلود خطا] بازیابی فایل تحویل آیتم ${itemId} با خطا مواجه شد:`, error);
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
