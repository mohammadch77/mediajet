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
import { formatOrderNumber } from "./orderNumber";
import { createNotification, NOTIFICATION_HREF } from "./notifications";
import { getTelegramConfig, sendMessage } from "./telegram";
import { checkPayoutCard } from "./affiliateFraud";

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

/** شناسه‌ی همکارِ صاحب این کد، فقط اگر واقعاً عضو برنامه و تعلیق‌نشده باشد. */
export async function findAffiliateIdByCode(code: string | null): Promise<string | null> {
  if (!code) return null;
  const user = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { id: true, affiliateJoinedAt: true, affiliateSuspendedAt: true },
  });
  return user?.affiliateJoinedAt && !user.affiliateSuspendedAt ? user.id : null;
}

/** بعد از ساخت کاربرِ زیرمجموعه صدا زده می‌شود تا همکار خبردار شود (غیرمسدودکننده). */
export async function notifyNewReferral(affiliateId: string): Promise<void> {
  try {
    await createNotification(prisma, {
      userId: affiliateId,
      text: "یک نفر با لینک تو ثبت‌نام کرد و زیرمجموعه‌ات شد 🎉",
      href: NOTIFICATION_HREF.affiliate,
    });
  } catch (error) {
    console.error("[همکاری] ثبت اعلان زیرمجموعه‌ی جدید ناموفق بود:", error);
  }
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

const INCREASING: AffiliateEntryType[] = ["commission", "payout_release", "adjustment_credit"];

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
  // برگشت کمیسیون تنها ردیفی است که می‌تواند موجودی را منفی کند: اگر کمیسیون قبلاً تسویه شده
  // باشد، بدهی همکار از کمیسیون‌های بعدی کسر می‌شود. بقیه‌ی کاهش‌ها (تسویه) هرگز منفی نمی‌کنند.
  if (balanceAfter < 0n && entry.type !== "commission_reversal") {
    throw new AffiliateError("موجودی کمیسیون کافی نیست.");
  }

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
      user: { select: { referredById: true, referredBy: { select: { affiliateSuspendedAt: true } } } },
      items: { select: { priceRial: true } },
    },
  });
  const referrerId = order?.user.referredById;
  if (!order || !referrerId || referrerId === order.userId) return;
  // همکار تعلیق‌شده کمیسیون جدید نمی‌گیرد (زیرمجموعه‌هایش حذف نمی‌شوند؛ با رفع تعلیق دوباره می‌گیرد).
  if (order.user.referredBy?.affiliateSuspendedAt) return;

  // هر سفارش حداکثر یک کمیسیون (orderId یکتاست).
  if (await tx.affiliatePendingCommission.findUnique({ where: { orderId: order.id } })) return;

  const { affiliateCommissionPercent: percent, affiliateHoldDays } = await getPaymentSettings();
  const baseRial = order.items.reduce((sum, i) => sum + i.priceRial, 0n);
  const amountRial = commissionFor(baseRial, percent);
  if (amountRial <= 0n) return;

  await tx.affiliatePendingCommission.create({
    data: { orderId: order.id, affiliateId: referrerId, sourceUserId: order.userId, baseRial, percent, amountRial },
  });

  if (affiliateHoldDays === 0) {
    await releaseOrderCommissionInTx(tx, order.id);
    return;
  }
  await createNotification(tx, {
    userId: referrerId,
    text: `کمیسیون ${rialToTomanLabel(Number(amountRial))} از خرید زیرمجموعه‌ات ثبت شد و بعد از تحویل سفارش قابل برداشت می‌شود.`,
    href: NOTIFICATION_HREF.affiliate,
  });
}

type PendingRow = {
  id: string;
  orderId: string;
  affiliateId: string;
  sourceUserId: string;
  baseRial: bigint;
  percent: number;
  amountRial: bigint;
  status: string;
};

async function lockPending(tx: Prisma.TransactionClient, orderId: string): Promise<PendingRow | undefined> {
  const rows = await tx.$queryRaw<PendingRow[]>`
    SELECT id, "orderId", "affiliateId", "sourceUserId", "baseRial", percent, "amountRial", status::text AS status
    FROM "AffiliatePendingCommission" WHERE "orderId" = ${orderId} FOR UPDATE
  `;
  return rows[0];
}

/**
 * کمیسیون در انتظارِ یک سفارش را قابل برداشت می‌کند (ردیف commission در دفتر). idempotent.
 * اگر همکار معلق باشد آزاد نمی‌شود و در انتظار می‌ماند تا بعد از رفع تعلیق، cron آزادش کند.
 */
