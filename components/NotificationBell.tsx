"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toPersianDigits } from "@/lib/money";
import { toJalaliDateTime } from "@/lib/jalali";
import { useVisiblePolling } from "@/lib/useVisiblePolling";

type NotificationItem = { id: string; text: string; href: string; read: boolean; createdAt: string };

const POLL_MS = 15_000;

function markRead(body: { id: string } | { all: true }) {
  return fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {
    // بی‌اثر است؛ در بازخوانی بعدی دوباره نشان داده می‌شود.
  });
}

/** زنگوله‌ی اعلان‌ها در هدر؛ فقط برای کاربر واردشده رندر شود. */
export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      // خطای شبکه بی‌اثر است؛ زنگوله وضعیت قبلی را نگه می‌دارد.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useVisiblePolling(load, POLL_MS, true);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function handleItemClick(item: NotificationItem) {
    if (!item.read) {
      setItems((prev) => prev?.map((n) => (n.id === item.id ? { ...n, read: true } : n)) ?? null);
      setUnreadCount((c) => Math.max(0, c - 1));
      void markRead({ id: item.id });
    }
    setOpen(false);
    router.push(item.href);
  }

  function handleMarkAll() {
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? null);
    setUnreadCount(0);
    void markRead({ all: true });
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) load();
        }}
        aria-label={unreadCount > 0 ? `اعلان‌ها (${toPersianDigits(unreadCount)} خوانده‌نشده)` : "اعلان‌ها"}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative w-9 h-9 grid place-items-center rounded-full bg-[rgb(var(--c-ov)/.06)] border border-[rgb(var(--c-primary2)/.14)] transition hover:bg-[rgb(var(--c-ov)/.12)] cursor-pointer"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          width="17"
          height="17"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={unreadCount > 0 ? "mj-bell-ring" : ""}
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-accent2 text-white text-[.65rem] font-bold grid place-items-center">
            {unreadCount > 9 ? "+۹" : toPersianDigits(unreadCount)}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="z-[210] bg-surface border border-[rgb(var(--c-primary2)/.2)] rounded-[20px] shadow-[0_30px_80px_-20px_rgba(0,0,0,.85)] overflow-hidden
            fixed top-[70px] inset-x-4 min-[761px]:absolute min-[761px]:inset-x-auto min-[761px]:top-[calc(100%+12px)] min-[761px]:left-0 min-[761px]:w-[360px]"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--c-primary2)/.14)]">
            <span className="font-display font-bold text-[.95rem]">اعلان‌ها</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="font-body cursor-pointer border-none bg-transparent text-cyan text-[.8rem] font-semibold hover:underline"
              >
                خواندن همه
              </button>
            )}
          </div>

          <div className="max-h-[min(60vh,420px)] overflow-y-auto">
            {!items ? (
              <div className="text-dim text-[.85rem] px-4 py-6 text-center">در حال بارگذاری...</div>
            ) : items.length === 0 ? (
              <div className="text-dim text-[.85rem] px-4 py-8 text-center">اعلانی نداری.</div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleItemClick(item)}
                  className={
                    "font-body w-full text-right flex items-start gap-3 px-4 py-3 border-b border-[rgb(var(--c-primary2)/.08)] last:border-0 cursor-pointer transition hover:bg-[rgb(var(--c-ov)/.05)] " +
                    (item.read ? "bg-transparent" : "bg-[rgb(var(--c-primary)/.08)]")
                  }
                >
                  <span
                    className={
                      "mt-1.5 w-2 h-2 rounded-full shrink-0 " + (item.read ? "bg-transparent" : "bg-accent2")
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className={"block text-[.86rem] leading-relaxed " + (item.read ? "text-dim" : "text-text font-semibold")}>
                      {item.text}
                    </span>
                    <span className="block text-dim text-[.72rem] mt-1">{toJalaliDateTime(item.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
