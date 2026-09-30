// همکاری در فروش (افیلیت).
//
// قواعد مالی (تصمیم صاحب پروژه):
//   - کمیسیون فقط روی «خرج واقعی» است: وقتی سفارش زیرمجموعه پرداخت شد و به صف رفت
//     (چه از کیف پول، چه مستقیم از درگاه). خودِ شارژ کیف پول کمیسیون ندارد، چون هنوز درآمد نیست؛
//     و چون فقط لحظه‌ی خرج حساب می‌شود، هیچ ریالی دوبار کمیسیون نمی‌گیرد.
//   - مبنای کمیسیون قیمت پایه‌ی آیتم‌هاست (بدون کارمزد روش پرداخت، که هزینه‌ی درگاه را پوشش می‌دهد).
//   - درصد از تنظیمات ادمین خوانده و روی همان ردیف دفتر ذخیره می‌شود؛ تغییر بعدی درصد روی
//     کمیسیون‌های قبلی اثر ندارد.
//
// اصول: دفتر append-only با balanceAfter، قفل ردیف (FOR UPDATE)، idempotency با کلید یکتا،
// پول همیشه BigInt ریال.

import crypto from "crypto";
import { Prisma, type AffiliateEntryType, type AffiliatePayout } from "@prisma/client";
import { prisma } from "./db";
import { getPaymentSettings } from "./paymentSettings";
import { rialToTomanLabel } from "./money";

export { REF_COOKIE, normalizeReferralCode } from "./referralCode";

export class AffiliateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AffiliateError";
  }
}

// بدون حروف/ارقام گیج‌کننده (0/O، 1/I/L) تا کد از روی تصویر یا پیام هم درست خوانده شود.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 7;

function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

const UNIQUE_VIOLATION = "P2002";

/**
 * ثبت‌نام کاربر در برنامه‌ی همکاری (رایگان، یک‌بار). idempotent: اگر قبلاً عضو شده باشد
 * همان کد قبلی برگردانده می‌شود.
 */
export async function joinAffiliate(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        if (user.referralCode) return user.referralCode;

        const code = generateCode();
        await tx.user.update({
          where: { id: userId },
          data: { referralCode: code, affiliateJoinedAt: new Date() },
        });
        await tx.affiliateAccount.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });
        return code;
      });
    } catch (error) {
      // برخورد نادر کد تصادفی با کد موجود: با کد تازه دوباره تلاش می‌کنیم.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
        continue;
      }
      throw error;
    }
  }
  throw new AffiliateError("ساخت کد همکاری ناموفق بود؛ دوباره تلاش کن.");
}

/** شناسه‌ی همکارِ صاحب این کد، فقط اگر واقعاً عضو برنامه باشد. */
export async function findAffiliateIdByCode(code: string | null): Promise<string | null> {
  if (!code) return null;
  const user = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true, affiliateJoinedAt: true },
  });
  return user?.affiliateJoinedAt ? user.id : null;
}

// ---------------------------------------------------------------------------
// دفتر کمیسیون
// ---------------------------------------------------------------------------

type AccountRow = { id: string; balanceRial: bigint };

async function lockAccount(tx: Prisma.TransactionClient, userId: string): Promise<AccountRow> {
  // اگر حساب هنوز ساخته نشده (مثلاً داده‌ی قدیمی)، اول ساخته و بعد قفل می‌شود.
  await tx.affiliateAccount.upsert({ where: { userId }, create: { userId }, update: {} });
  const rows = await tx.$queryRaw<AccountRow[]>`
    SELECT id, "balanceRial" FROM "AffiliateAccount" WHERE "userId" = ${userId} FOR UPDATE
  `;
  return rows[0];
}

const INCREASING: AffiliateEntryType[] = ["commission", "payout_release"];

/** تنها مسیر تغییر موجودی همکار: یک ردیف دفتر + balanceAfter، زیر قفل ردیف. */
async function appendEntryInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  entry: {
    type: AffiliateEntryType;
    amountRial: bigint;
    idempotencyKey: string;
    orderId?: string;
    payoutId?: string;
    sourceUserId?: string;
    baseRial?: bigint;
    percent?: number;
    note?: string;
  },
) {
  if (entry.amountRial <= 0n) throw new AffiliateError("مبلغ باید بزرگ‌تر از صفر باشد.");

  const account = await lockAccount(tx, userId);
  const delta = INCREASING.includes(entry.type) ? entry.amountRial : -entry.amountRial;
  const balanceAfter = account.balanceRial + delta;
  if (balanceAfter < 0n) throw new AffiliateError("موجودی کمیسیون کافی نیست.");

  const row = await tx.affiliateLedger.create({
    data: { accountId: account.id, balanceAfter, ...entry },
  });
  await tx.affiliateAccount.update({ where: { id: account.id }, data: { balanceRial: balanceAfter } });
  return row;
}

/** مبلغ کمیسیون با حساب صحیح (BigInt، گرد به پایین): هیچ float در کار نیست. */
export function commissionFor(baseRial: bigint, percent: number): bigint {
  if (percent <= 0) return 0n;
  return (baseRial * BigInt(percent)) / 100n;
}

/**
 * بعد از اینکه سفارشی واقعاً پرداخت شد و به صف رفت، داخل همان تراکنش صدا زده می‌شود.
 * اگر خریدار معرف داشته باشد، کمیسیون معرف ثبت می‌شود. idempotent: هر سفارش حداکثر یک‌بار.
 * اگر کاربر معرف نداشته باشد یا درصد صفر باشد، کاری انجام نمی‌شود.
 */
