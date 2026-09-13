"use client";
import { useMemo } from "react";
import { detectFromLink, type LinkDetection } from "./linkDetect";

/** هوک مشترک تشخیص سایت/دسته از روی لینک — هم در فیلد صفحه‌ی اصلی و هم در دراور استفاده می‌شود. */
export function useLinkDetect(link: string): LinkDetection {
  return useMemo(() => detectFromLink(link), [link]);
}
