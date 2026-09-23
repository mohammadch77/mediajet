"use client";
import { useRef, useState, useCallback, type ReactNode } from "react";

export default function WalletCard({
  balanceLabel,
  eyebrowLabel = "موجودی فعلی",
  badgeLabel = "کیف پول من",
  children,
}: {
  balanceLabel: ReactNode;
  eyebrowLabel?: ReactNode;
  badgeLabel?: ReactNode;
  children?: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50 });
  const [active, setActive] = useState(false);

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const ry = (px - 0.5) * 14;
      const rx = (0.5 - py) * 10;
      setTilt({ rx, ry, mx: px * 100, my: py * 100 });
    });
  }, []);

  const handleLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTilt({ rx: 0, ry: 0, mx: 50, my: 50 });
    setActive(false);
  }, []);

  return (
    <div
      className="wallet-card-perspective"
      style={{ perspective: "1200px" }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMove}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={handleLeave}
        className="wallet-card relative rounded-[24px] p-[28px_26px] sm:p-[32px_34px] mb-6 overflow-hidden select-none transition-shadow duration-300"
        style={{
          transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(${active ? 1.015 : 1})`,
          transformStyle: "preserve-3d",
          background:
            "linear-gradient(135deg,#6B5BFF 0%,#4536C7 45%,#2A2470 75%,#FF6B35 130%)",
          boxShadow: active
            ? "0 35px 90px -25px rgba(107,91,255,.55), 0 15px 40px -15px rgba(255,107,53,.35), inset 0 1px 0 rgba(255,255,255,.15)"
            : "0 25px 70px -30px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.1)",
        }}
      >
        {/* glossy sheen following the cursor */}
        <div
          className="pointer-events-none absolute inset-0 opacity-0 wallet-card-sheen"
          style={{
            opacity: active ? 1 : 0,
            background: `radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, rgba(255,255,255,.25), rgba(255,255,255,0) 55%)`,
            transition: "opacity .3s ease",
          }}
        />
        {/* soft decorative blobs for depth */}
        <div
          className="pointer-events-none absolute -top-10 -left-10 w-40 h-40 rounded-full opacity-40 blur-2xl"
          style={{ background: "radial-gradient(circle,#38E1FF,transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-14 -right-8 w-48 h-48 rounded-full opacity-30 blur-2xl"
          style={{ background: "radial-gradient(circle,#FF9A5C,transparent 70%)" }}
        />

        <div style={{ transform: "translateZ(40px)", transformStyle: "preserve-3d" }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[rgba(255,255,255,.85)] text-[.9rem]">{eyebrowLabel}</span>
            <span
              className="text-[.72rem] font-bold px-2.5 py-1 rounded-full text-white/90"
              style={{
                background: "rgba(255,255,255,.14)",
                border: "1px solid rgba(255,255,255,.25)",
                backdropFilter: "blur(4px)",
              }}
            >
              {badgeLabel}
            </span>
          </div>
          <div
            className="font-display text-[2rem] sm:text-[2.3rem] font-extrabold mt-1.5 text-white"
            dir="rtl"
            style={{ textShadow: "0 4px 20px rgba(0,0,0,.35)" }}
          >
            {balanceLabel}
          </div>

          {children && <div className="mt-6" style={{ transform: "translateZ(20px)" }}>{children}</div>}
        </div>
      </div>

      <style jsx>{`
        .wallet-card {
          will-change: transform;
          transition: transform 0.08s linear, box-shadow 0.3s ease;
        }
        @media (prefers-reduced-motion: reduce) {
          .wallet-card {
            transform: none !important;
            transition: none !important;
          }
          .wallet-card-sheen {
            display: none !important;
          }
        }
        @media (hover: none) {
          .wallet-card {
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}