export async function accrueOrderCommissionInTx(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      user: { select: { referredById: true } },
      items: { select: { priceRial: true } },
    },
  });
  const referrerId = order?.user.referredById;
  if (!order || !referrerId || referrerId === order.userId) return;

  const idempotencyKey = `commission:order:${order.id}`;
  const existing = await tx.affiliateLedger.findUnique({ where: { idempotencyKey } });
  if (existing) return;

  const { affiliateCommissionPercent: percent } = await getPaymentSettings();
  const baseRial = order.items.reduce((sum, i) => sum + i.priceRial, 0n);
  const amountRial = commissionFor(baseRial, percent);
  if (amountRial <= 0n) return;

  await appendEntryInTx(tx, referrerId, {
    type: "commission",
    amountRial,
    idempotencyKey,
    orderId: order.id,
    sourceUserId: order.userId,
    baseRial,
    percent,
    note: `کمیسیون سفارش MJ-${order.orderNumber}`,
  });
}

// ---------------------------------------------------------------------------
// تسویه
// ---------------------------------------------------------------------------

/**
 * درخواست تسویه. مبلغ همان لحظه از موجودی کسر (hold) می‌شود تا یک موجودی دوبار درخواست نشود.
 * همزمان فقط یک درخواست باز مجاز است. idempotent با idempotencyKey کلاینت.
 */
export async function requestPayout(
  userId: string,
  input: { amountRial: bigint; cardNumber: string; cardHolder: string; idempotencyKey: string },
): Promise<AffiliatePayout> {
  const ledgerKey = `payout_hold:${userId}:${input.idempotencyKey}`;
  const { affiliateMinPayoutRial } = await getPaymentSettings();

  return prisma.$transaction(async (tx) => {
    const previous = await tx.affiliateLedger.findUnique({ where: { idempotencyKey: ledgerKey } });
    if (previous?.payoutId) {
      return tx.affiliatePayout.findUniqueOrThrow({ where: { id: previous.payoutId } });
    }

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.affiliateJoinedAt) throw new AffiliateError("اول باید در برنامه‌ی همکاری ثبت‌نام کنی.");

    // قفل حساب قبل از بررسی درخواست باز، تا دو درخواست همزمان هر دو رد نشوند/هر دو ثبت نشوند.
    const account = await lockAccount(tx, userId);

    const open = await tx.affiliatePayout.findFirst({ where: { userId, status: "requested" } });
    if (open) throw new AffiliateError("یک درخواست تسویه‌ی در حال بررسی داری؛ بعد از نتیجه‌ی آن دوباره درخواست بده.");

    if (input.amountRial < affiliateMinPayoutRial) {
      throw new AffiliateError(`حداقل مبلغ تسویه ${rialToTomanLabel(Number(affiliateMinPayoutRial))} است.`);
    }
    if (input.amountRial > account.balanceRial) throw new AffiliateError("مبلغ درخواستی از موجودی کمیسیون بیشتر است.");

    const payout = await tx.affiliatePayout.create({
      data: {
        userId,
        amountRial: input.amountRial,
        cardNumber: input.cardNumber,
        cardHolder: input.cardHolder,
      },
    });
    await appendEntryInTx(tx, userId, {
      type: "payout_hold",
      amountRial: input.amountRial,
      idempotencyKey: ledgerKey,
      payoutId: payout.id,
      note: "درخواست تسویه",
    });
    return payout;
  });
}

type PayoutRow = { id: string; userId: string; amountRial: bigint; status: string };

/**
 * بررسی درخواست تسویه توسط ادمین. فقط از وضعیت requested قابل تغییر است (بازبینی دوباره اثری ندارد).
 * رد درخواست، مبلغ را به موجودی همکار برمی‌گرداند؛ «واریز شد» آن را نهایی می‌کند.
 */
export async function reviewPayout(
  adminId: string,
  payoutId: string,
  decision: { action: "paid"; bankRef: string; note?: string } | { action: "rejected"; note: string },
): Promise<AffiliatePayout> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<PayoutRow[]>`
      SELECT id, "userId", "amountRial", status::text AS status
      FROM "AffiliatePayout" WHERE id = ${payoutId} FOR UPDATE
    `;
    const payout = rows[0];
    if (!payout) throw new AffiliateError("درخواست تسویه یافت نشد.");
    if (payout.status !== "requested") throw new AffiliateError("این درخواست قبلاً بررسی شده است.");

    if (decision.action === "rejected") {
      await appendEntryInTx(tx, payout.userId, {
        type: "payout_release",
        amountRial: payout.amountRial,
        idempotencyKey: `payout_release:${payout.id}`,
        payoutId: payout.id,
        note: "بازگشت مبلغ درخواست تسویه‌ی ردشده",
      });
    }

    return tx.affiliatePayout.update({
      where: { id: payout.id },
      data: {
        status: decision.action,
        bankRef: decision.action === "paid" ? decision.bankRef : null,
        adminNote: decision.note ?? null,
        reviewedById: adminId,
        reviewedAt: new Date(),
      },
    });
  });
}

/** شماره کارت را برای نمایش ماسک می‌کند (فقط ۴ رقم اول و آخر). */
export function maskCardNumber(card: string): string {
  return `${card.slice(0, 4)}-****-****-${card.slice(-4)}`;
}
