import type { Config } from "tailwindcss";

/**
 * Токены по референсу rollypay (~/.claude/design-refs/rollypay):
 * фон #F4F5F7, белые панели, одна двухслойная тень, один синий акцент,
 * мягкие бейджи. Акцент и вторичные серые затемнены до контраста 4.5:1.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["var(--font-golos)", "system-ui", "sans-serif"] },
      colors: {
        page: "#f4f5f7",
        panel: "#ffffff",
        tint: "#f3f4f6",
        line: "#e3e6eb",
        field: "#cfd4dc",
        ink: { DEFAULT: "#171a20", 2: "#4f586b", 3: "#626a7a" },
        brand: { DEFAULT: "#2b65e8", dark: "#1f53c7", soft: "#eef3ff", text: "#1f56d0" },
        ok: { DEFAULT: "#147a41", bg: "#eaf9ef" },
        warn: { DEFAULT: "#7a4a00", bg: "#fff4dc" },
        err: { DEFAULT: "#c42b2b", bg: "#fdeeee" },
      },
      borderRadius: { panel: "28px", card: "24px", md2: "16px" },
      boxShadow: {
        card: "0 1px 2px rgba(14,17,23,.04), 0 20px 36px -26px rgba(14,17,23,.16)",
        cta: "inset 0 1px 0 rgba(255,255,255,.28), 0 6px 16px -6px rgba(43,101,232,.55)",
      },
    },
  },
  plugins: [],
};

export default config;
