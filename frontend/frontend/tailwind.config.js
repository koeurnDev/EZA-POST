/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      screens: {
        xs: "420px",
      },
      fontFamily: {
        sans: ["'Inter'", "'Kantumruy Pro'", "'Noto Sans Khmer'", "sans-serif"],
        khmer: ["'Kantumruy Pro'", "'Noto Sans Khmer'", "'Inter'", "sans-serif"],
        noto: ["'Noto Sans Khmer'", "'Kantumruy Pro'", "sans-serif"],
        kantumruy: ["'Kantumruy Pro'", "sans-serif"],
      },
      colors: {
        slate: {
          750: "#293548",
          850: "#172033",
        },
      },
    },
  },
  plugins: [],
};
