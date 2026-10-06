"use client";
// پنل مدیریت کیف پول یک کاربر: موجودی، فرم افزایش/کاهش دستی (با دلیل اجباری) و تاریخچه.
// روی موبایل به‌صورت صفحه‌ی تمام‌عرض از پایین، روی دسکتاپ به‌صورت پنجره‌ی میانی.

import { useEffect, useState } from "react";
import { toEnglishDigits } from "@/lib/money";
import { formatTomanInput, tomanLabel } from "@/lib/useWalletCharge";
import { toJalaliDateTime } from "@/lib/jalali";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

type Detail = {
  user: { id: string; mobile: string; name: string | null };
  balanceRial: string;
  balanceLabel: string;
  transactions: {
    id: string;
    type: "credit" | "debit";
    amountLabel: string;
    balanceAfterLabel: string;
    note: string | null;
    byAdmin: boolean;
    createdAt: string;
  }[];
};

const MAX_TOMAN = 100_000_000;

function newKey(): string {
  return crypto.randomUUID();
}

export default function WalletAdjustPanel({
  userId,
  onClose,
  onChanged,
}: {
  userId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amountToman, setAmountToman] = useState("");
  const [reason, setReason] = useState("");
  // برای هر «فرم» یک کلید؛ بعد از موفقیت تازه می‌شود. دابل‌کلیک با همان کلید دوباره اعمال نمی‌شود.
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/wallets/${userId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت کیف پول.");
      setDetail(json);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "خطا در دریافت کیف پول.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const toman = Number(amountToman || 0);

  function onAmountChange(raw: string) {
    setAmountToman(toEnglishDigits(raw).replace(/\D/g, "").slice(0, 12));
    setFormError(null);
    setSuccess(null);
  }

  function requestSubmit() {
    setFormError(null);
    setSuccess(null);
    if (!toman) return setFormError("مبلغ را وارد کن.");
    if (toman > MAX_TOMAN) return setFormError("مبلغ هر تعدیل حداکثر ۱۰۰ میلیون تومان است.");
    if (reason.trim().length < 3) return setFormError("دلیل تعدیل را حداقل در ۳ کاراکتر بنویس.");
    setConfirming(true);
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/wallets/${userId}/adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          amountRial: toman * 10,
          reason: reason.trim(),
          idempotencyKey,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "ثبت تعدیل ناموفق بود.");
      setSuccess(`ثبت شد. موجودی جدید: ${json.balanceLabel}`);
      setAmountToman("");
      setReason("");
      setIdempotencyKey(newKey());
      await load();
      onChanged();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "ثبت تعدیل ناموفق بود.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const who = detail ? detail.user.name || detail.user.mobile : "";
  const dirLabel = direction === "credit" ? "افزایش" : "کاهش";

  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/70 md:px-4" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.2)] rounded-t-2xl md:rounded-2xl w-full md:max-w-[620px] max-h-[92vh] overflow-y-auto p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-lg">مدیریت کیف پول</h2>
            {detail && (
              <div className="text-dim text-[.82rem] mt-1">
                {detail.user.name ?? "بدون نام"} — <span dir="ltr" className="latin">{detail.user.mobile}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-dim hover:text-text text-xl leading-none px-2" aria-label="بستن">
            ✕
          </button>
        </div>

        {loadError && (
          <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-xl p-3 mb-4 text-[.85rem]">
            {loadError}
          </div>
        )}
        {!detail && !loadError && <div className="text-dim">در حال بارگذاری...</div>}

        {detail && (
          <>
            <div className="rounded-2xl bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.14)] p-4 mb-5">
              <div className="text-dim text-[.78rem] mb-1">موجودی فعلی</div>
              <div className="font-display text-[1.5rem] font-extrabold">{detail.balanceLabel}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {(["credit", "debit"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDirection(d);
                    setFormError(null);
                  }}
                  className={
                    "py-2.5 rounded-xl text-[.9rem] font-bold border transition " +
                    (direction === d
                      ? d === "credit"
                        ? "bg-[rgb(var(--c-cyan)/.14)] border-cyan text-cyan"
                        : "bg-[rgb(var(--c-accent)/.14)] border-accent2 text-accent2"
                      : "bg-[rgb(var(--c-ov)/.04)] border-[rgb(var(--c-primary2)/.2)] text-dim")
                  }
                >
                  {d === "credit" ? "+ افزایش موجودی" : "− کاهش موجودی"}
                </button>
              ))}
            </div>

            <label className="block text-[.8rem] text-dim mb-1.5">مبلغ</label>
            <div className="relative mb-1">
              <input
                inputMode="numeric"
                dir="ltr"
                value={formatTomanInput(amountToman)}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="0"
                className="w-full bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] rounded-xl pl-4 pr-16 py-2.5 text-left outline-none focus:border-cyan transition latin"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-dim text-[.8rem]">تومان</span>
            </div>
            <div className="text-dim text-[.74rem] mb-4">حداکثر ۱۰۰ میلیون تومان در هر تعدیل.</div>

            <label className="block text-[.8rem] text-dim mb-1.5">دلیل (الزامی، در تاریخچه ثبت می‌شود)</label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setFormError(null);
                setSuccess(null);
              }}
              rows={2}
              maxLength={300}
              placeholder="مثلاً: بازگشت وجه سفارش MJ-1001 / هدیه‌ی جبران"
              className="w-full bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] rounded-xl px-4 py-2.5 text-[.88rem] outline-none focus:border-cyan transition mb-4 resize-none"
            />

            {formError && (
              <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-xl p-3 mb-4 text-[.85rem]">
                {formError}
              </div>
            )}
            {success && (
              <div className="bg-[rgb(var(--c-cyan)/.1)] border border-[rgb(var(--c-cyan)/.3)] text-cyan rounded-xl p-3 mb-4 text-[.85rem]">
                {success}
              </div>
            )}

            <button
              type="button"
              onClick={requestSubmit}
              disabled={busy}
              className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-br from-primary to-primary2 transition hover:-translate-y-px disabled:opacity-60 mb-6"
            >
              ثبت {dirLabel}
            </button>

            <h3 className="font-display font-bold text-[.95rem] mb-3">آخرین تراکنش‌ها</h3>
            {detail.transactions.length === 0 ? (
              <div className="text-dim text-[.85rem]">هنوز تراکنشی ثبت نشده است.</div>
            ) : (
              <div className="grid gap-2">
                {detail.transactions.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-[rgb(var(--c-primary2)/.12)] bg-[rgb(var(--c-ov)/.03)] p-3 text-[.82rem]"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className={"font-bold " + (t.type === "credit" ? "text-cyan" : "text-accent2")}>
                        {t.type === "credit" ? "+" : "−"} {t.amountLabel}
                        {t.byAdmin && (
                          <span className="mr-2 px-2 py-0.5 rounded-full text-[.66rem] bg-[rgb(var(--c-primary)/.14)] text-primary2">
                            دستی
                          </span>
                        )}
                      </span>
                      <span className="text-dim">{toJalaliDateTime(t.createdAt)}</span>
                    </div>
                    <div className="text-dim mt-1">
                      {t.note ?? "—"} · مانده: {t.balanceAfterLabel}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title={`تأیید ${dirLabel} موجودی`}
        message={`${dirLabel} ${tomanLabel(toman)} تومان ${direction === "credit" ? "به" : "از"} کیف پول «${who}»؟ این تراکنش ثبت دائمی دارد و قابل ویرایش یا حذف نیست.`}
        confirmLabel={`ثبت ${dirLabel}`}
        busy={busy}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
