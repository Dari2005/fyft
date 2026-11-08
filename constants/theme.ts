/**
 * "Dark Glass" (2026-11-08): near-black background, neutral gray glass
 * surfaces, hairline borders. Purple is used ONLY as a thin border/line on
 * active or primary things (active chip, main buttons, selected tab), never
 * as a fill — see `Accent.outline`.
 */
export const Colors = {
  background: '#0b0b0f',
  surface: '#15151b',
  /** Slightly lighter glass, for things sitting on a surface. */
  surfaceHigh: '#1d1d25',
  /** Translucent glass for overlays drawn over the map. */
  glass: 'rgba(11, 11, 15, 0.86)',
  primary: '#8b6cf0',
  primaryBright: '#b4a0ff',
  primaryText: '#ffffff',
  text: '#f2f2f5',
  muted: '#8e8e9a',
  /** Every border is purple: soft for ordinary edges, `primary` for active ones. */
  border: '#3a3168',
  danger: '#ef4444',
  success: '#22c55e',
};

export const Spacing = {
  xs: 6,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
};

export const Accent = {
  /** Primary/active look: dark glass with a thin purple border, no fill. */
  outline: {
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
} as const;
