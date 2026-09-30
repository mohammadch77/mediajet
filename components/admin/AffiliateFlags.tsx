"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toJalaliDateTime } from "@/lib/jalali";
import Pagination from "@/components/admin/Pagination";

type Flag = {
  id: string;
  kindLabel: string;
  detail: string;
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  resolvedByMobile: string | null;
  affiliate: { id: string; mobile: string; code: string | null; suspended: boolean };
};

const card = "bg-gradient-to-br from-surface to-bg2 border border-[rgba(138,124,255,.14)] rounded-2xl";

/**
 * لیست هشدارهای تقلب با امکان بستن (نتیجه‌ی بررسی). اگر affiliateId داده شود فقط هشدارهای همان همکار.
 * onChanged بعد از بستن هر هشدار صدا زده می‌شود (مثلاً برای تازه‌کردن شمارنده‌ها).
 */
export default function AffiliateFlags({ affiliateId, onChanged }: { affiliateId?: string; onChanged?: () => void }) {
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Flag[]; total: number; page: number; totalPages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ status, page: String(page), ...(affiliateId && { affiliateId }) });
      const res = await fetch(`/api/admin/affiliate/flags?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا در دریافت هشدارها.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت هشدارها.");
    }
  }, [status, page, affiliateId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["open", "resolved"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={
              "px-3.5 py-1.5 rounded-full text-[.82rem] font-bold border transition " +
              (status === s
                ? "bg-gradient-to-br from-primary to-primary2 text-white border-transparent"
                : "bg-[rgba(255,255,255,.04)] border-[rgba(138,124,255,.2)] text-dim hover:text-text")
            }
          >
            {s === "open" ? "باز" : "بسته‌شده"}
          </button>
        ))}
      </div>
      <p className="text-dim text-[.78rem] mb-4 leading-[1.9]">
        هشدارها خودکار ساخته می‌شوند و چیزی را مسدود نمی‌کنند؛ IP در ایران زیاد مشترک است (اینترنت موبایل، VPN)، پس قبل از
        تعلیق یا رد تسویه، زیرمجموعه‌ها و سفارش‌ها را بررسی کن.
      </p>
      {error && <div className="text-accent2 mb-3">{error}</div>}
      {!data ? (
        <div className="text-dim">در حال بارگذاری...</div>
      ) : data.items.length === 0 ? (
        <div className="text-dim text-[.88rem]">{status === "open" ? "هشدار بازی نیست ✓" : "هشدار بسته‌شده‌ای نیست."}</div>
      ) : (
        <>
          <div className="grid gap-3">
            {data.items.map((f) => (
              <FlagCard
                key={f.id}
                flag={f}
                showAffiliate={!affiliateId}
                onResolved={async () => {
                  await load();
                  onChanged?.();
                }}
              />
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}

function FlagCard({ flag: f, showAffiliate, onResolved }: { flag: Flag; showAffiliate: boolean; onResolved: () => Promise<void> }) {
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function resolve() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/affiliate/flags/${f.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "بستن هشدار ناموفق بود.");
      await onResolved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "بستن هشدار ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${card} p-4 ${f.resolvedAt ? "" : "border-[rgba(255,107,53,.35)]"}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
        <span className="font-bold text-[.9rem]">{f.resolvedAt ? "✓" : "🚨"} {f.kindLabel}</span>
        <span className="text-dim text-[.75rem]">{toJalaliDateTime(f.createdAt)}</span>
      </div>
      {showAffiliate && (
        <div className="text-[.82rem] mb-1">
          <span className="text-dim">همکار: </span>
          <Link href={`/admin/affiliate/${f.affiliate.id}`} className="text-cyan hover:underline">
            <bdi>{f.affiliate.mobile}</bdi>
            {f.affiliate.code && (
              <>
                {" · "}
                <bdi className="latin">{f.affiliate.code}</bdi>
              </>
            )}
          </Link>
          {f.affiliate.suspended && <span className="text-accent2 text-[.75rem]"> (معلق)</span>}
        </div>
      )}
      <div className="text-[.84rem] leading-[1.9]">{f.detail}</div>
      {f.resolvedAt ? (
        <div className="text-dim text-[.78rem] mt-2">
          نتیجه: {f.resolution} · <span dir="ltr">{f.resolvedByMobile}</span> · {toJalaliDateTime(f.resolvedAt)}
        </div>
      ) : (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="نتیجه‌ی بررسی (مثلاً: خانواده‌ی همکار، مشکلی نیست)"
            className="flex-1 min-w-0 font-body text-[.86rem] text-text bg-bg border border-[rgba(138,124,255,.14)] rounded-xl p-[9px_12px] focus:border-primary outline-none"
          />
          <button
            onClick={resolve}
            disabled={busy}
            className="font-bold rounded-xl px-4 py-2 text-[.84rem] bg-[rgba(61,220,132,.16)] text-[#3ddc84] border border-[rgba(61,220,132,.35)] disabled:opacity-60 shrink-0"
          >
            بستن هشدار
          </button>
        </div>
      )}
      {err && <div className="text-accent2 text-[.8rem] mt-2">{err}</div>}
    </div>
  );
}
