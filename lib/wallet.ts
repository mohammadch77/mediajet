import { Prisma, TxType, type WalletTransaction } from "@prisma/client";
import { prisma } from "./db";

export class WalletError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletError";
  }
}

const UNIQUE_VIOLATION = "P2002";

type WalletRow = { id: string; balanceRial: bigint };

async function lockWallet(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<WalletRow> {
  const rows = await tx.$queryRaw<WalletRow[]>`
    SELECT id, "balanceRial" FROM "Wallet" WHERE "userId" = ${userId} FOR UPDATE
  `;
  const wallet = rows[0];
  if (!wallet) {
    throw new WalletError("کیف پول برای این کاربر یافت نشد.");
  }
  return wallet;
}

async function findByIdempotencyKey(
  idempotencyKey: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<WalletTransaction | null> {
  return client.walletTransaction.findUnique({ where: { idempotencyKey } });
}

/**
 * کسر از کیف پول در دل یک تراکنش موجود (مثلاً تراکنش ثبت سفارش).
 * برخلاف debitWallet، تراکنش جدیدی باز نمی‌کند تا atomicity با عملیات بیرونی حفظ شود.
 * در صورت موجودی ناکافی، خطا پرتاب می‌کند و باعث rollback کل تراکنش بیرونی می‌شود.
 */
export async function debitWalletInTx(
  tx: Prisma.TransactionClient,
  userId: string,
  amountRial: bigint,
  ref: string | null,
  note: string | null,
  idempotencyKey?: string,
): Promise<WalletTransaction> {
  if (amountRial <= 0n) {
    throw new WalletError("مبلغ کسر باید بزرگ‌تر از صفر باشد.");
  }

  if (idempotencyKey) {
    const existing = await findByIdempotencyKey(idempotencyKey, tx);
    if (existing) {
      return existing;
    }
  }

  const wallet = await lockWallet(tx, userId);

  if (wallet.balanceRial < amountRial) {
    throw new WalletError("موجودی کیف پول کافی نیست.");
  }

  const balanceAfter = wallet.balanceRial - amountRial;

  const transaction = await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: TxType.debit,
      amountRial,
      balanceAfter,
      ref,
      note,
      idempotencyKey,
    },
  });

  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balanceRial: balanceAfter },
  });

  return transaction;
}

/** کیف پول کاربر را شارژ می‌کند. اگر idempotencyKey تکراری باشد، تراکنش قبلی برگردانده می‌شود. */
export async function creditWallet(
  userId: string,
  amountRial: bigint,
  ref: string | null,
  note: string | null,
  idempotencyKey?: string,
): Promise<WalletTransaction> {
  if (amountRial <= 0n) {
    throw new WalletError("مبلغ شارژ باید بزرگ‌تر از صفر باشد.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const wallet = await lockWallet(tx, userId);
      const balanceAfter = wallet.balanceRial + amountRial;

      const transaction = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: TxType.credit,
          amountRial,
          balanceAfter,
          ref,
          note,
          idempotencyKey,
        },
      });

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balanceRial: balanceAfter },
      });

      return transaction;
    });
  } catch (error) {
    return handleIdempotencyConflict(error, idempotencyKey);
  }
}

/** از کیف پول کاربر کسر می‌کند. اگر موجودی کافی نبود، خطا می‌دهد و هیچ چیزی ثبت نمی‌شود. */
export async function debitWallet(
  userId: string,
  amountRial: bigint,
  ref: string | null,
  note: string | null,
  idempotencyKey?: string,
): Promise<WalletTransaction> {
  try {
    return await prisma.$transaction((tx) =>
      debitWalletInTx(tx, userId, amountRial, ref, note, idempotencyKey),
    );
  } catch (error) {
    return handleIdempotencyConflict(error, idempotencyKey);
  }
}

async function handleIdempotencyConflict(
  error: unknown,
  idempotencyKey: string | undefined,
): Promise<WalletTransaction> {
  if (
    idempotencyKey &&
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_VIOLATION
  ) {
    const existing = await findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return existing;
    }
  }
  throw error;
}
