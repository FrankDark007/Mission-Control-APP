/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        google: {
          blue: '#1a73e8',
          red: '#ea4335',
          yellow: '#fbbc04',
          green: '#34a853',
        },
        dark: {
          900: '#202124',
          800: '#292a2d',
          700: '#3c4043',
          600: '#4a4d51',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      screens: {
        'xs': '375px',
      },
      spacing: {
        'safe': 'env(safe-area-inset-bottom)',
      },
      animation: {
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-out-left': 'slideOutLeft 0.3s ease-in',
      },
      keyframes: {
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}