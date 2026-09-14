import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { rialToTomanLabel } from "@/lib/money";

// GET /api/admin/orders/:id
// جزئیات کامل یک سفارش شامل تاریخچه‌ی رویدادها (audit trail) و اطلاعات تحویل. فقط admin.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      delivery: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "سفارش پیدا نشد." }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      id: order.id,
      category: order.category,
      sourceSite: order.sourceSite,
      productUrl: order.productUrl,
      priceLabel: rialToTomanLabel(Number(order.priceRial)),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      user: { id: order.user.id, mobile: order.user.mobile, name: order.user.name },
      delivery: order.delivery
        ? {
            fileUrl: order.delivery.fileUrl,
            fileName: order.delivery.fileName,
            isLarge: order.delivery.isLarge,
            deliveredAt: order.delivery.deliveredAt.toISOString(),
          }
        : null,
      events: order.events.map((e) => ({
        id: e.id,
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        actor: e.actor,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
    },
  });
}
