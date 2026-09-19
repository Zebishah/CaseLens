/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        muted: {
          DEFAULT: 'rgb(var(--muted-foreground) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)'
        },
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          hover: 'rgb(var(--primary-hover) / <alpha-value>)',
          muted: 'rgb(var(--primary) / 0.16)'
        },
        secondary: 'rgb(var(--secondary) / <alpha-value>)',
        highlight: 'rgb(var(--highlight) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        mist: 'rgb(var(--soft-blue) / <alpha-value>)',
        paper: '#f2f2f2',
        ink: {
          950: '#0A0D14',
          900: '#111722',
          800: '#182131',
          700: '#223044'
        },
        copper: {
          400: '#9B87FD',
          500: '#7C5CFC'
        }
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        panel: '0 24px 80px rgba(0, 0, 0, 0.35)',
        glow: '0 0 0 1px rgba(124, 92, 252, 0.16), 0 20px 60px rgba(10, 13, 20, 0.6)',
        lift: '0 18px 50px rgba(43, 103, 119, 0.12)',
        float: '0 28px 70px rgba(43, 103, 119, 0.16)'
      },
      borderRadius: {
        blob: '42% 58% 53% 47% / 48% 41% 59% 52%',
        '4xl': '2rem',
        '5xl': '2.75rem'
      }
    }
  },
  plugins: []
};
