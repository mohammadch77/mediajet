"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { toPersianDigits } from "@/lib/money";
import { toJalaliDate, toJalaliDateTime } from "@/lib/jalali";
import { STATUS_LABELS, ITEM_STATUS_LABELS, type OrderStatus, type OrderItemStatus } from "@/lib/orderState";
import { CATEGORIES } from "@/data/categories";
import WalletCard from "@/components/WalletCard";

type OrderItem = {
  id: string;
  category: string;
  sourceSite: string;
  productUrl: string;
  status: OrderItemStatus;
  downloadUrl: string | null;
  supportMessage: string | null;
};

type Order = {
  id: string;
  items: OrderItem[];
  priceLabel: string;
  status: OrderStatus;
  createdAt: string;
};

type WalletTx = {
  id: string;
  type: "credit" | "debit";
  amountLabel: string;
  balanceAfterLabel: string;
  note: string | null;
  createdAt: string;
};

type WalletData = {
  balanceLabel: string;
  walletMinChargeRial: string;
  walletMinChargeLabel: string;
  transactions: WalletTx[];
};

// دکمه‌های مبلغ آماده برای شارژ سریع (به تومان).
const CHARGE_PRESETS_TOMAN = [100_000, 150_000, 200_000, 250_000];

type SupportMessage = {
  id: string;
  sender: "user" | "support";
  text: string;
  createdAt: string;
};

type TabId = "wallet" | "orders" | "messages" | "profile";

const TABS: { id: TabId; label: string }[] = [
  { id: "wallet", label: "کیف پول" },
  { id: "orders", label: "سفارش‌ها" },
  { id: "messages", label: "پیام‌ها" },
  { id: "profile", label: "پروفایل" },
];

