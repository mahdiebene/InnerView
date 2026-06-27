import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm, introspective palette; each entry "tints" the UI with its own palette.
        ink: {
          50: "#f6f5f3",
          100: "#e9e6e1",
          900: "#161513",
          950: "#0c0b0a",
        },
        paper: "#fbf9f5",
        accent: "#b4814e",
      },
      fontFamily: {
        serif: ['"Iowan Old Style"', "Palatino", "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-468px 0" },
          "100%": { backgroundPosition: "468px 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
