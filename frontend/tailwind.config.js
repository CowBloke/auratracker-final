/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark cyber/gaming theme
        background: {
          DEFAULT: '#0a0e17',
          secondary: '#111827',
          tertiary: '#1f2937',
        },
        surface: {
          DEFAULT: '#161f2d',
          hover: '#1e293b',
          active: '#283548',
        },
        primary: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
          light: '#a5b4fc',
        },
        accent: {
          cyan: '#22d3ee',
          pink: '#f472b6',
          orange: '#fb923c',
          green: '#4ade80',
        },
        aura: {
          DEFAULT: '#a855f7',
          light: '#c084fc',
          glow: '#d946ef',
        },
        money: {
          DEFAULT: '#fbbf24',
          light: '#fcd34d',
        },
      },
      fontFamily: {
        display: ['Orbitron', 'sans-serif'],
        body: ['Rajdhani', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(168, 85, 247, 0.6)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(99, 102, 241, 0.4)',
        'glow-aura': '0 0 20px rgba(168, 85, 247, 0.4)',
        'glow-money': '0 0 20px rgba(251, 191, 36, 0.4)',
      },
    },
  },
  plugins: [],
};
