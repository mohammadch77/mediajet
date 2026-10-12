"use client";
import { useEffect } from "react";

/** پس از بارگذاری صفحه یک بازدید ثبت می‌کند (ربات‌های بدون JS شمرده نمی‌شوند). چیزی نمایش نمی‌دهد. */
export default function BlogViewCounter({ slug }: { slug: string }) {
  useEffect(() => {
    fetch(`/api/blog/${slug}/view`, { method: "POST", keepalive: true }).catch(() => {});
  }, [slug]);
  return null;
}
