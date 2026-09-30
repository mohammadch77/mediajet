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
  paymentMethod: z.enum(["wallet", "gateway"], {
    error: requiredOrInvalidType("روش پرداخت الزامی است.", "روش پرداخت نامعتبر است."),
  }),
  idempotencyKey: z
    .string({ error: "کلید یکتای درخواست الزامی است." })
    .min(1, "کلید یکتای درخواست الزامی است."),
});

export type CreateOrderInput = z.infer<typeof createOrderInput>;

export const quoteInput = z.object({
  categoryId: z
    .string({ error: "دسته‌بندی الزامی است." })
    .min(1, "دسته‌بندی الزامی است."),
  site: z
    .string({ error: "سایت الزامی است." })
    .min(1, "سایت الزامی است."),
});

export type QuoteInput = z.infer<typeof quoteInput>;

export const addCartItemInput = z.object({
  categoryId: z
    .string({ error: "دسته‌بندی الزامی است." })
    .min(1, "دسته‌بندی الزامی است."),
  site: z
    .string({ error: "سایت الزامی است." })
    .min(1, "سایت الزامی است."),
  productUrl: z
    .string({ error: "آدرس محصول الزامی است." })
    .url("آدرس محصول معتبر نیست."),
});

export type AddCartItemInput = z.infer<typeof addCartItemInput>;

export const cartCheckoutInput = z.object({
  paymentMethod: z.enum(["wallet", "gateway"], {
    error: requiredOrInvalidType("روش پرداخت الزامی است.", "روش پرداخت نامعتبر است."),
  }),
  idempotencyKey: z
    .string({ error: "کلید یکتای درخواست الزامی است." })
    .min(1, "کلید یکتای درخواست الزامی است."),
});

export type CartCheckoutInput = z.infer<typeof cartCheckoutInput>;

// تنظیمات عددی پرداخت؛ مقدار همیشه عدد صحیح است و بازه‌ی مجاز هر کلید جداگانه
// در سرور (lib/paymentSettings.ts) هم دوباره بررسی می‌شود.
const paymentSettingKeyValues = [
  "payment.gateway_surcharge_percent",
  "payment.wallet_surcharge_percent",
  "payment.wallet_min_charge_rial",
  "affiliate.commission_percent",
  "affiliate.min_payout_rial",
] as const;

const paymentSettingFieldInput = z.object({
  key: z.enum(paymentSettingKeyValues, {
    error: requiredOrInvalidType("کلید تنظیم الزامی است.", "کلید تنظیم نامعتبر است."),
  }),
  value: z
    .number({ error: requiredOrInvalidType("مقدار الزامی است.", "مقدار باید عدد باشد.") })
    .int("مقدار باید عدد صحیح باشد."),
});

export const updatePaymentSettingsInput = z.object({
  fields: z.array(paymentSettingFieldInput).min(1, "حداقل یک فیلد باید ارسال شود."),
});

export type UpdatePaymentSettingsInput = z.infer<typeof updatePaymentSettingsInput>;

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

// bcrypt فقط ۷۲ بایت اول رمز را در نظر می‌گیرد؛ رمز طولانی‌تر رد می‌شود تا بی‌صدا کوتاه نشود.
const BCRYPT_MAX_BYTES = 72;

const emailField = z
  .string({ error: "ایمیل الزامی است." })
  .trim()
  .toLowerCase()
  .max(254, "ایمیل بیش از حد طولانی است.")
  .pipe(z.email({ error: "ایمیل معتبر نیست." }));

const newPasswordField = z
  .string({ error: "رمز عبور الزامی است." })
  .min(8, "رمز عبور باید حداقل ۸ نویسه باشد.")
  .refine((p) => Buffer.byteLength(p, "utf8") <= BCRYPT_MAX_BYTES, "رمز عبور بیش از حد طولانی است.")
  .refine((p) => /\p{L}/u.test(p) && /\p{Nd}/u.test(p), "رمز عبور باید هم حرف و هم عدد داشته باشد.")
  .refine((p) => p.trim() === p, "رمز عبور نباید با فاصله شروع یا تمام شود.");

