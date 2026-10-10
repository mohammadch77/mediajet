"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { rialToTomanLabel } from "@/lib/money";

function MockPaymentContent() {
  const params = useSearchParams();
  const authority = params.get("authority") ?? "";
  const callback = params.get("callback") ?? "";
  const amount = params.get("amount");

  function resolve(status: "OK" | "NOK") {
    if (!callback) return;
    const target = new URL(callback);
    target.searchParams.set("Authority", authority);
    target.searchParams.set("Status", status);
    window.location.href = target.toString();
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="max-w-sm w-full bg-surface border border-[rgb(var(--c-primary2)/.14)] rounded-2xl p-8 text-center">
        <div className="latin text-[.8rem] tracking-[.14em] uppercase text-cyan font-bold mb-2">
          Mock Gateway
        </div>
        <h1 className="font-display text-xl font-bold mb-1">درگاه پرداخت آزمایشی</h1>
        <p className="text-dim text-[.8rem] mb-6">
          این یک شبیه‌سازی است و پول واقعی جابه‌جا نمی‌شود.
        </p>

        {amount && (
          <div className="text-[1.3rem] font-display font-extrabold mb-6">
            {rialToTomanLabel(Number(amount))}
          </div>
        )}

        <div className="text-dim text-[.7rem] mb-6 break-all" dir="ltr">
          {authority}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => resolve("OK")}
            className="font-body cursor-pointer border-none font-bold text-white bg-gradient-to-br from-primary to-primary-deep py-3 rounded-full transition hover:-translate-y-px"
          >
            پرداخت موفق
          </button>
          <button
            onClick={() => resolve("NOK")}
            className="font-body cursor-pointer font-bold text-dim border border-[rgb(var(--c-primary2)/.3)] bg-transparent py-3 rounded-full transition hover:text-text"
          >
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MockPaymentPage() {
  return (
    <Suspense fallback={null}>
      <MockPaymentContent />
    </Suspense>
  );
}
