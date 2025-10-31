/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      boxShadow: { 'soft': '0 10px 30px rgba(2,6,23,0.08)' }
    },
  },
  plugins: [],
};
