/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'ai-website': '#0088FF',
        'ai-receptionist': '#00FF88',
        'ai-both': '#FFD700',
        danger: '#FF3B3B',
        warning: '#FF9500',
        'gone-cold': '#8B8BFF',
        'on-fire': '#FF6B00',
        card: '#111111',
        bg: '#0a0a0a',
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        dm: ['DM Sans', 'sans-serif'],
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.35s ease-out',
        'fade-scale': 'fadeScale 0.25s ease-out',
        'pulse-slow': 'pulse 2.5s ease-in-out infinite',
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        slideInRight: {
          from: { transform: 'translateX(110%)', opacity: 0 },
          to: { transform: 'translateX(0)', opacity: 1 },
        },
        slideInUp: {
          from: { transform: 'translateY(16px)', opacity: 0 },
          to: { transform: 'translateY(0)', opacity: 1 },
        },
        fadeScale: {
          from: { transform: 'scale(0.95)', opacity: 0 },
          to: { transform: 'scale(1)', opacity: 1 },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200px 0' },
          '100%': { backgroundPosition: 'calc(200px + 100%) 0' },
        },
      },
    },
  },
  plugins: [],
}
