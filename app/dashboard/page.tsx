"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";
import { toPersianDigits } from "@/lib/money";
import { useWalletCharge, formatTomanInput, tomanLabel } from "@/lib/useWalletCharge";
import { toJalaliDate, toJalaliDateTime } from "@/lib/jalali";
import { STATUS_LABELS, ITEM_STATUS_LABELS, type OrderStatus, type OrderItemStatus } from "@/lib/orderState";
import { categoryTitle } from "@/data/categories";
import WalletCard from "@/components/WalletCard";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import OrderPayDialog from "@/components/OrderPayDialog";
import CredentialsForm from "@/components/CredentialsForm";
import { useVisiblePolling } from "@/lib/useVisiblePolling";

const DASHBOARD_POLL_MS = 5000;

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
  orderNumber: string;
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

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading, openAuthModal, setUserName, setUser: setAuthUser } = useAuth();
  const [tab, setTab] = useState<TabId>("wallet");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chargeNotice, setChargeNotice] = useState<"success" | "failed" | "pending" | null>(null);
  const [orderNotice, setOrderNotice] = useState<"success" | "failed" | "pending" | null>(null);
  const {
    amountToman: chargeAmountToman,
    charging,
    error: chargeError,
    onAmountChange: onChargeAmountChange,
    setPreset: setChargePreset,
    startCharge: handleCharge,
  } = useWalletCharge(wallet ? Number(wallet.walletMinChargeRial) : null);

  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [downloadingItemId, setDownloadingItemId] = useState<string | null>(null);
  const [payOrderId, setPayOrderId] = useState<string | null>(null);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  // پرداخت مجدد سفارش «در انتظار پرداخت»: سرور تلاش پرداخت تازه می‌سازد و کاربر به درگاه می‌رود.
  // انصراف از سفارش پرداخت‌نشده: سفارش لغو می‌شود و از این فهرست کنار می‌رود.
  async function handleCancelOrder() {
    if (!cancelOrderId || cancelling) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${cancelOrderId}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "انصراف از سفارش ناموفق بود؛ دوباره تلاش کنید.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "انصراف از سفارش ناموفق بود؛ دوباره تلاش کنید.");
    } finally {
      setCancelOrderId(null);
      setCancelling(false);
      loadOrders();
    }
  }

  async function handleDownload(item: OrderItem) {
    if (!item.downloadUrl || downloadingItemId) return;
    setDownloadingItemId(item.id);
    try {
      const res = await fetch(item.downloadUrl);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        loadOrders();
        throw new Error(data?.error ?? "دانلود فایل با خطا مواجه شد؛ دوباره تلاش کنید.");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "دانلود فایل با خطا مواجه شد؛ دوباره تلاش کنید.");
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

  async function loadOrders() {
    try {
      const res = await fetch("/api/orders");
      if (!res.ok) return;
      const data = await res.json();
      setOrders(data.orders);
    } catch {
      // خطای به‌روزرسانی دوره‌ای بی‌اثر است؛ دفعه‌ی بعد دوباره تلاش می‌شود.
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
    const requestedTab = params.get("tab");
    if (TABS.some((t) => t.id === requestedTab)) {
      setTab(requestedTab as TabId);
      router.replace("/dashboard");
    }

    const charge = params.get("charge");
    if (charge === "success" || charge === "failed" || charge === "pending") {
      setChargeNotice(charge);
      setTab("wallet");
      router.replace("/dashboard");
    }

    // بازگشت از درگاه برای پرداخت مستقیم سفارش
    const order = params.get("order");
    if (order === "success" || order === "failed" || order === "pending") {
      setOrderNotice(order);
      setTab("orders");
      router.replace("/dashboard");
    }

    loadDashboard();
    loadSupportMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, router, openAuthModal]);

  // پیام‌ها و سفارش‌ها مرتب به‌روز می‌شوند تا فایل آماده یا پاسخ پشتیبانی بدون رفرش دیده شود.
  useVisiblePolling(
    () => {
      loadSupportMessages();
      loadOrders();
    },
    DASHBOARD_POLL_MS,
    !loading && !!user,
  );

  // با ورود کاربر، فیلد ویرایش نام با مقدار فعلی همگام می‌شود.
  useEffect(() => {
    setNameInput(user?.name ?? "");
  }, [user?.name]);

  // با باز شدن تب سفارش‌ها/پیام‌ها، اعلان‌های زنگوله‌ی همان بخش خوانده‌شده می‌شوند.
  useEffect(() => {
    if (tab !== "orders" && tab !== "messages") return;
    fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tab }),
    }).catch(() => {
      // بی‌اثر است؛ اعلان در زنگوله باقی می‌ماند.
    });
  }, [tab]);

  // با باز شدن تب پیام‌ها، پیام‌های خوانده‌نشده علامت خوانده‌شده می‌خورند.
  useEffect(() => {
    if (tab !== "messages" || !hasUnread) return;
    setHasUnread(false);
    fetch("/api/support/messages", { method: "PATCH" }).catch(() => {
      // بی‌اثر است؛ در بازخوانی بعدی دوباره تلاش می‌شود.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const minChargeTomanLabel = tomanLabel((wallet ? Number(wallet.walletMinChargeRial) : 1_000_000) / 10);

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
          <div className="flex items-center gap-3 mt-2">
            <h1 className="font-display text-[clamp(1.6rem,4vw,2.4rem)] font-extrabold min-w-0">سلام، {displayName}</h1>
            <ThemeToggle />
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <Link
            href="/affiliate"
            className="text-cyan text-[.9rem] font-semibold border border-[rgb(var(--c-cyan)/.3)] rounded-full px-3.5 py-1.5 hover:bg-[rgb(var(--c-cyan)/.08)] transition"
          >
            همکاری در فروش
          </Link>
          <Link href="/" className="text-dim text-[.9rem] hover:text-text transition">
            ← بازگشت به صفحه‌ی اصلی
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-2xl p-4 mb-6">
          {error}
        </div>
      )}

      {chargeNotice === "success" && (
        <div className="bg-[rgb(var(--c-cyan)/.1)] border border-[rgb(var(--c-cyan)/.3)] text-cyan rounded-2xl p-4 mb-6">
          شارژ کیف پول با موفقیت انجام شد.
        </div>
      )}
      {chargeNotice === "failed" && (
        <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-2xl p-4 mb-6">
          شارژ کیف پول ناموفق بود یا لغو شد.
        </div>
      )}

      {chargeNotice === "pending" && (
        <div className="bg-[rgb(var(--c-primary)/.1)] border border-[rgb(var(--c-primary2)/.3)] rounded-2xl p-4 mb-6">
          تأیید پرداخت با درگاه هنوز قطعی نشده است. اگر مبلغ از حساب شما کسر شده، چند دقیقه صبر کنید و سپس با پشتیبانی تماس بگیرید.
        </div>
      )}
      {orderNotice === "pending" && (
        <div className="bg-[rgb(var(--c-primary)/.1)] border border-[rgb(var(--c-primary2)/.3)] rounded-2xl p-4 mb-6">
          تأیید پرداخت با درگاه هنوز قطعی نشده است. اگر مبلغ از حساب شما کسر شده، چند دقیقه صبر کنید و سپس با پشتیبانی تماس بگیرید.
        </div>
      )}

      {orderNotice === "success" && (
        <div className="bg-[rgb(var(--c-cyan)/.1)] border border-[rgb(var(--c-cyan)/.3)] text-cyan rounded-2xl p-4 mb-6">
          پرداخت سفارش با موفقیت انجام شد و سفارش در صف پردازش قرار گرفت.
        </div>
      )}
      {orderNotice === "failed" && (
        <div className="bg-[rgb(var(--c-accent)/.1)] border border-[rgb(var(--c-accent)/.3)] text-accent2 rounded-2xl p-4 mb-6">
          پرداخت سفارش ناموفق بود یا لغو شد. سفارش در وضعیت «در انتظار پرداخت» باقی ماند.
        </div>
      )}

      {!user.hasPassword && tab !== "profile" && (
        <div className="flex items-center justify-between flex-wrap gap-3 bg-[rgb(var(--c-primary)/.1)] border border-[rgb(var(--c-primary2)/.3)] rounded-2xl p-4 mb-6">
          <span className="text-[.88rem]">برای ورود سریع‌تر بدون پیامک، ایمیل و رمز عبور تنظیم کن.</span>
          <button
            type="button"
            onClick={() => setTab("profile")}
            className="font-body cursor-pointer border-none font-bold text-[.85rem] text-white bg-gradient-to-br from-primary to-primary2 px-4 py-2 rounded-full whitespace-nowrap"
          >
            تنظیم ایمیل و رمز
          </button>
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
                : "bg-[rgb(var(--c-ov)/.04)] border-[rgb(var(--c-primary2)/.2)] text-dim hover:text-text hover:border-cyan")
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
                  حداقل شارژ {minChargeTomanLabel} تومان
                </div>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {CHARGE_PRESETS_TOMAN.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setChargePreset(amount)}
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
                  <div className="relative w-full sm:w-[220px]">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      dir="ltr"
                      placeholder="یا مبلغ دلخواه"
                      value={formatTomanInput(chargeAmountToman)}
                      onChange={(e) => onChargeAmountChange(e.target.value)}
                      className="bg-[rgba(255,255,255,.1)] border border-[rgba(255,255,255,.25)] text-white placeholder-[rgba(255,255,255,.6)] rounded-full pl-16 pr-4 py-2.5 text-[.9rem] w-full outline-none focus:border-white text-right"
                    />
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[.85rem] text-[rgba(255,255,255,.75)]">
                      تومان
                    </span>
                  </div>
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
                <div className="overflow-x-auto rounded-2xl border border-[rgb(var(--c-primary2)/.14)]">
                  <table className="w-full text-[.88rem] border-collapse min-w-[560px]">
                    <thead>
                      <tr className="bg-[rgb(var(--c-ov)/.04)] text-dim text-right">
                        <th className="p-3.5 font-semibold">نوع</th>
                        <th className="p-3.5 font-semibold">مبلغ</th>
                        <th className="p-3.5 font-semibold">موجودی پس از تراکنش</th>
                        <th className="p-3.5 font-semibold">توضیح</th>
                        <th className="p-3.5 font-semibold">تاریخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wallet.transactions.map((t) => (
                        <tr key={t.id} className="border-t border-[rgb(var(--c-primary2)/.1)]">
                          <td className="p-3.5">
                            <span
                              className={
                                "px-2.5 py-1 rounded-full text-[.78rem] font-bold " +
                                (t.type === "credit"
                                  ? "bg-[rgb(var(--c-cyan)/.12)] text-cyan"
                                  : "bg-[rgb(var(--c-accent)/.12)] text-accent2")
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
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-[20px_22px]"
                >
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span dir="ltr" className="latin font-bold text-[.85rem]">{o.orderNumber}</span>
                      <span className="text-dim text-[.78rem]">{toJalaliDate(o.createdAt)}</span>
                      {o.items.length > 1 && (
                        <span className="text-dim text-[.78rem]">· {o.items.length} آیتم</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-semibold text-[.95rem]">{o.priceLabel}</span>
                      <span className="px-3 py-1.5 rounded-full text-[.8rem] font-bold bg-[rgb(var(--c-ov)/.06)] border border-[rgb(var(--c-primary2)/.14)]">
                        {STATUS_LABELS[o.status]}
                      </span>
                      {o.status === "awaiting_payment" && (
                        <>
                        <button
                          type="button"
                          onClick={() => setPayOrderId(o.id)}
                          className="px-4 py-1.5 rounded-full text-[.8rem] font-bold bg-gradient-to-br from-primary to-primary2 text-white border-none cursor-pointer transition hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          پرداخت
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelOrderId(o.id)}
                          className="px-4 py-1.5 rounded-full text-[.8rem] font-bold text-dim hover:text-text bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] cursor-pointer transition disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          انصراف
                        </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
                    {o.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between flex-wrap gap-3 border-t border-[rgb(var(--c-primary2)/.1)] pt-2.5 first:border-t-0 first:pt-0"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap mb-1">
                            <span className="font-display font-bold text-[.92rem]">{categoryTitle(item.category)}</span>
                            <span className="text-dim text-[.8rem]">{item.sourceSite}</span>
                            <span
                              className={
                                "px-2.5 py-1 rounded-full text-[.74rem] font-bold " +
                                (item.status === "delivered"
                                  ? "bg-[rgb(var(--c-cyan)/.12)] text-cyan"
                                  : item.status === "ready"
                                    ? "bg-[rgb(var(--c-primary)/.16)] text-primary2"
                                    : "bg-[rgb(var(--c-ov)/.06)] text-dim")
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
          <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-[20px_22px]">
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
                        ? "self-start bg-[rgb(var(--c-primary2)/.16)] border border-[rgb(var(--c-primary2)/.24)]"
                        : "self-end bg-[rgb(var(--c-cyan)/.1)] border border-[rgb(var(--c-cyan)/.24)]")
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
                className="flex-1 min-w-[200px] bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] rounded-full px-4 py-2.5 text-[.9rem] outline-none focus:border-cyan"
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
          <div className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-[24px_26px] max-w-[480px]">
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
                  className="flex-1 min-w-[180px] bg-[rgb(var(--c-ov)/.04)] border border-[rgb(var(--c-primary2)/.2)] rounded-full px-4 py-2.5 text-[.9rem] outline-none focus:border-cyan"
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

          <div
            id="login-credentials"
            className="bg-gradient-to-br from-surface to-bg2 border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-[24px_26px] max-w-[480px] mt-5"
          >
            <h2 className="font-display text-[1.05rem] font-bold mb-1">ورود با ایمیل و رمز عبور</h2>
            <p className="text-dim text-[.82rem] mb-4">
              {user.hasPassword
                ? "برای تغییر ایمیل یا رمز، رمز فعلی را وارد کن. بعد از تغییر رمز، از بقیه‌ی دستگاه‌ها خارج می‌شوی."
                : "هنوز ایمیل و رمز نداری و هر بار با کد پیامکی وارد می‌شوی. با تنظیم آن‌ها، بدون انتظار برای پیامک وارد شو."}
            </p>
            <CredentialsForm
              key={user.hasPassword ? "change" : "set"}
              user={user}
              submitLabel={user.hasPassword ? "تغییر ایمیل / رمز" : "فعال‌سازی ورود با ایمیل"}
              onSaved={setAuthUser}
            />
          </div>
        </section>
      )}

      {payOrderId && (
        <OrderPayDialog
          orderId={payOrderId}
          onClose={() => setPayOrderId(null)}
          onPaid={() => {
            setPayOrderId(null);
            loadDashboard();
          }}
          onGoWallet={() => {
            setPayOrderId(null);
            setTab("wallet");
          }}
          onStale={loadOrders}
        />
      )}

      <ConfirmDialog
        open={cancelOrderId !== null}
        title="انصراف از سفارش"
        message="این سفارش پرداخت‌نشده لغو و از فهرست سفارش‌هایت حذف می‌شود. مبلغی از تو کسر نشده است."
        confirmLabel="انصراف از سفارش"
        busy={cancelling}
        onConfirm={handleCancelOrder}
        onCancel={() => setCancelOrderId(null)}
      />
    </div>
  );
}
