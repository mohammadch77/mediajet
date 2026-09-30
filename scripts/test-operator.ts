// تست پنل اپراتور: صف سفارش‌ها، تغییر وضعیت طبق state machine، تحویل آیتم، و کنترل دسترسی.
// تحویل از قدم ۵ به‌صورت per-item است: POST /api/operator/orders/:id/items/:itemId/deliver.
// نیازمند اجرای سرور dev (BASE_URL قابل تنظیم).

import { prisma } from "../lib/db";
import { BASE_URL, check, run, makeSessionCookie, randomMobile, readJson } from "./testUtils";

function createOrder(userId: string, status: "queued" | "processing", productUrl: string) {
  return prisma.order.create({
    data: {
      userId,
      totalPriceRial: 700000n,
      paymentMethod: "wallet",
      status,
      items: { create: { sourceSite: "Freepik", category: "vector", productUrl, priceRial: 700000n } },
    },
    include: { items: true },
  });
}

run(async () => {
  const operator = await prisma.user.create({
    data: { mobile: randomMobile("0938"), role: "operator", wallet: { create: { balanceRial: 0n } } },
  });
  const operatorCookie = await makeSessionCookie(operator.id);
  const user = await prisma.user.create({ data: { mobile: randomMobile("0937"), wallet: { create: { balanceRial: 5_000_000n } } } });
  const userCookie = await makeSessionCookie(user.id);

  const setStatus = (orderId: string, toStatus: string, cookie = operatorCookie) =>
    fetch(`${BASE_URL}/api/operator/orders/${orderId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ toStatus }),
    });

  const orderQueued = await createOrder(user.id, "queued", "https://freepik.com/a");
  const orderProcessing = await createOrder(user.id, "processing", "https://freepik.com/b");

  // [۱] دیدن صف توسط اپراتور
  const r1 = await fetch(`${BASE_URL}/api/operator/orders?status=queued`, { headers: { Cookie: operatorCookie } });
  const d1 = await readJson(r1);
  check(
    "[۱] صف queued برای اپراتور شامل سفارش تست",
    r1.status === 200 && Boolean(d1?.orders?.some((o: { id: string }) => o.id === orderQueued.id)),
    r1.status,
  );

  // [۲] queued → processing (مجاز)
  const r2 = await setStatus(orderQueued.id, "processing");
  check("[۲] queued → processing → 200", r2.status === 200, await readJson(r2));

  // [۳] انتقال نامعتبر: queued → delivered مستقیم (باید رد شود)
  const orderInvalid = await createOrder(user.id, "queued", "https://freepik.com/c");
  const r3 = await setStatus(orderInvalid.id, "delivered");
  check("[۳] انتقال نامعتبر queued → delivered → 422", r3.status === 422, await readJson(r3));

  // [۴] تحویل تنها آیتم سفارش processing با لینک → سفارش ready
  const item = orderProcessing.items[0];
  const r4 = await fetch(`${BASE_URL}/api/operator/orders/${orderProcessing.id}/items/${item.id}/deliver`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: operatorCookie },
    body: JSON.stringify({ fileUrl: "https://cdn.example.com/delivery/file.zip" }),
  });
  check("[۴] تحویل آیتم → 200", r4.status === 200, await readJson(r4));
  const afterDeliver = await prisma.order.findUnique({ where: { id: orderProcessing.id } });
  check("[۴] سفارش processing → ready", afterDeliver?.status === "ready", afterDeliver?.status);

  // [۵] ready → delivered
  const r5 = await setStatus(orderProcessing.id, "delivered");
  check("[۵] ready → delivered → 200", r5.status === 200, await readJson(r5));

  // [۶] و [۷] کاربر عادی به endpointهای اپراتور دسترسی ندارد
  const r6 = await fetch(`${BASE_URL}/api/operator/orders`, { headers: { Cookie: userCookie } });
  check("[۶] کاربر عادی → GET صف اپراتور → 403", r6.status === 403, r6.status);
  const r7 = await setStatus(orderQueued.id, "processing", userCookie);
  check("[۷] کاربر عادی → تغییر وضعیت → 403", r7.status === 403, r7.status);

  // بازبینی نهایی
  const finalOrder = await prisma.order.findUnique({
    where: { id: orderProcessing.id },
    include: { events: true, items: { include: { delivery: true } } },
  });
  check("[۸] وضعیت نهایی delivered", finalOrder?.status === "delivered", finalOrder?.status);
  check("[۸] لینک تحویل ثبت شد", finalOrder?.items[0].delivery?.fileUrl === "https://cdn.example.com/delivery/file.zip", finalOrder?.items[0].delivery);
  check(
    "[۸] رویدادهای audit: ready و delivered توسط اپراتور",
    ["ready", "delivered"].every((s) => finalOrder?.events.some((e) => e.toStatus === s && e.actor === `operator:${operator.id}`)),
    finalOrder?.events.map((e) => `${e.fromStatus} → ${e.toStatus} (${e.actor})`),
  );
});
