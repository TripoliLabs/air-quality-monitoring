/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        aqi: {
          good: '#00e400',
          moderate: '#ffff00',
          'unhealthy-sensitive': '#ff7e00',
          unhealthy: '#ff0000',
          'very-unhealthy': '#8f3f97',
          hazardous: '#7e0023',
        },
      },
    },
  },
  plugins: [],
};