export async function releaseOrderCommissionInTx(tx: Prisma.TransactionClient, orderId: string): Promise<boolean> {
  const pending = await lockPending(tx, orderId);
  if (!pending || pending.status !== "pending") return false;

  const affiliate = await tx.user.findUnique({ where: { id: pending.affiliateId }, select: { affiliateSuspendedAt: true } });
  if (affiliate?.affiliateSuspendedAt) return false;

  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { orderNumber: true } });
  await appendEntryInTx(tx, pending.affiliateId, {
    type: "commission",
    amountRial: pending.amountRial,
    idempotencyKey: `commission:order:${orderId}`,
    orderId,
    sourceUserId: pending.sourceUserId,
    baseRial: pending.baseRial,
    percent: pending.percent,
    note: `کمیسیون سفارش ${formatOrderNumber(order.orderNumber)}`,
  });
  await tx.affiliatePendingCommission.update({
    where: { id: pending.id },
    data: { status: "released", resolvedAt: new Date() },
  });
  await createNotification(tx, {
    userId: pending.affiliateId,
    text: `کمیسیون ${rialToTomanLabel(Number(pending.amountRial))} به موجودی قابل برداشت همکاری‌ات اضافه شد.`,
    href: NOTIFICATION_HREF.affiliate,
  });
  return true;
}

/** هر بار وضعیت سفارش عوض می‌شود داخل همان تراکنش صدا زده می‌شود؛ تحویل = آزادسازی کمیسیون. */
export async function onOrderStatusChangedInTx(tx: Prisma.TransactionClient, orderId: string, to: string): Promise<void> {
  if (to === "delivered") await releaseOrderCommissionInTx(tx, orderId);
}

/**
 * آزادسازی دوره‌ای (cron): کمیسیون سفارش‌های تحویل‌شده، و سفارش‌های «آماده»ای که دوره‌ی انتظار
 * از پرداختشان گذشته (کاربر فایل را گرفته ولی دانلود را نهایی نکرده). هر سفارش در تراکنش جدا.
 */
export async function releaseDueCommissions(now = new Date()): Promise<{ released: number }> {
  const { affiliateHoldDays } = await getPaymentSettings();
  const cutoff = new Date(now.getTime() - affiliateHoldDays * 24 * 60 * 60 * 1000);
  const due = await prisma.affiliatePendingCommission.findMany({
    where: { status: "pending" },
    select: { orderId: true, createdAt: true },
    take: 500,
  });
  const orders = due.length
    ? await prisma.order.findMany({ where: { id: { in: due.map((d) => d.orderId) } }, select: { id: true, status: true } })
    : [];
  const statusOf = new Map(orders.map((o) => [o.id, o.status]));

  let released = 0;
  for (const d of due) {
    const status = statusOf.get(d.orderId);
    const eligible = status === "delivered" || (status === "ready" && d.createdAt <= cutoff);
    if (!eligible) continue;
    if (await prisma.$transaction((tx) => releaseOrderCommissionInTx(tx, d.orderId))) released++;
  }
  return { released };
}

/**
 * وقتی سفارشی بازگشت وجه می‌شود، داخل همان تراکنش صدا زده می‌شود و کمیسیونِ همان سفارش را
 * (با همان مبلغی که ثبت شده بود، نه با درصد فعلی) از موجودی همکار کم می‌کند.
 * idempotent؛ اگر سفارش کمیسیونی نساخته بود، کاری نمی‌کند.
 */
export type CommissionReversalResult =
  | { kind: "none" }
  | { kind: "cancelled_pending"; affiliateId: string; amountRial: bigint }
  | { kind: "reversed"; affiliateId: string; amountRial: bigint; balanceAfter: bigint };

