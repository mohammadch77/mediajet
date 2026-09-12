import { prisma } from "../lib/db";
import { creditWallet, debitWallet } from "../lib/wallet";

async function main() {
  const mobile = "0900000" + Math.floor(Math.random() * 10000);
  const user = await prisma.user.create({
    data: { mobile, name: "کاربر تست", wallet: { create: { balanceRial: 0n } } },
  });
  console.log("کاربر ساخته شد:", user.id);

  const creditKey = "test-credit-" + user.id;
  const credit1 = await creditWallet(user.id, 100000n, "seed", "شارژ اولیه", creditKey);
  console.log("credit #1 balanceAfter =", credit1.balanceAfter.toString());

  const credit2 = await creditWallet(user.id, 100000n, "seed", "شارژ اولیه", creditKey);
  console.log("credit #2 (تکراری) balanceAfter =", credit2.balanceAfter.toString(), "| id مساوی:", credit1.id === credit2.id);

  const debitKey = "test-debit-" + user.id;
  const debit1 = await debitWallet(user.id, 40000n, "order-1", "پرداخت سفارش", debitKey);
  console.log("debit #1 balanceAfter =", debit1.balanceAfter.toString());

  const debit2 = await debitWallet(user.id, 40000n, "order-1", "پرداخت سفارش", debitKey);
  console.log("debit #2 (تکراری) balanceAfter =", debit2.balanceAfter.toString(), "| id مساوی:", debit1.id === debit2.id);

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  console.log("موجودی نهایی wallet.balanceRial =", wallet?.balanceRial.toString(), "(انتظار: 60000)");

  try {
    await debitWallet(user.id, 999999999n, "order-2", "بیش از موجودی");
  } catch (e) {
    console.log("خطای مورد انتظار برای کسر بیش از موجودی:", (e as Error).message);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
