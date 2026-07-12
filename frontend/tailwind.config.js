/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0B0F17',
        'bg-secondary': '#111827',
        'bg-panel': '#1A1F2E',
        'border-dim': '#27282B',
        'text-pri': '#F1F5F9',
        'text-sec': '#94A3B8',
        'text-dim': '#66666E',
      }
    },
  },
  plugins: [],
}
