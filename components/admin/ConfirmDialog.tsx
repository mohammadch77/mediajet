"use client";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "تأیید",
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4" onClick={onCancel}>
      <div
        className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.2)] rounded-2xl p-6 max-w-[420px] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display font-bold text-lg mb-2">{title}</h3>
        <p className="text-dim text-[.88rem] mb-6 leading-relaxed">{message}</p>
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-full text-[.85rem] font-bold text-dim hover:text-text bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] transition disabled:opacity-60"
          >
            انصراف
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 rounded-full text-[.85rem] font-bold text-white bg-gradient-to-br from-primary to-primary2 transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
