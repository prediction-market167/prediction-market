/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          900: '#08031a',
          800: '#0f0628',
          700: '#180d3d',
          600: '#261960',
          500: '#362585',
        },
        gold: {
          DEFAULT: '#f5c518',
          light:   '#fde68a',
          dark:    '#b45309',
        },
        brand: {
          cyan:   '#c084fc',
          blue:   '#7c3aed',
          purple: '#a855f7',
        },
        yes:  { DEFAULT: '#10b981', dark: '#059669' },
        no:   { DEFAULT: '#ef4444', dark: '#dc2626' },
        ink: {
          100: '#ffffff',
          200: '#f0e8ff',
          400: '#c4b5fd',
          500: '#9d8fcc',
          600: '#6b5fa0',
          700: '#4a3d7a',
          800: '#2e2458',
        },
      },
      backgroundImage: {
        'gradient-brand':  'linear-gradient(135deg, #f5c518 0%, #f59e0b 40%, #d97706 100%)',
        'gradient-gold':   'linear-gradient(135deg, #fde68a 0%, #f5c518 50%, #b45309 100%)',
        'gradient-purple': 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%)',
        'gradient-yes':    'linear-gradient(90deg, #10b981 0%, #059669 100%)',
        'gradient-no':     'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
      },
      boxShadow: {
        card:          '0 2px 8px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.2)',
        'card-hover':  '0 4px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(245,197,24,0.4)',
        'glow-gold':   '0 0 24px rgba(245,197,24,0.5), 0 0 48px rgba(245,197,24,0.2)',
        'glow-purple': '0 0 24px rgba(168,85,247,0.5), 0 0 48px rgba(168,85,247,0.2)',
        'glow-cyan':   '0 0 20px rgba(192,132,252,0.4)',
        'glow-yes':    '0 0 20px rgba(16,185,129,0.4)',
        'glow-no':     '0 0 20px rgba(239,68,68,0.4)',
        'nav-active':  '0 0 20px rgba(245,197,24,0.6)',
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-up':   'slideUp 0.4s ease-out both',
        'spin-slow':  'spin 1.2s linear infinite',
        'shimmer':    'shimmer 2s linear infinite',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'bounce-in':  'bounceIn 0.5s cubic-bezier(0.36,0.07,0.19,0.97)',
        'float':      'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulseGold: { '0%,100%': { textShadow: '0 0 20px rgba(245,197,24,0.8)' }, '50%': { textShadow: '0 0 40px rgba(245,197,24,1), 0 0 80px rgba(245,197,24,0.4)' } },
        bounceIn:  { '0%': { transform: 'scale(0.8)', opacity: '0' }, '60%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        float:     { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
