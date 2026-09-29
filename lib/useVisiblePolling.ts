"use client";
import { useEffect, useRef } from "react";

/**
 * تا وقتی enabled است و تب مرورگر دیده می‌شود، callback را هر intervalMs یک‌بار صدا می‌زند؛
 * با برگشتن به تب، بلافاصله یک‌بار اجرا می‌شود. در تب پنهان درخواستی به سرور نمی‌رود.
 */
export function useVisiblePolling(callback: () => void, intervalMs: number, enabled: boolean): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const tick = () => callbackRef.current();
    const start = () => {
      if (!intervalId) intervalId = setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = null;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        tick();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
