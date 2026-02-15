/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'app-bg': '#F6FAF7',
        primary: '#22C55E',
        mint: '#A7F3D0'
      },
      boxShadow: {
        soft: '0 10px 25px -15px rgba(21, 128, 61, 0.3)'
      }
    }
  },
  plugins: []
};