// رمز فعلی فقط مقایسه می‌شود؛ قوانین رمز جدید روی آن اعمال نمی‌شود، فقط سقف طول.
const currentPasswordField = z
  .string({ error: "رمز عبور الزامی است." })
  .min(1, "رمز عبور الزامی است.")
  .refine((p) => Buffer.byteLength(p, "utf8") <= BCRYPT_MAX_BYTES, "رمز عبور بیش از حد طولانی است.");

export const passwordLoginInput = z.object({
  email: emailField,
  password: currentPasswordField,
});

export const setCredentialsInput = z.object({
  email: emailField,
  newPassword: newPasswordField,
  currentPassword: currentPasswordField.optional(),
});

export const requestPasswordResetInput = z.object({
  mobile: mobileField,
});

export const confirmResetByTokenInput = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, "لینک بازیابی نامعتبر است."),
  newPassword: newPasswordField,
});

export const confirmResetByCodeInput = z.object({
  mobile: mobileField,
  code: z.string({ error: "کد بازیابی الزامی است." }).regex(/^\d{6}$/, "کد بازیابی باید ۶ رقم باشد."),
  newPassword: newPasswordField,
});

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

export const operatorItemDeliverInput = z.object({
  fileUrl: z
    .string({ error: "لینک فایل تحویلی الزامی است." })
    .url("لینک فایل تحویلی معتبر نیست."),
});

export type OperatorItemDeliverInput = z.infer<typeof operatorItemDeliverInput>;

// فقط فیلدهایی از آپدیت تلگرام که در webhook استفاده می‌شوند اعتبارسنجی می‌شوند؛
// بدنه‌ی واقعی تلگرام فیلدهای بسیار بیشتری دارد که برای ما اهمیتی ندارند.
const telegramFileInput = z.object({
  file_id: z.string(),
  file_name: z.string().optional(),
  mime_type: z.string().optional(),
  file_size: z.number().optional(),
});

