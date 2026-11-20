/**
 * Fyft has two palettes with the same keys (Dari, 2026-11-08):
 *
 * - "Dark Glass": near-black background, gray glass surfaces, EVERY border a
 *   thin magenta line (soft for ordinary edges, `primary` for active ones).
 * - "Light": cool gray background, white cards, neutral gray borders; magenta
 *   only on active / primary things.
 *
 * In both, magenta is never a fill: primary buttons, active chips, active tab
 * and FABs use `outline(colors)` (surface + thin magenta border).
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
  /** Magenta used for text/icons (date lines, small accents). */
  primaryBright: string;
  /** Text on `outline()` elements. */
  primaryText: string;
  text: string;
  /** Secondary body text (descriptions, info rows). */
  textSoft: string;
  muted: string;
  border: string;
  /** Edge of text fields: must reach 3:1 against surface (WCAG 1.4.11). */
  inputBorder: string;
  /** Hairline divider inside cards. */
  divider: string;
  /** Empty part of the crowd meter bar — must stay visible on `surface`. */
  track: string;
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
  primary: '#dc5ad8',
  primaryBright: '#f08ce9',
  primaryText: '#ffffff',
  text: '#f2f2f5',
  textSoft: '#d0d0d8',
  muted: '#8e8e9a',
  border: '#4a2748',
  inputBorder: '#94508f',
  divider: '#4a2748',
  track: '#3d3d4a',
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
  primary: '#b832b4',
  primaryBright: '#a3279f',
  primaryText: '#1a1b20',
  text: '#1a1b20',
  textSoft: '#3a3c44',
  muted: '#62646d',
  border: '#d2d4da',
  inputBorder: '#80838c',
  divider: '#e6e7eb',
  track: '#c9ccd3',
  danger: '#dc2626',
  // Darkened 2026-11-14 so small text (LIVE, "Quiet so far") reaches 4.5:1
  // on white cards; the old #16a34a / #b7791f were 3.3:1 / 3.6:1.
  success: '#167a3b',
  warning: '#8f5f0a',
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

/** Primary/active look: surface with a thin magenta border, no fill. */
export function outline(c: Palette) {
  return {
    backgroundColor: c.outlineBg,
    borderWidth: 1,
    borderColor: c.primary,
  } as const;
}
