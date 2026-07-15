/**
 * Design tokens for the "collector-grade" dark-first visual system.
 * Original branding — deliberately NOT a yellow/blue Pokémon clone. Deep
 * charcoal surfaces, a restrained teal/emerald accent, and a warm gold used
 * sparingly for premium/graded emphasis.
 */

export const tokens = {
  color: {
    // Surfaces (dark-first)
    bg: '#0b0e12',
    surface: '#131820',
    surfaceElevated: '#1a212b',
    border: '#252d38',
    // Text
    text: '#e6edf3',
    textMuted: '#93a1b0',
    // Accents
    accent: '#2dd4bf', // teal
    accentStrong: '#14b8a6',
    gold: '#d9a441', // premium/graded emphasis, used sparingly
    // Status (color-independent labels also required for a11y)
    positive: '#3fb950',
    negative: '#f85149',
    warning: '#d29922',
    info: '#58a6ff',
    demo: '#a371f7', // demo-data badge
  },
  radius: { sm: '0.375rem', md: '0.5rem', lg: '0.75rem', xl: '1rem' },
  freshnessLabel: {
    live: 'Live',
    snapshot: 'Daily snapshot',
    estimated: 'Estimated',
    stale: 'Stale',
    demo: 'Demo data',
  },
} as const;

export type FreshnessKey = keyof typeof tokens.freshnessLabel;
