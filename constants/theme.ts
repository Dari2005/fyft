/**
 * Fyft has two palettes with the same keys (Dari, 2026-11-08):
 *
 * - "Dark Glass": near-black background, gray glass surfaces, EVERY border a
 *   thin purple line (soft for ordinary edges, `primary` for active ones).
 * - "Light": cool gray background, white cards, neutral gray borders; purple
 *   only on active / primary things.
 *
 * In both, purple is never a fill: primary buttons, active chips, active tab
 * and FABs use `outline(colors)` (surface + thin purple border).
 * Screens read the active palette via `useColors()` / `useThemedStyles()`
 * from `lib/ThemeContext` — never import a palette directly in a screen.
 */
export interface Palette {
  scheme: 'dark' | 'light';
  background: string;
  surface: string;
  /** Slightly raised surface (thumbnails, skeleton bars, inputs on cards). */
  surfaceHigh: string;
  /** Background behind `outline()` elements. */
  outlineBg: string;
  /** Translucent panel for overlays drawn over the map / photos. */
  glass: string;
  primary: string;
  /** Purple used for text/icons (date lines, small accents). */
  primaryBright: string;
  /** Text on `outline()` elements. */
  primaryText: string;
  text: string;
  /** Secondary body text (descriptions, info rows). */
  textSoft: string;
  muted: string;
  border: string;
  /** Hairline divider inside cards. */
  divider: string;
  danger: string;
  success: string;
  /** Crowd meter: quiet (amber), getting busy (lime), almost full (orange). */
  warning: string;
  lime: string;
  orange: string;
  /** Dim layer behind modals / over images. */
  scrim: string;
  /** Inactive slide dots over photos. */
  dotInactive: string;
}

export const darkColors: Palette = {
  scheme: 'dark',
  background: '#0b0b0f',
  surface: '#15151b',
  surfaceHigh: '#1d1d25',
  outlineBg: '#1d1d25',
  glass: 'rgba(11, 11, 15, 0.86)',
  primary: '#8b6cf0',
  primaryBright: '#b4a0ff',
  primaryText: '#ffffff',
  text: '#f2f2f5',
  textSoft: '#d0d0d8',
  muted: '#8e8e9a',
  border: '#3a3168',
  divider: '#3a3168',
  danger: '#ef4444',
  success: '#22c55e',
  warning: '#f5b83d',
  lime: '#a3e635',
  orange: '#fb923c',
  scrim: 'rgba(5, 5, 8, 0.72)',
  dotInactive: 'rgba(255, 255, 255, 0.35)',
};

export const lightColors: Palette = {
  scheme: 'light',
  background: '#e6e7eb',
  surface: '#ffffff',
  surfaceHigh: '#f1f2f4',
  outlineBg: '#ffffff',
  glass: 'rgba(255, 255, 255, 0.94)',
  primary: '#7c5ce6',
  primaryBright: '#6d4fd8',
  primaryText: '#1a1b20',
  text: '#1a1b20',
  textSoft: '#3a3c44',
  muted: '#62646d',
  border: '#d2d4da',
  divider: '#e6e7eb',
  danger: '#dc2626',
  success: '#16a34a',
  warning: '#b7791f',
  lime: '#4d7c0f',
  orange: '#c2410c',
  scrim: 'rgba(20, 21, 26, 0.45)',
  dotInactive: 'rgba(255, 255, 255, 0.6)',
};

export const Spacing = {
  xs: 6,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
};

/** Primary/active look: surface with a thin purple border, no fill. */
export function outline(c: Palette) {
  return {
    backgroundColor: c.outlineBg,
    borderWidth: 1,
    borderColor: c.primary,
  } as const;
}
