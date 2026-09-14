"use client";
import { toPersianDigits } from "@/lib/money";

export default function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 mt-5 text-[.82rem]">
      <span className="text-dim">
        {toPersianDigits(total.toLocaleString("en-US"))} نتیجه — صفحه‌ی {toPersianDigits(page)} از{" "}
        {toPersianDigits(totalPages)}
      </span>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-3.5 py-1.5 rounded-full border border-[rgba(138,124,255,.2)] bg-[rgba(255,255,255,.04)] text-dim hover:text-text transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          قبلی
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-3.5 py-1.5 rounded-full border border-[rgba(138,124,255,.2)] bg-[rgba(255,255,255,.04)] text-dim hover:text-text transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          بعدی
        </button>
      </div>
    </div>
  );
}