function categoryTitle(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.title ?? id;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, openAuthModal, setUserName } = useAuth();
  const [tab, setTab] = useState<TabId>("wallet");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chargeNotice, setChargeNotice] = useState<"success" | "failed" | null>(null);
  const [orderNotice, setOrderNotice] = useState<"success" | "failed" | null>(null);
  const [chargeAmountToman, setChargeAmountToman] = useState("");
  const [charging, setCharging] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);

  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [downloadingItemId, setDownloadingItemId] = useState<string | null>(null);

  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  async function handleDownload(item: OrderItem) {
    if (!item.downloadUrl || downloadingItemId) return;
    setDownloadingItemId(item.id);
    try {
      const res = await fetch(item.downloadUrl);
      if (!res.ok) {
        throw new Error("دانلود فایل ناموفق بود.");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      const fileName = match ? decodeURIComponent(match[1]) : "file";

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("دانلود فایل با خطا مواجه شد؛ دوباره تلاش کنید.");
    } finally {
      setDownloadingItemId(null);
    }
  }

  async function loadDashboard() {
    try {
      const [ordersRes, walletRes] = await Promise.all([
        fetch("/api/orders"),
        fetch("/api/wallet"),
      ]);
      if (!ordersRes.ok || !walletRes.ok) {
        throw new Error("خطا در دریافت اطلاعات پنل.");
      }
      const ordersData = await ordersRes.json();
      const walletData = await walletRes.json();
      setOrders(ordersData.orders);
      setWallet(walletData);
    } catch {
      setError("دریافت اطلاعات با خطا مواجه شد. دوباره تلاش کن.");
    }
  }

  async function loadSupportMessages() {
    try {
      const res = await fetch("/api/support/messages");
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages);
      setHasUnread(data.hasUnread);
    } catch {
      // خطای دریافت پیام‌های پشتیبانی بی‌اثر است؛ بقیه‌ی پنل باید کار کند.
    }
  }

  async function handleSendMessage() {
    setMessageError(null);
    const text = messageText.trim();
    if (!text) {
      setMessageError("متن پیام را وارد کن.");
      return;
    }

    setSendingMessage(true);
    try {
      const res = await fetch("/api/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "ارسال پیام با خطا مواجه شد.");
      }
      setMessages((prev) => [...(prev ?? []), data]);
      setMessageText("");
    } catch (e) {
      setMessageError(e instanceof Error ? e.message : "ارسال پیام با خطا مواجه شد.");
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleSaveName() {
    setNameError(null);
    setNameSaved(false);
    const name = nameInput.trim();
    if (!name) {
      setNameError("نام را وارد کن.");
      return;
    }

    setSavingName(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "ذخیره‌ی نام با خطا مواجه شد.");
      }
      setUserName(data.name);
      setNameSaved(true);
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "ذخیره‌ی نام با خطا مواجه شد.");
    } finally {
      setSavingName(false);
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!user) {
      openAuthModal();
      router.replace("/");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const charge = params.get("charge");
    if (charge === "success" || charge === "failed") {
      setChargeNotice(charge);
      setTab("wallet");
      router.replace("/dashboard");
    }

    // بازگشت از درگاه برای پرداخت مستقیم سفارش
    const order = params.get("order");
    if (order === "success" || order === "failed") {
      setOrderNotice(order);
      setTab("orders");
      router.replace("/dashboard");
    }

    loadDashboard();
    loadSupportMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, router, openAuthModal]);

  // پیام‌های پشتیبانی هر چند ثانیه یک‌بار به‌روزرسانی می‌شوند تا کاربر لازم نباشد صفحه را رفرش کند.
  // فقط وقتی تب مرورگر باز و فعال است poll می‌شود تا درخواست بی‌مورد به سرور نرود.
  useEffect(() => {
    if (loading || !user) return;

    const POLL_INTERVAL_MS = 5000;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      if (intervalId) return;
      intervalId = setInterval(loadSupportMessages, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        loadSupportMessages();
        startPolling();
      } else {
        stopPolling();
      }
    }

    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  // با ورود کاربر، فیلد ویرایش نام با مقدار فعلی همگام می‌شود.
  useEffect(() => {
    setNameInput(user?.name ?? "");
  }, [user?.name]);

  // با باز شدن تب پیام‌ها، پیام‌های خوانده‌نشده علامت خوانده‌شده می‌خورند.
  useEffect(() => {
    if (tab !== "messages" || !hasUnread) return;
    setHasUnread(false);
    fetch("/api/support/messages", { method: "PATCH" }).catch(() => {
      // بی‌اثر است؛ در بازخوانی بعدی دوباره تلاش می‌شود.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function minChargeTomanLabel(): string {
    const minRial = wallet ? Number(wallet.walletMinChargeRial) : 1_000_000;
    return toPersianDigits((minRial / 10).toLocaleString("en-US"));
  }

  async function handleCharge() {
    setChargeError(null);
    const toman = Number(chargeAmountToman);
    if (!Number.isInteger(toman) || toman <= 0) {
      setChargeError("مبلغ را به تومان و به‌صورت عدد صحیح وارد کن.");
      return;
    }

    const amountRial = toman * 10;
    const minRial = wallet ? Number(wallet.walletMinChargeRial) : 0;
    if (minRial > 0 && amountRial < minRial) {
      setChargeError(`حداقل شارژ کیف پول ${minChargeTomanLabel()} تومان است.`);
      return;
    }

    setCharging(true);
    try {
      const res = await fetch("/api/wallet/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountRial }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "خطا در شروع شارژ کیف پول.");
      }
      window.location.href = data.redirectUrl;
    } catch (e) {
      setChargeError(e instanceof Error ? e.message : "خطا در شروع شارژ کیف پول.");
      setCharging(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center text-dim">
        در حال بررسی ورود...
      </div>
    );
  }

  const displayName = user.name?.trim() || toPersianDigits(user.mobile);

  return (
    <div className="relative min-h-screen px-[5vw] py-16 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold">Dashboard</div>
          <h1 className="font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold mt-2">
            سلام، {displayName}
          </h1>
        </div>
        <Link href="/" className="text-dim text-[.9rem] hover:text-text transition">
          ← بازگشت به صفحه‌ی اصلی
        </Link>
      </div>

      {error && (
        <div className="bg-[rgba(255,107,53,.1)] border border-[rgba(255,107,53,.3)] text-accent2 rounded-2xl p-4 mb-6">
          {error}
        </div>
      )}

      {chargeNotice === "success" && (
        <div className="bg-[rgba(56,225,255,.1)] border border-[rgba(56,225,255,.3)] text-cyan rounded-2xl p-4 mb-6">
          شارژ کیف پول با موفقیت انجام شد.
        </div>
      )}
      {chargeNotice === "failed" && (
        <div className="bg-[rgba(255,107,53,.1)] border border-[rgba(255,107,53,.3)] text-accent2 rounded-2xl p-4 mb-6">
          شارژ کیف پول ناموفق بود یا لغو شد.
        </div>
      )}

      {orderNotice === "success" && (
        <div className="bg-[rgba(56,225,255,.1)] border border-[rgba(56,225,255,.3)] text-cyan rounded-2xl p-4 mb-6">
          پرداخت سفارش با موفقیت انجام شد و سفارش در صف پردازش قرار گرفت.
        </div>
      )}
      {orderNotice === "failed" && (
        <div className="bg-[rgba(255,107,53,.1)] border border-[rgba(255,107,53,.3)] text-accent2 rounded-2xl p-4 mb-6">
          پرداخت سفارش ناموفق بود یا لغو شد. سفارش در وضعیت «در انتظار پرداخت» باقی ماند.
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-8 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              "font-body cursor-pointer shrink-0 relative text-[.9rem] font-bold px-5 py-2.5 rounded-full transition border whitespace-nowrap " +
              (tab === t.id
                ? "bg-gradient-to-br from-primary to-primary2 text-white border-transparent"
                : "bg-[rgba(255,255,255,.04)] border-[rgba(138,124,255,.2)] text-dim hover:text-text hover:border-cyan")
            }
          >
            {t.label}
            {t.id === "messages" && hasUnread && (
              <span className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-accent2 border-2 border-bg" />
            )}
          </button>
        ))}
      </div>

      {/* WALLET */}
      {tab === "wallet" && (
        <section>
          {!wallet ? (
            <div className="text-dim">در حال بارگذاری...</div>
          ) : (
            <>
              <WalletCard balanceLabel={wallet.balanceLabel}>
                <div className="text-[rgba(255,255,255,.75)] text-[.8rem] mb-3">
                  حداقل شارژ {minChargeTomanLabel()} تومان
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {CHARGE_PRESETS_TOMAN.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => {
                        setChargeAmountToman(String(amount));
                        setChargeError(null);
                      }}
                      disabled={charging}
                      className={
                        "font-body cursor-pointer text-[.85rem] font-bold px-4 py-2 rounded-full transition disabled:opacity-60 disabled:cursor-not-allowed border " +
                        (chargeAmountToman === String(amount)
                          ? "bg-white text-primary2 border-transparent"
                          : "bg-[rgba(255,255,255,.1)] border-[rgba(255,255,255,.25)] text-white hover:bg-[rgba(255,255,255,.18)]")
                      }
                    >
                      {toPersianDigits(amount.toLocaleString("en-US"))} تومان
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="number"
                    min={1}
                    placeholder="یا مبلغ دلخواه به تومان"
                    value={chargeAmountToman}
                    onChange={(e) => {
                      setChargeAmountToman(e.target.value);
                      setChargeError(null);
                    }}
                    className="bg-[rgba(255,255,255,.1)] border border-[rgba(255,255,255,.25)] text-white placeholder-[rgba(255,255,255,.6)] rounded-full px-4 py-2.5 text-[.9rem] w-full sm:w-[180px] outline-none focus:border-white"
                  />
                  <button
                    onClick={handleCharge}
                    disabled={charging}
                    className="font-body cursor-pointer border-none font-bold text-[.9rem] text-primary2 bg-white px-5 py-2.5 rounded-full transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {charging ? "در حال انتقال..." : "شارژ کیف پول"}
                  </button>
                </div>
                {chargeError && (
                  <div className="text-white bg-[rgba(0,0,0,.2)] rounded-lg px-3 py-2 text-[.82rem] mt-3">{chargeError}</div>
                )}
              </WalletCard>

              <h2 className="font-display text-[1.1rem] font-bold mb-3 mt-8">تاریخچه‌ی تراکنش‌ها</h2>
              {wallet.transactions.length === 0 ? (
                <div className="text-dim text-[.9rem]">هنوز تراکنشی ثبت نشده است.</div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-[rgba(138,124,255,.14)]">
                  <table className="w-full text-[.88rem] border-collapse min-w-[560px]">
                    <thead>
                      <tr className="bg-[rgba(255,255,255,.04)] text-dim text-right">
                        <th className="p-3.5 font-semibold">نوع</th>
                        <th className="p-3.5 font-semibold">مبلغ</th>
                        <th className="p-3.5 font-semibold">موجودی پس از تراکنش</th>
                        <th className="p-3.5 font-semibold">توضیح</th>
                        <th className="p-3.5 font-semibold">تاریخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wallet.transactions.map((t) => (
                        <tr key={t.id} className="border-t border-[rgba(138,124,255,.1)]">
                          <td className="p-3.5">
                            <span
                              className={
                                "px-2.5 py-1 rounded-full text-[.78rem] font-bold " +
                                (t.type === "credit"
                                  ? "bg-[rgba(56,225,255,.12)] text-cyan"
                                  : "bg-[rgba(255,107,53,.12)] text-accent2")
                              }
                            >
                              {t.type === "credit" ? "شارژ" : "پرداخت"}
                            </span>
                          </td>
                          <td className="p-3.5 font-semibold">
                            {t.type === "credit" ? "+ " : "- "}
                            {t.amountLabel}
                          </td>
                          <td className="p-3.5 text-dim">{t.balanceAfterLabel}</td>
                          <td className="p-3.5 text-dim">{t.note ?? "—"}</td>
                          <td className="p-3.5 text-dim whitespace-nowrap">{toJalaliDateTime(t.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ORDERS */}
      {tab === "orders" && (
        <section>
          {!orders ? (
            <div className="text-dim">در حال بارگذاری...</div>
          ) : orders.length === 0 ? (
            <div className="text-dim text-[.9rem]">هنوز سفارشی ثبت نکرده‌ای.</div>
          ) : (
            <div className="grid gap-3.5">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-[20px_22px]"
                >
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-dim text-[.78rem]">{toJalaliDate(o.createdAt)}</span>
                      {o.items.length > 1 && (
                        <span className="text-dim text-[.78rem]">· {o.items.length} آیتم</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-[.95rem]">{o.priceLabel}</span>
                      <span className="px-3 py-1.5 rounded-full text-[.8rem] font-bold bg-[rgba(255,255,255,.06)] border border-[rgba(138,124,255,.14)]">
                        {STATUS_LABELS[o.status]}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-2.5">
                    {o.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between flex-wrap gap-3 border-t border-[rgba(138,124,255,.1)] pt-2.5 first:border-t-0 first:pt-0"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap mb-1">
                            <span className="font-display font-bold text-[.92rem]">{categoryTitle(item.category)}</span>
                            <span className="text-dim text-[.8rem]">{item.sourceSite}</span>
                            <span
                              className={
                                "px-2.5 py-1 rounded-full text-[.74rem] font-bold " +
                                (item.status === "delivered"
                                  ? "bg-[rgba(56,225,255,.12)] text-cyan"
                                  : item.status === "ready"
                                    ? "bg-[rgba(107,91,255,.16)] text-primary2"
                                    : "bg-[rgba(255,255,255,.06)] text-dim")
                              }
                            >
                              {ITEM_STATUS_LABELS[item.status]}
                            </span>
                          </div>
                          <a
                            href={item.productUrl}
                            target="_blank"
                            rel="noreferrer"
                            dir="ltr"
                            className="text-dim text-[.76rem] block truncate max-w-[360px] hover:text-cyan transition"
                          >
                            {item.productUrl}
                          </a>
                          {item.supportMessage && (
                            <div className="text-cyan text-[.78rem] mt-1.5 max-w-[420px]">{item.supportMessage}</div>
                          )}
                        </div>
                        {item.downloadUrl && (
                          <button
                            type="button"
                            onClick={() => handleDownload(item)}
                            disabled={downloadingItemId === item.id}
                            className="font-body cursor-pointer border-none font-bold text-[.85rem] text-white bg-gradient-to-br from-primary to-primary2 px-4 py-2.5 rounded-full whitespace-nowrap transition hover:-translate-y-px disabled:opacity-70 disabled:cursor-wait shrink-0"
                          >
                            {downloadingItemId === item.id ? "در حال آماده‌سازی فایل شما..." : "دانلود"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SUPPORT MESSAGES */}
      {tab === "messages" && (
        <section>
          <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-[20px_22px]">
            <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto mb-4">
              {!messages ? (
                <div className="text-dim text-[.9rem]">در حال بارگذاری...</div>
              ) : messages.length === 0 ? (
                <div className="text-dim text-[.9rem]">هنوز پیامی ثبت نشده است.</div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      "max-w-[80%] rounded-2xl p-3 text-[.88rem] leading-relaxed " +
                      (m.sender === "user"
                        ? "self-start bg-[rgba(138,124,255,.16)] border border-[rgba(138,124,255,.24)]"
                        : "self-end bg-[rgba(56,225,255,.1)] border border-[rgba(56,225,255,.24)]")
                    }
                  >
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                    <div className="text-dim text-[.72rem] mt-1.5">{toJalaliDateTime(m.createdAt)}</div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="text"
                placeholder="پیام خودت را بنویس..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !sendingMessage) handleSendMessage();
                }}
                className="flex-1 min-w-[200px] bg-[rgba(255,255,255,.04)] border border-[rgba(138,124,255,.2)] rounded-full px-4 py-2.5 text-[.9rem] outline-none focus:border-cyan"
              />
              <button
                onClick={handleSendMessage}
                disabled={sendingMessage}
                className="font-body cursor-pointer border-none font-bold text-[.9rem] text-white bg-gradient-to-br from-primary to-primary2 px-5 py-2.5 rounded-full transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sendingMessage ? "در حال ارسال..." : "ارسال"}
              </button>
            </div>
            {messageError && <div className="text-accent2 text-[.82rem] mt-2">{messageError}</div>}
          </div>
        </section>
      )}

      {/* PROFILE */}
      {tab === "profile" && (
        <section>
          <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl p-[24px_26px] max-w-[480px]">
            <div className="mb-6">
              <div className="text-dim text-[.82rem] mb-1.5">شماره‌ی موبایل</div>
              <div dir="ltr" className="text-left font-bold text-[1.05rem] tracking-wide">
                {user.mobile}
              </div>
            </div>

            <div>
              <label className="block text-dim text-[.82rem] mb-1.5" htmlFor="profile-name">
                نام
              </label>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  id="profile-name"
                  type="text"
                  placeholder="نام خودت را وارد کن"
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    setNameError(null);
                    setNameSaved(false);
                  }}
                  className="flex-1 min-w-[180px] bg-[rgba(255,255,255,.04)] border border-[rgba(138,124,255,.2)] rounded-full px-4 py-2.5 text-[.9rem] outline-none focus:border-cyan"
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName || nameInput.trim() === (user.name ?? "")}
                  className="font-body cursor-pointer border-none font-bold text-[.9rem] text-white bg-gradient-to-br from-primary to-primary2 px-5 py-2.5 rounded-full transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingName ? "در حال ذخیره..." : "ذخیره"}
                </button>
              </div>
              {nameError && <div className="text-accent2 text-[.82rem] mt-2">{nameError}</div>}
              {nameSaved && !nameError && (
                <div className="text-cyan text-[.82rem] mt-2">نام با موفقیت ذخیره شد.</div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
