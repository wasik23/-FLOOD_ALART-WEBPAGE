/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#006A4E',
          50: '#E5F6F1',
          100: '#C7ECE2',
          200: '#91D8C6',
          300: '#5BC2A8',
          400: '#25A886',
          500: '#006A4E',
          600: '#005F46',
          700: '#00503B',
          800: '#003F2F',
          900: '#002E22',
        },
        accent: {
          DEFAULT: '#F42A41',
          50: '#FFE8EB',
          100: '#FFD1D7',
          200: '#FFA3AE',
          300: '#FF7486',
          400: '#FA4A5F',
          500: '#F42A41',
          600: '#D9172D',
          700: '#AE1022',
          800: '#840B19',
          900: '#5A0711',
        },
      },
      boxShadow: {
        soft: '0 18px 45px rgba(0, 106, 78, 0.14)',
      },
    },
  },
  plugins: [],
}
