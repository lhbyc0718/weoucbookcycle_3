/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6', // Similar to WeChat Blue
        secondary: '#10B981', // Similar to WeChat Green
        background: '#F3F4F6', // Light gray background
      },
    },
  },
  plugins: [],
}
