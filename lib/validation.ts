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

/** پیام "الزامی" برای فیلد غایب و پیام "نوع نامعتبر" برای مقداری با نوع اشتباه. */
function requiredOrInvalidType(requiredMsg: string, invalidTypeMsg: string) {
  return (iss: { input?: unknown }) => (iss.input === undefined ? requiredMsg : invalidTypeMsg);
}

export const chargeInput = z.object({
  userId: z
    .string({ error: "شناسه‌ی کاربر الزامی است." })
    .min(1, "شناسه‌ی کاربر الزامی است."),
  amountRial: z
    .number({ error: requiredOrInvalidType("مبلغ الزامی است.", "مبلغ باید عدد باشد.") })
    .int("مبلغ باید عدد صحیح باشد.")
    .positive("مبلغ باید بزرگ‌تر از صفر باشد."),
});

export type ChargeInput = z.infer<typeof chargeInput>;

// برخلاف chargeInput، شناسه‌ی کاربر از session خوانده می‌شود، نه از بدنه‌ی درخواست.
export const walletChargeInput = z.object({
  amountRial: z
    .number({ error: requiredOrInvalidType("مبلغ الزامی است.", "مبلغ باید عدد باشد.") })
    .int("مبلغ باید عدد صحیح باشد.")
    .positive("مبلغ باید بزرگ‌تر از صفر باشد."),
});

export type WalletChargeInput = z.infer<typeof walletChargeInput>;

export const createOrderInput = z.object({
  categoryId: z
    .string({ error: "دسته‌بندی الزامی است." })
    .min(1, "دسته‌بندی الزامی است."),
  site: z
    .string({ error: "سایت الزامی است." })
    .min(1, "سایت الزامی است."),
  productUrl: z
    .string({ error: "آدرس محصول الزامی است." })
    .url("آدرس محصول معتبر نیست."),
  paymentMethod: z.literal("wallet", {
    error: requiredOrInvalidType("روش پرداخت الزامی است.", "روش پرداخت نامعتبر است."),
  }),
  idempotencyKey: z
    .string({ error: "کلید یکتای درخواست الزامی است." })
    .min(1, "کلید یکتای درخواست الزامی است."),
});

export type CreateOrderInput = z.infer<typeof createOrderInput>;

const mobileField = z
  .string({ error: "شماره موبایل الزامی است." })
  .regex(/^09\d{9}$/, "شماره موبایل معتبر نیست.");

export const requestOtpInput = z.object({
  mobile: mobileField,
});

export type RequestOtpInput = z.infer<typeof requestOtpInput>;

export const verifyOtpInput = z.object({
  mobile: mobileField,
  code: z
    .string({ error: "کد تأیید الزامی است." })
    .regex(/^\d{6}$/, "کد تأیید باید ۶ رقم باشد."),
});

export type VerifyOtpInput = z.infer<typeof verifyOtpInput>;

const orderStatusValues = [
  "draft",
  "awaiting_payment",
  "queued",
  "processing",
  "ready",
  "delivered",
  "cancelled",
  "failed",
  "refunded",
] as const;

export const operatorStatusInput = z.object({
  toStatus: z.enum(orderStatusValues, {
    error: requiredOrInvalidType("وضعیت مقصد الزامی است.", "وضعیت مقصد نامعتبر است."),
  }),
  note: z.string().optional(),
});

export type OperatorStatusInput = z.infer<typeof operatorStatusInput>;

export const operatorDeliverInput = z.object({
  fileUrl: z
    .string({ error: "لینک فایل تحویلی الزامی است." })
    .url("لینک فایل تحویلی معتبر نیست."),
});

export type OperatorDeliverInput = z.infer<typeof operatorDeliverInput>;

// فقط فیلدهایی از آپدیت تلگرام که در webhook استفاده می‌شوند اعتبارسنجی می‌شوند؛
// بدنه‌ی واقعی تلگرام فیلدهای بسیار بیشتری دارد که برای ما اهمیتی ندارند.
export const telegramUpdateInput = z.object({
  message: z
    .object({
      message_id: z.number(),
      chat: z.object({ id: z.union([z.number(), z.string()]) }),
      text: z.string().optional(),
      caption: z.string().optional(),
      document: z
        .object({
          file_id: z.string(),
          file_name: z.string().optional(),
          mime_type: z.string().optional(),
          file_size: z.number().optional(),
        })
        .optional(),
      reply_to_message: z
        .object({
          text: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export type TelegramUpdateInput = z.infer<typeof telegramUpdateInput>;

export const sendSupportMessageInput = z.object({
  text: z
    .string({ error: "متن پیام الزامی است." })
    .trim()
    .min(1, "متن پیام الزامی است.")
    .max(2000, "متن پیام نباید بیشتر از ۲۰۰۰ نویسه باشد."),
});

export type SendSupportMessageInput = z.infer<typeof sendSupportMessageInput>;

const roleValues = ["user", "operator", "admin"] as const;

export const changeUserRoleInput = z.object({
  role: z.enum(roleValues, {
    error: requiredOrInvalidType("نقش جدید الزامی است.", "نقش نامعتبر است."),
  }),
});

export type ChangeUserRoleInput = z.infer<typeof changeUserRoleInput>;

const settingKeyValues = ["ZARINPAL_MERCHANT_ID", "SMS_PANEL_API_KEY"] as const;

export const updateSettingInput = z.object({
  key: z.enum(settingKeyValues, {
    error: requiredOrInvalidType("کلید تنظیم الزامی است.", "کلید تنظیم نامعتبر است."),
  }),
  value: z
    .string({ error: "مقدار الزامی است." })
    .trim()
    .min(1, "مقدار نمی‌تواند خالی باشد.")
    .max(2000, "مقدار نباید بیشتر از ۲۰۰۰ نویسه باشد."),
});

export type UpdateSettingInput = z.infer<typeof updateSettingInput>;
