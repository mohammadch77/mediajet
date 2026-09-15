"use client";
// Context سراسری برای وضعیت سبد خرید (فقط تعداد آیتم‌ها برای نشانگر هدر + متد افزودن/بازخوانی؛
// جزئیات آیتم‌ها خودِ صفحه‌ی سبد جداگانه می‌خواند).

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";

type CartContextValue = {
  count: number;
  refresh: () => Promise<void>;
  /** بعد از افزودن موفق آیتم در جای دیگر (مثل OrderDrawer)، شمارشگر را به‌روز کن. */
  bumpCount: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const res = await fetch("/api/cart");
      if (!res.ok) return;
      const data = await res.json();
      setCount(data.items?.length ?? 0);
    } catch {
      // خطای بازخوانی سبد بی‌اثر است؛ نشانگر همان مقدار قبلی را نگه می‌دارد.
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const bumpCount = useCallback(() => setCount((c) => c + 1), []);

  return <CartContext.Provider value={{ count, refresh, bumpCount }}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart باید داخل CartProvider استفاده شود.");
  }
  return ctx;
}
