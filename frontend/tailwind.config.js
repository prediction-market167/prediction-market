/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#070b14',
          800: '#0d1424',
          700: '#131d30',
          600: '#1a2540',
          500: '#243556',
        },
        brand: {
          cyan: '#00c8ff',
          blue: '#2563eb',
          purple: '#7c3aed',
        },
        yes: {
          DEFAULT: '#10b981',
          dark: '#059669',
        },
        no: {
          DEFAULT: '#ef4444',
          dark: '#dc2626',
        },
        ink: {
          100: '#f0f4ff',
          200: '#c8d4f0',
          400: '#8a9cc0',
          600: '#4a5a7a',
          800: '#2a3550',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #00c8ff 0%, #2563eb 60%, #7c3aed 100%)',
        'gradient-yes': 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
        'gradient-no': 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.3)',
        'card-hover': '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,200,255,0.15)',
        'glow-cyan': '0 0 24px rgba(0,200,255,0.25)',
        'glow-yes': '0 0 20px rgba(16,185,129,0.35)',
        'glow-no': '0 0 20px rgba(239,68,68,0.35)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out both',
        'spin-slow': 'spin 1.2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
