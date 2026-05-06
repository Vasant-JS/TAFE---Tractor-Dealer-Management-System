/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#f7fbf1',
        surface: '#ffffff',
        'surface-container': '#ecefe6',
        'surface-container-low': '#f2f5ec',
        'on-surface': '#191d17',
        'on-surface-variant': '#41493e',
        outline: '#717a6d',
        'outline-variant': '#c0c9bb',
        secondary: '#8f4e00',
        accent: '#ff8f00',
        primary: {
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
        },
        tafe: {
          green: '#1B5E20',
          dark: '#0d3a12',
          light: '#4CAF50',
        }
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    }
  },
  plugins: [],
}
