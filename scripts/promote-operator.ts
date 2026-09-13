// ارتقای یک کاربر به نقش operator (برای تست/راه‌اندازی).
// اجرا: npx tsx scripts/promote-operator.ts 0901234567

import { prisma } from "../lib/db";

async function main() {
  const mobile = process.argv[2];
  if (!mobile) {
    console.error("استفاده: npx tsx scripts/promote-operator.ts <mobile>");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.update({
    where: { mobile },
    data: { role: "operator" },
  });
  console.log(`کاربر ${user.mobile} (${user.id}) به operator ارتقا یافت.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
