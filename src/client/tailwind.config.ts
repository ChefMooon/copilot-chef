import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        green: { DEFAULT: "#3B5E45", light: "#5A7D63", pale: "#D4E4D8" },
        cream: { DEFAULT: "#F5F0E8", dark: "#EDE6D6" },
        orange: { DEFAULT: "#C5622A", light: "#E8885A" },
        text: { DEFAULT: "#2C2416", muted: "#7A6A58" },
        white: "#FFFDF8",
      },
      fontFamily: {
        serif: ["Georgia", "serif"],
        sans: ["system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        btn: "10px",
        chip: "20px",
      },
      boxShadow: {
        card: "0 2px 12px rgba(44,36,22,0.10)",
        lg: "0 6px 28px rgba(44,36,22,0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
