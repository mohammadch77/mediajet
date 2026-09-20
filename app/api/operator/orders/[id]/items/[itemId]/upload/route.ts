import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { requireOperator, SessionError } from "@/lib/session";
import { loadDeliverableItem, markItemReadyAndAdvanceOrder, DeliveryTargetError, MAX_ITEM_FILE_BYTES } from "@/lib/delivery";

// POST /api/operator/orders/[id]/items/[itemId]/upload
// آپلود مستقیم فایل تحویلی برای یک آیتم مشخص (multipart/form-data، فیلد "file").
// سقف حجم ۲۰ مگابایت روی همین یک آیتم اعمال می‌شود؛ فایل بزرگ‌تر باید با
// endpoint «large» علامت‌گذاری شود، نه اینجا آپلود شود.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  let operator;
  try {
    operator = await requireOperator();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const { id, itemId } = await params;

  let file: File;
  try {
    const form = await req.formData();
    const entry = form.get("file");
    if (!(entry instanceof File) || entry.size === 0) {
      return NextResponse.json({ error: "فایل ارسالی معتبر نیست." }, { status: 400 });
    }
    file = entry;
  } catch {
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  if (file.size > MAX_ITEM_FILE_BYTES) {
    return NextResponse.json(
      { error: "حجم فایل بیش از ۲۰ مگابایت است؛ این آیتم را به‌عنوان «فایل بزرگ» علامت بزن." },
      { status: 413 },
    );
  }

  let target;
  try {
    target = await loadDeliverableItem(id, itemId);
  } catch (error) {
    if (error instanceof DeliveryTargetError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const storageKey = `deliveries/${id}/${crypto.randomUUID()}${ext}`;
  await fileStorage.save(storageKey, buffer);

  const actor = `operator:${operator.id}`;
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.delivery.upsert({
      where: { orderItemId: itemId },
      create: {
        orderItemId: itemId,
        storageKey,
        fileName: file.name || "file",
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: buffer.length,
        isLarge: false,
        isOnDisk: true,
        lastAccessedAt: now,
      },
      update: {
        storageKey,
        fileUrl: null,
        fileName: file.name || "file",
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: buffer.length,
        isLarge: false,
        isOnDisk: true,
        lastAccessedAt: now,
        deliveredAt: now,
      },
    });
    await markItemReadyAndAdvanceOrder(tx, {
      orderId: id,
      orderItemId: itemId,
      fromOrderStatus: target.fromStatus,
      actor,
      note: `آپلود فایل تحویل آیتم ${itemId} از پنل اپراتور`,
    });
  });

  return NextResponse.json({ orderId: id, orderItemId: itemId, itemStatus: "ready", fileName: file.name });
}
