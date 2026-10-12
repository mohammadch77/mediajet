import Link from "next/link";
import { toPersianDigits } from "@/lib/money";

/** شماره‌ی صفحه‌هایی که نمایش داده می‌شوند: اول، آخر، صفحه‌ی فعلی و همسایه‌هایش؛ بقیه «…». */
function pageItems(page: number, total: number): (number | "gap")[] {
  const keep = new Set<number>([1, total, page - 1, page, page + 1]);
  const nums = Array.from(keep).filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

/** صفحه‌بندی شماره‌دار با لینک واقعی (سئو‌پسند، بدون JS). hrefFor شماره‌ی صفحه را به آدرس تبدیل می‌کند. */
export default function BlogPagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (p: number) => string }) {
  if (totalPages <= 1) return null;
  const base = "grid h-10 min-w-10 place-items-center rounded-xl border px-3 text-[.86rem] font-bold transition";
  const idle = "border-[rgb(var(--c-primary2)/.25)] text-dim hover:text-text hover:border-[rgb(var(--c-primary2)/.6)]";
  const on = "border-transparent bg-gradient-to-br from-primary to-primary-deep text-on-solid";
  const off = "pointer-events-none border-[rgb(var(--c-ov)/.1)] text-muted opacity-50";
  return (
    <nav aria-label="صفحه‌بندی مقاله‌ها" className="mt-12 flex flex-col items-center gap-3">
      <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-1.5 p-0 sm:gap-2">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} rel="prev" aria-label="صفحه‌ی قبل" className={`${base} ${idle}`}>
              <span aria-hidden>→</span>
            </Link>
          ) : (
            <span aria-hidden className={`${base} ${off}`}>→</span>
          )}
        </li>
        {pageItems(page, totalPages).map((it, i) =>
          it === "gap" ? (
            <li key={`g${i}`} aria-hidden className="px-1 text-muted">…</li>
          ) : (
            <li key={it}>
              <Link href={hrefFor(it)} aria-label={`صفحه‌ی ${toPersianDigits(it)}`} aria-current={it === page ? "page" : undefined} className={`${base} ${it === page ? on : idle}`}>
                {toPersianDigits(it)}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <Link href={hrefFor(page + 1)} rel="next" aria-label="صفحه‌ی بعد" className={`${base} ${idle}`}>
              <span aria-hidden>←</span>
            </Link>
          ) : (
            <span aria-hidden className={`${base} ${off}`}>←</span>
          )}
        </li>
      </ul>
      <p className="m-0 text-[.78rem] text-muted">
        صفحه‌ی {toPersianDigits(page)} از {toPersianDigits(totalPages)}
      </p>
    </nav>
  );
}
