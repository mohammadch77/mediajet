import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#080A15", bg2: "#0D1020", surface: "#141833", surface2: "#1B2145",
        primary: "#6B5BFF", primary2: "#8A7CFF", cyan: "#38E1FF",
        accent: "#FF6B35", accent2: "#FF9A5C", text: "#EEF0FB", dim: "#98A0C8",
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
