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
        accentSoft: "#ffd9c7",
        spruce: "#204336",
        border: "hsl(20 5.9% 90%)",
        input: "hsl(20 5.9% 90%)",
        ring: "hsl(24 5.7% 82.9%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(20 14.3% 4.1%)",
        primary: {
          DEFAULT: "#171717",
          foreground: "hsl(60 9.1% 97.8%)",
        },
        secondary: {
          DEFAULT: "hsl(20 5.9% 90%)",
          foreground: "hsl(24 9.8% 10%)",
        },
        destructive: {
          DEFAULT: "hsl(0 84.2% 60.2%)",
          foreground: "hsl(60 9.1% 97.8%)",
        },
        muted: {
          DEFAULT: "hsl(20 5.9% 90%)",
          foreground: "hsl(25 5.3% 44.7%)",
        },
        accent: {
          DEFAULT: "#ff5c35",
          foreground: "hsl(24 9.8% 10%)",
        },
        popover: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(20 14.3% 4.1%)",
        },
        card: {
          DEFAULT: "hsl(0 0% 100%)",
          foreground: "hsl(20 14.3% 4.1%)",
        },
      },
      borderRadius: {
        lg: "0.5rem",
        md: "calc(0.5rem - 2px)",
        sm: "calc(0.5rem - 4px)",
      },
      boxShadow: {
        card: "0 22px 50px -28px rgba(23, 23, 23, 0.38)"
      }
    }
  },
  plugins: []
};

export default config;
