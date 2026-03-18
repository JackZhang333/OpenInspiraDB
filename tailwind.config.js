/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./renderer/index.html",
    "./renderer/src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        moss: "#4e6958",
        clay: "#d4d9ce",
        ink: "#2d2d2d",
        "soft-gray": "#f3f5f0",
        "off-white": "#fafbf8",
      },
      borderRadius: {
        'zen': '18px',
        'zen-sm': '12px',
      },
      boxShadow: {
        'zen': '0 8px 30px -8px rgba(78, 105, 88, 0.12)',
        'zen-hover': '0 14px 40px -10px rgba(78, 105, 88, 0.18)',
      }
    },
  },
  plugins: [],
};
