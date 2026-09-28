/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#166534',
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
          hover: '#14532d',
          active: '#0f3d21',
        },
        cream: {
          DEFAULT: '#FEF3C7',
          50: '#fffdf5',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          border: '#fde68a',
          text: '#78350f',
        },
        secondary: {
          DEFAULT: '#FEF3C7',
          50: '#fffdf5',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          border: '#fde68a',
          text: '#166534',
          hover: '#fde68a',
        },
        // Harmonize legacy blue utility classes with Deep Green & Cream / Mint palette
        blue: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#16a34a',
          600: '#166534', // Deep Green primary
          700: '#14532d',
          800: '#14532d',
          900: '#052e16',
          950: '#021e0e',
        },
      },
    },
  },
  plugins: [],
}
