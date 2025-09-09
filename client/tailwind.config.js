import defaultTheme from 'tailwindcss/defaultTheme'
import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        slate: colors.slate, // re-enable old "slate" palette
      },
    },
  },
  plugins: [],
}
