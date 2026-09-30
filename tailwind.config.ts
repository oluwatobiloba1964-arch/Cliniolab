import type { Config } from 'tailwindcss';

/**
 * Cliniolab design tokens.
 * Palette grounded in clinical instrumentation (chart navy, pulse teal,
 * flag amber, muted critical red) rather than generic SaaS blue or
 * templated cream+terracotta.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0B1F2E',
          50: '#EEF3F5',
          100: '#D7E1E6',
          200: '#AFC3CC',
          300: '#87A5B3',
          400: '#4C7386',
          500: '#1E3A4C',
          600: '#15303F',
          700: '#0F2531',
          800: '#0B1F2E',
          900: '#071620',
        },
        pulse: {
          50: '#EAF6F2',
          100: '#CDEAE0',
          200: '#9BD5C2',
          300: '#69C0A3',
          400: '#3FA98B',
          500: '#2F8F7A',
          600: '#25725F',
          700: '#1C5647',
          800: '#133A2F',
          900: '#0A1F18',
        },
        flag: {
          50: '#FDF3E2',
          100: '#FAE3B8',
          200: '#F5CB80',
          300: '#EEB35C',
          400: '#E8A33D',
          500: '#D4892A',
          600: '#B06F1F',
          700: '#835419',
        },
        critical: {
          50: '#FBEAE7',
          100: '#F2C7BE',
          200: '#E19686',
          300: '#D0685A',
          400: '#C4442E',
          500: '#A93624',
          600: '#82291B',
        },
        paper: '#F7F5F0',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'chart-strip':
          'repeating-linear-gradient(90deg, currentColor 0, currentColor 1px, transparent 1px, transparent 8px)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
