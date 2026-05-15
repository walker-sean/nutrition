/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#111111',
        surface: '#1a1a1a',
        card: '#252525',
        border: '#2a2a2a',
        muted: '#666666',
        subtle: '#888888',
        accent: '#6ee7b7',
        protein: '#60a5fa',
        carbs: '#fbbf24',
        fat: '#f87171',
      },
    },
  },
  plugins: [],
};
