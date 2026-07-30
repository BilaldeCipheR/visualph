import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#171717",
        canvas: "#f6f1e8",
        accent: "#ff5c35",
        accentSoft: "#ffd9c7",
        spruce: "#204336"
      },
      boxShadow: {
        card: "0 22px 50px -28px rgba(23, 23, 23, 0.38)"
      }
    }
  },
  plugins: []
};

export default config;
