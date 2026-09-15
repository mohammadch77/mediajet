import { prisma } from "../lib/db";

async function main() {
  const mobile = "09120000000";
  const user = await prisma.user.upsert({
    where: { mobile },
    update: {},
    create: { mobile, wallet: { create: { balanceRial: 0n } } },
  });
  const wallet = await prisma.wallet.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, balanceRial: 0n },
  });

  await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "credit",
      amountRial: 5_000_000n,
      balanceAfter: 5_000_000n,
      note: "شارژ آزمایشی",
    },
  });
  await prisma.wallet.update({ where: { id: wallet.id }, data: { balanceRial: 5_000_000n } });

  const tx2 = await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "debit",
      amountRial: 900_000n,
      balanceAfter: 4_100_000n,
      note: "پرداخت سفارش تستی",
    },
  });
  await prisma.wallet.update({ where: { id: wallet.id }, data: { balanceRial: 4_100_000n } });

  const order1 = await prisma.order.create({
    data: {
      userId: user.id,
      totalPriceRial: 900_000n,
      paymentMethod: "wallet",
      status: "delivered",
      items: {
        create: {
          sourceSite: "Freepik",
          category: "psd",
          productUrl: "https://freepik.com/example-1",
          priceRial: 900_000n,
          status: "delivered",
        },
      },
    },
    include: { items: true },
  });
  await prisma.delivery.create({
    data: { orderItemId: order1.items[0].id, fileUrl: "https://example.com/files/order1.zip" },
  });

  await prisma.order.create({
    data: {
      userId: user.id,
      totalPriceRial: 2_500_000n,
      paymentMethod: "wallet",
      status: "processing",
      items: {
        create: {
          sourceSite: "Envato",
          category: "premiere",
          productUrl: "https://elements.envato.com/example-2",
          priceRial: 2_500_000n,
        },
      },
    },
  });

  const order3 = await prisma.order.create({
    data: {
      userId: user.id,
      totalPriceRial: 700_000n,
      paymentMethod: "wallet",
      status: "ready",
      items: {
        create: {
          sourceSite: "Vecteezy",
          category: "vector",
          productUrl: "https://vecteezy.com/example-3",
          priceRial: 700_000n,
          status: "ready",
        },
      },
    },
    include: { items: true },
  });
  await prisma.delivery.create({
    data: { orderItemId: order3.items[0].id, fileUrl: "https://example.com/files/order3.zip" },
  });

  console.log("Seeded user mobile:", mobile);
}

main().finally(() => prisma.$disconnect());
