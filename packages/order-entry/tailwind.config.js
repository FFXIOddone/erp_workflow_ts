/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef3f2',
          100: '#fee4e2',
          200: '#fecdc8',
          300: '#fba6a2',
          400: '#f7726d',
          500: '#ed4c43',
          600: '#da2d26',
          700: '#b8211c',
          800: '#991f1b',
          900: '#7f201d',
          950: '#450c0a',
        },
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
};
