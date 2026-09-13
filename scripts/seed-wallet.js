// اسکریپت کمکی برای تست: شارژ کیف پول یک کاربر (با ساخت کاربر در صورت نبود).
// استفاده: node scripts/seed-wallet.js 09121234567 5000000
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const mobile = process.argv[2];
  const amountRial = BigInt(process.argv[3] ?? "5000000");

  if (!mobile) {
    console.error("Usage: node scripts/seed-wallet.js <mobile> <amountRial>");
    process.exit(1);
  }

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

  const balanceAfter = wallet.balanceRial + amountRial;

  await prisma.$transaction([
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "credit",
        amountRial,
        balanceAfter,
        note: "شارژ آزمایشی (seed script)",
      },
    }),
    prisma.wallet.update({
      where: { id: wallet.id },
      data: { balanceRial: balanceAfter },
    }),
  ]);

  console.log(`کیف پول ${mobile} شارژ شد. موجودی جدید: ${balanceAfter} ریال`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
