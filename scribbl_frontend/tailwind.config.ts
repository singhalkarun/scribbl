import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
        display: ["var(--font-lilita)", "cursive"],
      },
      colors: {
        cream: "#FFF8E7",
        coral: "#FF6B6B",
        "scribbl-yellow": "#FFEAA7",
        "scribbl-yellow-dark": "#FDCB6E",
        "scribbl-green": "#55EFC4",
        "scribbl-blue": "#74B9FF",
        "scribbl-purple": "#A29BFE",
        "scribbl-pink": "#FD79A8",
        ink: "#333333",
      },
      borderRadius: {
        "scribbl-lg": "20px",
        "scribbl-md": "14px",
        "scribbl-sm": "10px",
        "scribbl-xs": "8px",
      },
      boxShadow: {
        "scribbl-lg": "6px 6px 0 #333",
        "scribbl-md": "3px 3px 0 #333",
        "scribbl-sm": "2px 2px 0 #333",
        "scribbl-xs": "1px 1px 0 #333",
      },
    },
  },
  plugins: [],
};

export default config;
