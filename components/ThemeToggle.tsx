"use client";
import { useEffect, useState } from "react";
import { applyTheme, type Theme } from "@/lib/theme";

/** دکمه‌ی جابه‌جایی بین تم تیره و روشن. */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  const next: Theme = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
      aria-label={next === "light" ? "تم روشن" : "تم تیره"}
      title={next === "light" ? "تم روشن" : "تم تیره"}
      className={
        "shrink-0 w-9 h-9 grid place-items-center rounded-full bg-[rgb(var(--c-ov)/.06)] border border-[rgb(var(--c-primary2)/.14)] text-text cursor-pointer transition hover:bg-[rgb(var(--c-ov)/.12)] " +
        className
      }
    >
      {theme === "light" ? (
        <svg viewBox="0 0 24 24" fill="none" width="17" height="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" width="17" height="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  );
}
