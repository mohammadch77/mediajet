// منطق تأیید بازگشت از درگاه پرداخت و شارژ اتمیک کیف پول.

import { Prisma, PaymentStatus } from "@prisma/client";
import { prisma } from "./db";
import { getGateway } from "./gateway";
import { creditWalletInTx } from "./wallet";

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

type PaymentRow = {
  id: string;
  userId: string;
  amountRial: bigint;
  status: PaymentStatus;
  idempotencyKey: string;
};

async function lockPayment(tx: Prisma.TransactionClient, authority: string): Promise<PaymentRow> {
  const rows = await tx.$queryRaw<PaymentRow[]>`
    SELECT id, "userId", "amountRial", status, "idempotencyKey"
    FROM "Payment" WHERE authority = ${authority} FOR UPDATE
  `;
  const payment = rows[0];
  if (!payment) {
    throw new PaymentError("پرداخت یافت نشد.");
  }
  return payment;
}

/**
 * بعد از بازگشت کاربر از درگاه فراخوانی می‌شود.
 * اتمیک و idempotent: اگر پرداخت قبلاً verified یا failed شده باشد، دوباره پردازش نمی‌شود
 * و کیف پول دوباره شارژ نمی‌گردد. مبلغ نهایی همیشه از رکورد Payment سمت سرور خوانده می‌شود،
 * هرگز از پارامترهای callback.
 */
export async function confirmCharge(
  authority: string,
  gatewayStatusOk: boolean,
): Promise<{ status: PaymentStatus }> {
  const gateway = await getGateway();

  return prisma.$transaction(async (tx) => {
    const payment = await lockPayment(tx, authority);

    // پرداخت قبلاً به نتیجه‌ی نهایی رسیده؛ callback تکراری چیزی تغییر نمی‌دهد.
    if (payment.status === "verified" || payment.status === "failed") {
      return { status: payment.status };
    }

    if (!gatewayStatusOk) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      return { status: "failed" as PaymentStatus };
    }

    await tx.payment.update({ where: { id: payment.id }, data: { status: "paid" } });

    const verifyResult = await gateway.verifyPayment(authority, payment.amountRial);
    if (!verifyResult.ok) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      return { status: "failed" as PaymentStatus };
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "verified", refId: verifyResult.refId ?? null },
    });

    await creditWalletInTx(
      tx,
      payment.userId,
      payment.amountRial,
      payment.id,
      "شارژ کیف پول",
      payment.idempotencyKey,
    );

    return { status: "verified" as PaymentStatus };
  });
}
