import Svg, { Path } from 'react-native-svg';
import { useColors } from '@/lib/ThemeContext';

/** Glyph outlines of "fyft" in Outfit ExtraBold (SIL Open Font License),
 * shifted to the origin. Shared with scripts/make-logo.js (app icon). */
export const LOGO_PATH =
  'M55.6 148.2L20.8 148.2L20.8 79.4L0 79.4L0 50.4L20.8 50.4L20.8 44.2Q20.8 31.8 26.2 21.9Q31.6 12 41.7 6Q51.8 0 66 0L66 0Q76.6 0 84.6 3.5Q92.6 7 98.4 12.8L98.4 12.8L76.6 34.6Q75 32.8 72.7 31.9Q70.4 31.0 67.4 31.0L67.4 31.0Q62.0 31.0 58.8 34.2Q55.6 37.4 55.6 42.8L55.6 42.8L55.6 50.4L83.2 50.4L83.2 79.4L55.6 79.4L55.6 148.2ZM154.2 189.6L119.2 189.6L140.4 143.2L103.2 50.4L140.4 50.4L157.2 106.6L174 50.4L211.2 50.4L171 148.4L154.2 189.6ZM282.2 148.2L247.4 148.2L247.4 79.4L226.6 79.4L226.6 50.4L247.4 50.4L247.4 44.2Q247.4 31.8 252.8 21.9Q258.2 12 268.3 6Q278.4 0 292.6 0L292.6 0Q303.2 0 311.2 3.5Q319.2 7 325 12.8L325 12.8L303.2 34.6Q301.6 32.8 299.3 31.9Q297 31.0 294 31.0L294 31.0Q288.6 31.0 285.4 34.2Q282.2 37.4 282.2 42.8L282.2 42.8L282.2 50.4L309.8 50.4L309.8 79.4L282.2 79.4L282.2 148.2ZM388 148.2L353.2 148.2L353.2 79.4L331.6 79.4L331.6 50.4L353.2 50.4L353.2 10L388 10L388 50.4L409.6 50.4L409.6 79.4L388 79.4L388 148.2Z';
export const LOGO_WIDTH = 409.6;
export const LOGO_HEIGHT = 189.6;

/**
 * The "fyft" wordmark (2026-11-10): lowercase letters in a single magenta
 * (Colors.primary), drawn as SVG outlines so no font file is needed and it
 * renders identically everywhere. `height` sets the size.
 */
export default function Logo({ height = 22 }: { height?: number }) {
  const Colors = useColors();
  const width = (height * LOGO_WIDTH) / LOGO_HEIGHT;
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}`}
      accessibilityLabel="Fyft"
    >
      <Path d={LOGO_PATH} fill={Colors.primary} />
    </Svg>
  );
}
