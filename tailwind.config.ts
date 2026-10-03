import type { Config } from 'tailwindcss';
// Design tokens live as CSS variables in src/app/globals.css; Tailwind exposes them as utilities.
const v = (name: string) => `var(--${name})`;
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: v('paper'), 'paper-deep': v('paper-deep'), ink: v('ink'), 'ink-muted': v('ink-muted'),
        'ink-faint': v('ink-faint'), bronze: v('bronze'), 'bronze-deep': v('bronze-deep'), vellum: v('vellum'),
        'map-sea': v('map-sea'), 'map-land': v('map-land'), rule: v('rule'), ribbon: v('ribbon'), leather: v('leather'),
      },
      fontFamily: { text: v('font-text'), display: v('font-display') },
      boxShadow: { page: v('shadow-page'), lift: v('shadow-lift') },
    },
  },
  plugins: [],
} satisfies Config;