export async function reverseOrderCommissionInTx(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<CommissionReversalResult> {
  // کمیسیونی که هنوز آزاد نشده فقط لغو می‌شود؛ پولی جابه‌جا نشده بود.
  const pending = await lockPending(tx, orderId);
  if (pending?.status === "pending") {
    await tx.affiliatePendingCommission.update({
      where: { id: pending.id },
      data: { status: "cancelled", resolvedAt: new Date() },
    });
    await createNotification(tx, {
      userId: pending.affiliateId,
      text: `یک سفارش زیرمجموعه‌ات بازگشت وجه شد و کمیسیون در انتظار ${rialToTomanLabel(Number(pending.amountRial))} آن لغو شد.`,
      href: NOTIFICATION_HREF.affiliate,
    });
    return { kind: "cancelled_pending", affiliateId: pending.affiliateId, amountRial: pending.amountRial };
  }

  const original = await tx.affiliateLedger.findUnique({
    where: { idempotencyKey: `commission:order:${orderId}` },
    include: { account: { select: { userId: true } } },
  });
  if (!original) return { kind: "none" };

  const idempotencyKey = `commission_reversal:order:${orderId}`;
  if (await tx.affiliateLedger.findUnique({ where: { idempotencyKey } })) return { kind: "none" };

  const row = await appendEntryInTx(tx, original.account.userId, {
    type: "commission_reversal",
    amountRial: original.amountRial,
    idempotencyKey,
    orderId,
    sourceUserId: original.sourceUserId ?? undefined,
    baseRial: original.baseRial ?? undefined,
    percent: original.percent ?? undefined,
    note: `برگشت ${original.note ?? "کمیسیون"} (بازگشت وجه)`,
  });
  await createNotification(tx, {
    userId: original.account.userId,
    text: `یک سفارش زیرمجموعه‌ات بازگشت وجه شد و کمیسیون ${rialToTomanLabel(Number(original.amountRial))} آن برگشت خورد.`,
    href: NOTIFICATION_HREF.affiliate,
  });
  return { kind: "reversed", affiliateId: original.account.userId, amountRial: original.amountRial, balanceAfter: row.balanceAfter };
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

  const result = await prisma.$transaction(async (tx) => {
    const previous = await tx.affiliateLedger.findUnique({ where: { idempotencyKey: ledgerKey } });
    if (previous?.payoutId) {
      return { payout: await tx.affiliatePayout.findUniqueOrThrow({ where: { id: previous.payoutId } }), created: false };
    }
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.affiliateJoinedAt) throw new AffiliateError("اول باید در برنامه‌ی همکاری ثبت‌نام کنی.");
    if (user.affiliateSuspendedAt) {
      throw new AffiliateError("حساب همکاری‌ات معلق است و فعلاً امکان تسویه نداری. برای پیگیری به پشتیبانی پیام بده.");
    }

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
    return { payout, created: true };
  });

  if (result.created) {
    notifyFinanceOfPayout(result.payout.id);
    void checkPayoutCard(result.payout.id);
  }
  return result.payout;
}

/** اطلاع درخواست تسویه‌ی جدید به چت مالی تلگرام؛ هرگز درخواست کاربر را fail نمی‌کند. */
function notifyFinanceOfPayout(payoutId: string): void {
  void (async () => {
    try {
      const chatId = await getTelegramConfig("TELEGRAM_CHAT_FINANCE");
      if (!chatId) return;
      const p = await prisma.affiliatePayout.findUniqueOrThrow({
        where: { id: payoutId },
        include: { user: { select: { mobile: true, name: true } } },
      });
      await sendMessage(
        chatId,
        [
          "💸 درخواست تسویه‌ی همکاری در فروش",
          `همکار: ${p.user.name ? `${p.user.name} — ` : ""}${p.user.mobile}`,
          `مبلغ: ${rialToTomanLabel(Number(p.amountRial))}`,
          `کارت: ${p.cardNumber.replace(/(\d{4})(?=\d)/g, "$1-")} (${p.cardHolder})`,
          "بررسی و ثبت نتیجه: پنل ادمین ← همکاری در فروش",
        ].join("\n"),
      );
    } catch (error) {
      console.error("[تلگرام خطا] اطلاع درخواست تسویه ناموفق بود:", error);
    }
  })();
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

    const amountLabel = rialToTomanLabel(Number(payout.amountRial));
    await createNotification(tx, {
      userId: payout.userId,
      text:
        decision.action === "paid"
          ? `تسویه‌ی ${amountLabel} به کارتت واریز شد (پیگیری: ${decision.bankRef}).`
          : `درخواست تسویه‌ی ${amountLabel} رد شد و مبلغ به موجودی همکاری‌ات برگشت. دلیل: ${decision.note}`,
      href: NOTIFICATION_HREF.affiliate,
    });

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

// ---------------------------------------------------------------------------
// مدیریت ادمین (هر اقدام در AffiliateAdminLog ثبت می‌شود)
// ---------------------------------------------------------------------------

async function logAdminAction(
  tx: Prisma.TransactionClient,
  targetUserId: string,
  actorId: string,
  action: "suspend" | "unsuspend" | "set_referrer" | "adjust_balance",
  detail: string,
): Promise<void> {
  await tx.affiliateAdminLog.create({ data: { targetUserId, actorId, action, detail } });
}

/** تعلیق یا رفع تعلیق همکار. تعلیق، درخواست تسویه‌ی بازِ همکار را دست نمی‌زند (ادمین جدا بررسی می‌کند). */
export async function setAffiliateSuspended(
  adminId: string,
  userId: string,
  suspended: boolean,
  reason: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user?.affiliateJoinedAt) throw new AffiliateError("این کاربر عضو برنامه‌ی همکاری نیست.");
    if (!!user.affiliateSuspendedAt === suspended) {
      throw new AffiliateError(suspended ? "این همکار از قبل معلق است." : "این همکار معلق نیست.");
    }
    await tx.user.update({
      where: { id: userId },
      data: suspended
        ? { affiliateSuspendedAt: new Date(), affiliateSuspendReason: reason }
        : { affiliateSuspendedAt: null, affiliateSuspendReason: null },
    });
    await logAdminAction(tx, userId, adminId, suspended ? "suspend" : "unsuspend", reason);
    await createNotification(tx, {
      userId,
      text: suspended
        ? `حساب همکاری در فروش تو معلق شد. دلیل: ${reason}`
        : "حساب همکاری در فروش تو دوباره فعال شد.",
      href: NOTIFICATION_HREF.affiliate,
    });
  });
}

