import { z, ZodError, type ZodSchema } from "zod";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** ورودی را با schema اعتبارسنجی می‌کند؛ اگر نامعتبر بود با پیام فارسی روشن خطا می‌دهد. */
export function validateInput<T>(schema: ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(firstErrorMessage(result.error));
  }
  return result.data;
}

function firstErrorMessage(error: ZodError): string {
  return error.issues[0]?.message ?? "ورودی نامعتبر است.";
}

export const chargeInput = z.object({
  userId: z.string({ required_error: "شناسه‌ی کاربر الزامی است." }).min(1, "شناسه‌ی کاربر الزامی است."),
  amountRial: z
    .number({ required_error: "مبلغ الزامی است.", invalid_type_error: "مبلغ باید عدد باشد." })
    .int("مبلغ باید عدد صحیح باشد.")
    .positive("مبلغ باید بزرگ‌تر از صفر باشد."),
});

export type ChargeInput = z.infer<typeof chargeInput>;

export const createOrderInput = z.object({
  categoryId: z.string({ required_error: "دسته‌بندی الزامی است." }).min(1, "دسته‌بندی الزامی است."),
  site: z.string({ required_error: "سایت الزامی است." }).min(1, "سایت الزامی است."),
  productUrl: z
    .string({ required_error: "آدرس محصول الزامی است." })
    .url("آدرس محصول معتبر نیست."),
  paymentMethod: z.literal("wallet", {
    required_error: "روش پرداخت الزامی است.",
    invalid_type_error: "روش پرداخت نامعتبر است.",
  }),
  idempotencyKey: z
    .string({ required_error: "کلید یکتای درخواست الزامی است." })
    .min(1, "کلید یکتای درخواست الزامی است."),
});

export type CreateOrderInput = z.infer<typeof createOrderInput>;

const mobileField = z
  .string({ required_error: "شماره موبایل الزامی است." })
  .regex(/^09\d{9}$/, "شماره موبایل معتبر نیست.");

export const requestOtpInput = z.object({
  mobile: mobileField,
});

export type RequestOtpInput = z.infer<typeof requestOtpInput>;

export const verifyOtpInput = z.object({
  mobile: mobileField,
  code: z
    .string({ required_error: "کد تأیید الزامی است." })
    .regex(/^\d{6}$/, "کد تأیید باید ۶ رقم باشد."),
});

export type VerifyOtpInput = z.infer<typeof verifyOtpInput>;
