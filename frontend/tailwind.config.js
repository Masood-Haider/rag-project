/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#b9dffd',
          300: '#7cc2fd',
          400: '#36a1fa',
          500: '#0c85eb',
          600: '#0067c8',
          700: '#0152a3',
          800: '#054685',
          900: '#0a3a6e',
          950: '#06254a',
        }
      }
    },
  },
  plugins: [],
}

