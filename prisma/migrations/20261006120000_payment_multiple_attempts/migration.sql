-- هر سفارش می‌تواند چند تلاش پرداخت درگاهی داشته باشد (پرداخت دوباره‌ی سفارش «در انتظار پرداخت»).
-- یکتایی orderId برداشته می‌شود؛ ایمنی در برابر پرداخت دوباره با قفل ردیف سفارش و
-- ناموفق‌کردن تلاش‌های باز قبلی (lib/payment.ts و app/api/orders/[id]/pay) تأمین می‌شود.
DROP INDEX "Payment_orderId_key";
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
