import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { rialToTomanLabel } from "@/lib/money";
import { formatOrderNumber } from "@/lib/orderNumber";
import { categoryTitle } from "@/data/categories";

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
      items: { include: { delivery: true }, orderBy: { position: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "سفارش پیدا نشد." }, { status: 404 });
  }

  return NextResponse.json({
    order: {
      id: order.id,
      orderNumber: formatOrderNumber(order.orderNumber),
      items: order.items.map((item) => ({
        id: item.id,
        position: item.position,
        categoryTitle: categoryTitle(item.category),
        sourceSite: item.sourceSite,
        productUrl: item.productUrl,
        status: item.status,
        delivery: item.delivery
          ? {
              fileUrl: item.delivery.fileUrl,
              fileName: item.delivery.fileName,
              isLarge: item.delivery.isLarge,
              deliveredAt: item.delivery.deliveredAt.toISOString(),
            }
          : null,
      })),
      priceLabel: rialToTomanLabel(Number(order.totalPriceRial)),
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      user: { id: order.user.id, mobile: order.user.mobile, name: order.user.name },
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
