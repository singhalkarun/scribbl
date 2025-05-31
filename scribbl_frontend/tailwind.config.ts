import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    fontFamily: {
      sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
      mono: ["var(--font-jetbrains-mono)", "monospace"],
    },
    extend: {
      fontFamily: {
        outfit: ["var(--font-outfit)"],
        inter: ["var(--font-inter)"],
      },
      animation: {
        fadeIn: "fadeIn 0.5s ease-in-out",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
