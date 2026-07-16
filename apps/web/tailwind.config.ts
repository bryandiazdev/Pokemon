import type { Config } from 'tailwindcss';

const withAlpha = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: withAlpha('--bg'),
        'bg-deep': withAlpha('--bg-deep'),
        surface: withAlpha('--surface'),
        'surface-elevated': withAlpha('--surface-elevated'),
        'surface-hover': withAlpha('--surface-hover'),
        border: withAlpha('--border'),
        'border-strong': withAlpha('--border-strong'),
        content: withAlpha('--content'),
        muted: withAlpha('--muted'),
        faint: withAlpha('--faint'),
        accent: withAlpha('--accent'),
        'accent-strong': withAlpha('--accent-strong'),
        'accent-ink': withAlpha('--accent-ink'),
        gold: withAlpha('--gold'),
        positive: withAlpha('--positive'),
        negative: withAlpha('--negative'),
        warning: withAlpha('--warning'),
        info: withAlpha('--info'),
        demo: withAlpha('--demo'),
        prism: {
          1: withAlpha('--prism-1'),
          2: withAlpha('--prism-2'),
          3: withAlpha('--prism-3'),
          4: withAlpha('--prism-4'),
        },
        era: {
          vintage: withAlpha('--era-vintage'),
          fire: withAlpha('--era-fire'),
          water: withAlpha('--era-water'),
          grass: withAlpha('--era-grass'),
          psychic: withAlpha('--era-psychic'),
          lightning: withAlpha('--era-lightning'),
          steel: withAlpha('--era-steel'),
        },
      },
      borderRadius: {
        lg: '0.7rem',
        xl: '1rem',
        card: 'var(--radius-card)',
        slab: 'var(--radius-slab)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        slab: 'var(--shadow-slab)',
        pop: 'var(--shadow-pop)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
