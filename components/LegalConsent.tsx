"use client";
import { LEGAL_LINKS } from "@/lib/legal";

type LegalKey = keyof typeof LEGAL_LINKS;

/**
 * چک‌باکس رضایت با لینک به صفحه‌های حقوقی. همیشه کنترل‌شده و از پیش تیک‌نخورده است
 * (مقدار اولیه را والد با useState(false) می‌دهد).
 */
export default function LegalConsent({
  checked,
  onChange,
  keys,
  lead,
  name = "acceptTerms",
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  keys: LegalKey[];
  /** متن پیش از لینک‌ها؛ پیش‌فرض خالی. */
  lead?: string;
  name?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2.5 text-[.84rem] text-dim leading-[1.8] cursor-pointer text-start">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1.5 w-4 h-4 shrink-0 accent-[rgb(var(--c-primary))] cursor-pointer"
      />
      <span>
        {lead}
        {keys.map((k, i) => (
          <span key={k}>
            {i > 0 && (i === keys.length - 1 ? " و " : "، ")}
            <a href={LEGAL_LINKS[k].href} target="_blank" rel="noopener noreferrer" className="text-cyan underline">
              {LEGAL_LINKS[k].label}
            </a>
          </span>
        ))}{" "}
        را خوانده‌ام و می‌پذیرم.
      </span>
    </label>
  );
}
