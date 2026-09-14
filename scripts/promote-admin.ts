// ارتقای یک کاربر به نقش admin.
// اجرا: npx tsx scripts/promote-admin.ts 0901234567

import { prisma } from "../lib/db";

async function main() {
  const mobile = process.argv[2];
  if (!mobile) {
    console.error("استفاده: npx tsx scripts/promote-admin.ts <mobile>");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.update({
    where: { mobile },
    data: { role: "admin" },
  });
  console.log(`کاربر ${user.mobile} (${user.id}) به admin ارتقا یافت.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
