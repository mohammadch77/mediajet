"use client";
// Context سراسری برای وضعیت ورود کاربر در کل اپ.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type AuthUser = { id: string; mobile: string; role: "user" | "operator" | "admin"; walletBalanceRial: string };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
  setWalletBalance: (walletBalanceRial: string) => void;
  authModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  /** اگر کاربر وارد نباشد، مودال ورود را باز می‌کند و پس از ورود موفق resolve می‌شود؛ اگر بسته شود reject می‌شود. */
  requireAuth: () => Promise<AuthUser>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const pendingRef = useRef<{ resolve: (u: AuthUser) => void; reject: () => void } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback((u: AuthUser) => {
    setUser(u);
    setAuthModalOpen(false);
    pendingRef.current?.resolve(u);
    pendingRef.current = null;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const setWalletBalance = useCallback((walletBalanceRial: string) => {
    setUser((u) => (u ? { ...u, walletBalanceRial } : u));
  }, []);

  const openAuthModal = useCallback(() => setAuthModalOpen(true), []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    pendingRef.current?.reject();
    pendingRef.current = null;
  }, []);

  const requireAuth = useCallback((): Promise<AuthUser> => {
    if (user) return Promise.resolve(user);
    return new Promise<AuthUser>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
      setAuthModalOpen(true);
    });
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refresh,
        login,
        logout,
        setWalletBalance,
        authModalOpen,
        openAuthModal,
        closeAuthModal,
        requireAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth باید داخل AuthProvider استفاده شود.");
  }
  return ctx;
}
