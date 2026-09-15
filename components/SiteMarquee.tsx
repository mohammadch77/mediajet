import { ALL_SITES } from "@/data/categories";

export default function SiteMarquee() {
  const items = [...ALL_SITES, ...ALL_SITES];

  return (
    <div
      dir="ltr"
      className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
    >
      <div className="mj-marquee-track flex w-max items-center gap-3">
        {items.map((site, i) => (
          <div
            key={`${site}-${i}`}
            className="latin flex shrink-0 items-center gap-2 rounded-full border border-[rgba(138,124,255,.14)] bg-gradient-to-br from-surface to-bg2 px-5 py-3 text-[.92rem] font-bold text-text whitespace-nowrap"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-[rgba(138,124,255,.14)] text-[.72rem] font-bold text-cyan">
              {site.slice(0, 2)}
            </span>
            {site}
          </div>
        ))}
      </div>
    </div>
  );
}
