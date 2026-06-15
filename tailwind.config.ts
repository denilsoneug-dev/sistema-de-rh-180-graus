import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      colors: {
        // Azul 180 — cor principal (do fundo da logo)
        brand: {
          50: "#EFF5FF", 100: "#DBE8FE", 200: "#BFD6FD", 300: "#93B8FA",
          400: "#5E93F2", 500: "#2D7BF0", 600: "#1A66DC", 700: "#1450AE",
          800: "#0F3E85", 900: "#0B2C5E",
        },
        // Laranja/coral — destaque (do paraquedas)
        accent: {
          50: "#FFF4ED", 100: "#FFE6D5", 200: "#FECBAA", 300: "#FDB07A",
          400: "#FB923C", 500: "#F97316", 600: "#EA580C", 700: "#C2410C",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)",
        card: "0 1px 3px rgba(15,23,42,0.05), 0 8px 24px -12px rgba(15,23,42,0.12)",
        lift: "0 8px 28px -8px rgba(26,102,220,0.28)",
        glow: "0 0 0 4px rgba(26,102,220,0.12)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out both",
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.22,1,0.36,1) both",
        "slide-in-left": "slide-in-left 0.4s ease-out both",
        float: "float 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
