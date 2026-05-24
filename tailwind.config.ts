import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17211c",
        moss: "#315542",
        leaf: "#4f7a5d",
        gold: "#c99b35",
        clay: "#9c5f47",
        paper: "#faf8f2"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 33, 28, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
