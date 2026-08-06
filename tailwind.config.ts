import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f6f6",
          100: "#dce7e6",
          200: "#b6cfcd",
          300: "#8bb1ae",
          400: "#5c8b88",
          500: "#3d6d6a",
          600: "#2e5754",
          700: "#264644",
          800: "#1f3937",
          900: "#122120",
        },
      },
    },
  },
  plugins: [],
};

export default config;