/**
 * تغییر یا حذف معرفِ یک کاربر توسط ادمین. معرف جدید باید همکار فعال باشد، خودِ کاربر نباشد و
 * زنجیره‌ی معرف‌ها حلقه نسازد. فقط روی کمیسیون‌های بعدی اثر دارد؛ کمیسیون‌های قبلی دست نمی‌خورند.
 */
export async function setReferrer(
  adminId: string,
  userId: string,
  referrerCode: string | null,
  reason: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, include: { referredBy: true } });
    if (!user) throw new AffiliateError("کاربر پیدا نشد.");

    let newReferrerId: string | null = null;
    if (referrerCode) {
      const referrer = await tx.user.findUnique({ where: { referralCode: referrerCode } });
      if (!referrer?.affiliateJoinedAt) throw new AffiliateError("همکاری با این کد پیدا نشد.");
      if (referrer.affiliateSuspendedAt) throw new AffiliateError("این همکار معلق است.");
      if (referrer.id === userId) throw new AffiliateError("کاربر نمی‌تواند معرف خودش باشد.");
      // جلوگیری از حلقه: معرف جدید نباید (مستقیم یا غیرمستقیم) زیرمجموعه‌ی همین کاربر باشد.
      let cursor: string | null = referrer.referredById;
      for (let depth = 0; cursor && depth < 1000; depth++) {
        if (cursor === userId) throw new AffiliateError("این تغییر حلقه‌ی معرف می‌سازد.");
        cursor = (await tx.user.findUnique({ where: { id: cursor }, select: { referredById: true } }))?.referredById ?? null;
      }
      newReferrerId = referrer.id;
    }

    if (newReferrerId === user.referredById) throw new AffiliateError("معرف فعلی همین است.");
    await tx.user.update({ where: { id: userId }, data: { referredById: newReferrerId } });
    await logAdminAction(
      tx,
      userId,
      adminId,
      "set_referrer",
      `${user.referredBy?.referralCode ?? "بدون معرف"} ← ${referrerCode ?? "بدون معرف"} | ${reason}`,
    );
  });
}

/**
 * اصلاح دستی موجودی همکار با دلیل (مثلاً جبران خطا یا جایزه). کاهش، موجودی را منفی نمی‌کند.
 * idempotent با idempotencyKey کلاینت.
 */
export async function adjustAffiliateBalance(
  adminId: string,
  userId: string,
  input: { direction: "credit" | "debit"; amountRial: bigint; reason: string; idempotencyKey: string },
): Promise<void> {
  const key = `adjustment:${userId}:${input.idempotencyKey}`;
  await prisma.$transaction(async (tx) => {
    if (await tx.affiliateLedger.findUnique({ where: { idempotencyKey: key } })) return;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user?.affiliateJoinedAt) throw new AffiliateError("این کاربر عضو برنامه‌ی همکاری نیست.");

    await appendEntryInTx(tx, userId, {
      type: input.direction === "credit" ? "adjustment_credit" : "adjustment_debit",
      amountRial: input.amountRial,
      idempotencyKey: key,
      note: `اصلاح دستی: ${input.reason}`,
    });
    const label = rialToTomanLabel(Number(input.amountRial));
    await logAdminAction(tx, userId, adminId, "adjust_balance", `${input.direction === "credit" ? "+" : "−"}${label} | ${input.reason}`);
    await createNotification(tx, {
      userId,
      text: `موجودی همکاری‌ات ${input.direction === "credit" ? "افزایش" : "کاهش"} یافت (${label}). توضیح: ${input.reason}`,
      href: NOTIFICATION_HREF.affiliate,
    });
  });
}

/** شماره کارت را برای نمایش ماسک می‌کند (فقط ۴ رقم اول و آخر). */
export function maskCardNumber(card: string): string {
  return `${card.slice(0, 4)}-****-****-${card.slice(-4)}`;
}
