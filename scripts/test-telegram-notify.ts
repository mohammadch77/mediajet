import crypto from "crypto";
import { prisma } from "../lib/db";
import { creditWallet } from "../lib/wallet";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SESSION_COOKIE = "mediajet_session";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function createSessionCookie(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { userId, tokenHash, expiresAt } });
  return `${SESSION_COOKIE}=${token}`;
}

async function postOrder(cookie: string, body: unknown) {
  const res = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function main() {
  const mobile = "0902000" + Math.floor(Math.random() * 10000);
  const user = await prisma.user.create({
    data: { mobile, name: "کاربر تست تلگرام", wallet: { create: { balanceRial: 0n } } },
  });
  const cookie = await createSessionCookie(user.id);
  console.log("کاربر ساخته شد:", user.id);

  await creditWallet(user.id, 2000000n, "seed", "شارژ اولیه", "test-telegram-credit-" + user.id);
  console.log("کیف پول شارژ شد.");

  // سناریو ۱: سفارش موفق -> باید هر دو پیام تلگرام (شبیه‌سازی) در کنسول سرور چاپ شوند.
  const key1 = "test-telegram-" + user.id + "-ok";
  const r1 = await postOrder(cookie, {
    categoryId: "vector",
    site: "Freepik",
    productUrl: "https://freepik.com/some-vector",
    paymentMethod: "wallet",
    idempotencyKey: key1,
  });
  console.log("\n[سناریو ۱] سفارش موفق:", r1.status, r1.json);
  console.log("→ به لاگ سرور (کنسول dev) نگاه کنید؛ باید دو پیام [تلگرام شبیه‌سازی] چاپ شده باشد.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
