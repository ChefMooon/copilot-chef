import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/renderer/**/*.{ts,tsx}", "./src/renderer/index.html"],
  theme: {
    extend: {
      colors: {
          green: {
            DEFAULT: "rgb(var(--green-rgb) / <alpha-value>)",
            light: "rgb(var(--green-light-rgb) / <alpha-value>)",
            pale: "rgb(var(--green-pale-rgb) / <alpha-value>)",
          },
          cream: {
            DEFAULT: "rgb(var(--cream-rgb) / <alpha-value>)",
            dark: "rgb(var(--cream-dark-rgb) / <alpha-value>)",
          },
          orange: {
            DEFAULT: "rgb(var(--orange-rgb) / <alpha-value>)",
            light: "rgb(var(--orange-light-rgb) / <alpha-value>)",
          },
          text: {
            DEFAULT: "rgb(var(--text-rgb) / <alpha-value>)",
            muted: "rgb(var(--text-muted-rgb) / <alpha-value>)",
          },
          white: "rgb(var(--white-rgb) / <alpha-value>)",
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