export const telegramUpdateInput = z.object({
  message: z
    .object({
      message_id: z.number(),
      chat: z.object({ id: z.union([z.number(), z.string()]) }),
      text: z.string().optional(),
      caption: z.string().optional(),
      document: telegramFileInput.optional(),
      video: telegramFileInput.optional(),
      audio: telegramFileInput.optional(),
      animation: telegramFileInput.optional(),
      photo: z.array(telegramFileInput).optional(),
      reply_to_message: z
        .object({
          text: z.string().optional(),
          caption: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  callback_query: z
    .object({
      id: z.string(),
      data: z.string().max(64).optional(),
      message: z.object({ chat: z.object({ id: z.union([z.number(), z.string()]) }) }).optional(),
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

export const markNotificationsReadInput = z.union([
  z.object({ id: z.string().min(1).max(40) }),
  z.object({ all: z.literal(true) }),
  z.object({ tab: z.enum(["orders", "messages"]) }),
]);

export const updateProfileNameInput = z.object({
  name: z
    .string({ error: "نام الزامی است." })
    .trim()
    .min(1, "نام الزامی است.")
    .max(60, "نام نباید بیشتر از ۶۰ نویسه باشد."),
});

export type UpdateProfileNameInput = z.infer<typeof updateProfileNameInput>;

const roleValues = ["user", "operator", "admin"] as const;

export const changeUserRoleInput = z.object({
  role: z.enum(roleValues, {
    error: requiredOrInvalidType("نقش جدید الزامی است.", "نقش نامعتبر است."),
  }),
});

export type ChangeUserRoleInput = z.infer<typeof changeUserRoleInput>;

const settingKeyValues = [
  "ZARINPAL_MERCHANT_ID",
  "SMS_PANEL_API_KEY",
  "PASSWORD_RESET_SMS_MODE",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_FINANCE",
  "TELEGRAM_CHAT_OPERATOR",
  "TELEGRAM_CHAT_SUPPORT",
  "TELEGRAM_WEBHOOK_SECRET",
] as const;

export const updateSettingInput = z.object({
  key: z.enum(settingKeyValues, {
    error: requiredOrInvalidType("کلید تنظیم الزامی است.", "کلید تنظیم نامعتبر است."),
  }),
  value: z
    .string({ error: "مقدار الزامی است." })
    .trim()
    .min(1, "مقدار نمی‌تواند خالی باشد.")
    .max(2000, "مقدار نباید بیشتر از ۲۰۰۰ نویسه باشد."),
}).refine(
  (s) => s.key !== "PASSWORD_RESET_SMS_MODE" || ["code", "link", "both"].includes(s.value.toLowerCase()),
  { message: "روش بازیابی باید یکی از code، link یا both باشد.", path: ["value"] },
);

export type UpdateSettingInput = z.infer<typeof updateSettingInput>;

const contentKeyValues = [
  "hero.eyebrow",
  "hero.title_line1",
  "hero.title_line2",
  "hero.subtitle",
  "hero.button_primary",
  "hero.button_secondary",
  "contact.phone",
  "contact.email",
  "contact.address",
  "contact.telegram",
  "contact.hours",
  "contact.description",
  "footer.tagline",
  "footer.copyright",
  "footer.social_instagram",
  "footer.social_telegram",
  "header.nav1_label",
  "header.nav1_href",
  "header.nav2_label",
  "header.nav2_href",
  "header.nav3_label",
  "header.nav3_href",
] as const;

const contentFieldInput = z.object({
  key: z.enum(contentKeyValues, {
    error: requiredOrInvalidType("کلید محتوا الزامی است.", "کلید محتوا نامعتبر است."),
  }),
  value: z
    .string({ error: "مقدار الزامی است." })
    .trim()
    .max(2000, "مقدار نباید بیشتر از ۲۰۰۰ نویسه باشد."),
});

export const updateContentInput = z.object({
  fields: z.array(contentFieldInput).min(1, "حداقل یک فیلد باید ارسال شود."),
});

export type UpdateContentInput = z.infer<typeof updateContentInput>;

const slugPattern = /^[a-z0-9-]+$/;

export const updatePageInput = z.object({
  title: z
    .string({ error: "عنوان صفحه الزامی است." })
    .trim()
    .min(1, "عنوان صفحه نمی‌تواند خالی باشد.")
    .max(200, "عنوان نباید بیشتر از ۲۰۰ نویسه باشد."),
  contentHtml: z
    .string({ error: "محتوای صفحه الزامی است." })
    .max(200000, "محتوا خیلی طولانی است."),
  published: z.boolean({ error: "وضعیت انتشار نامعتبر است." }),
  metaTitle: z
    .string()
    .trim()
    .max(200, "عنوان سئو نباید بیشتر از ۲۰۰ نویسه باشد.")
    .optional()
    .or(z.literal("")),
  metaDescription: z
    .string()
    .trim()
    .max(500, "توضیحات سئو نباید بیشتر از ۵۰۰ نویسه باشد.")
    .optional()
    .or(z.literal("")),
});

export type UpdatePageInput = z.infer<typeof updatePageInput>;

export const createPageInput = z.object({
  slug: z
    .string({ error: "نامک (slug) صفحه الزامی است." })
    .trim()
    .min(1, "نامک نمی‌تواند خالی باشد.")
    .max(80, "نامک نباید بیشتر از ۸۰ نویسه باشد.")
    .regex(slugPattern, "نامک فقط می‌تواند شامل حروف انگلیسی کوچک، عدد و خط تیره باشد."),
  title: updatePageInput.shape.title,
});

export type CreatePageInput = z.infer<typeof createPageInput>;

export const updateBlogPostInput = z.object({
  title: z
    .string({ error: "عنوان نوشته الزامی است." })
    .trim()
    .min(1, "عنوان نوشته نمی‌تواند خالی باشد.")
    .max(200, "عنوان نباید بیشتر از ۲۰۰ نویسه باشد."),
  excerpt: z
    .string()
    .trim()
    .max(500, "خلاصه نباید بیشتر از ۵۰۰ نویسه باشد.")
    .optional()
    .or(z.literal("")),
  contentHtml: z
    .string({ error: "محتوای نوشته الزامی است." })
    .max(200000, "محتوا خیلی طولانی است."),
  coverImage: z
    .url("آدرس عکس کاور نامعتبر است.")
    .max(1000, "آدرس عکس کاور خیلی طولانی است.")
    .optional()
    .or(z.literal("")),
  published: z.boolean({ error: "وضعیت انتشار نامعتبر است." }),
  metaTitle: z
    .string()
    .trim()
    .max(200, "عنوان سئو نباید بیشتر از ۲۰۰ نویسه باشد.")
    .optional()
    .or(z.literal("")),
  metaDescription: z
    .string()
    .trim()
    .max(500, "توضیحات سئو نباید بیشتر از ۵۰۰ نویسه باشد.")
    .optional()
    .or(z.literal("")),
});

export type UpdateBlogPostInput = z.infer<typeof updateBlogPostInput>;

export const createBlogPostInput = z.object({
  slug: z
    .string({ error: "نامک (slug) نوشته الزامی است." })
    .trim()
    .min(1, "نامک نمی‌تواند خالی باشد.")
    .max(80, "نامک نباید بیشتر از ۸۰ نویسه باشد.")
    .regex(slugPattern, "نامک فقط می‌تواند شامل حروف انگلیسی کوچک، عدد و خط تیره باشد."),
  title: updateBlogPostInput.shape.title,
});

export type CreateBlogPostInput = z.infer<typeof createBlogPostInput>;

// ---------------------------------------------------------------------------
// همکاری در فروش
// ---------------------------------------------------------------------------

/** اعتبارسنجی شماره کارت بانکی با الگوریتم Luhn (کارت‌های شتاب از آن پیروی می‌کنند). */
function isValidCardNumber(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

const persianToLatinDigits = (v: unknown) =>
  typeof v === "string"
    ? v
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
        .replace(/[\s-]/g, "")
    : v;

export const affiliatePayoutRequestInput = z.object({
  // مبلغ به ریال، به‌صورت رشته‌ی عددی تا بدون float به BigInt تبدیل شود.
  amountRial: z
    .string({ error: "مبلغ الزامی است." })
    .regex(/^[1-9]\d{0,15}$/, "مبلغ نامعتبر است."),
  cardNumber: z.preprocess(
    persianToLatinDigits,
    z
      .string({ error: "شماره کارت الزامی است." })
      .regex(/^\d{16}$/, "شماره کارت باید ۱۶ رقم باشد.")
      .refine(isValidCardNumber, "شماره کارت معتبر نیست."),
  ),
  cardHolder: z
    .string({ error: "نام صاحب کارت الزامی است." })
    .trim()
    .min(3, "نام صاحب کارت را کامل وارد کن.")
    .max(60, "نام صاحب کارت بیش از حد طولانی است."),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, "کلید یکتای درخواست نامعتبر است."),
});

export type AffiliatePayoutRequestInput = z.infer<typeof affiliatePayoutRequestInput>;

export const affiliatePayoutReviewInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("paid"),
    bankRef: z.string().trim().min(3, "شماره پیگیری واریز را وارد کن.").max(64, "شماره پیگیری طولانی است."),
    note: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.literal("rejected"),
    note: z.string().trim().min(3, "دلیل رد را بنویس.").max(300, "دلیل رد طولانی است."),
  }),
]);

export type AffiliatePayoutReviewInput = z.infer<typeof affiliatePayoutReviewInput>;

export const refundOrderInput = z.object({
  reason: z
    .string({ error: "دلیل بازگشت وجه الزامی است." })
    .trim()
    .min(3, "دلیل بازگشت وجه را بنویس.")
    .max(300, "دلیل بازگشت وجه طولانی است."),
});

export type RefundOrderInput = z.infer<typeof refundOrderInput>;
