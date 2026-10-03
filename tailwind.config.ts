import type { Config } from "tailwindcss";

// رنگ‌ها از متغیرهای CSS در app/globals.css می‌آیند تا تم تیره/روشن بدون تغییر کلاس‌ها عوض شود.
const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"), bg2: v("bg2"), surface: v("surface"), surface2: v("surface2"),
        primary: v("primary"), primary2: v("primary2"), cyan: v("cyan"),
        accent: v("accent"), accent2: v("accent2"), text: v("text"), dim: v("dim"), muted: v("muted"),
        success: v("success"), danger: v("danger"), warning: v("warning"),
      },
      fontFamily: {
        display: ["Estedad", "Vazirmatn", "sans-serif"],
        body: ["Vazirmatn", "sans-serif"],
        latin: ["Space Grotesk", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
