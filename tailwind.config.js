/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Matches the customer app theme (lib/core/theme/app_theme.dart).
        brand: {
          50: '#FFF4EB',
          100: '#FFE4CC',
          200: '#FFC999',
          300: '#FFA866',
          400: '#FF8A33',
          500: '#FF6B00',
          600: '#E05E00',
          700: '#B84D00',
          800: '#8F3C00',
          900: '#662B00',
        },
        accent: '#FF9F1C',
        ink: '#1A1A1A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
