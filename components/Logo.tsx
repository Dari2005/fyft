import Svg, { Circle, Path } from 'react-native-svg';
import { useColors } from '@/lib/ThemeContext';

/**
 * The "fyft." wordmark (logo 1, 2026-11-08): lowercase letters drawn as
 * round strokes + a purple dot. Same paths as the app icon / splash
 * (generated from SVG), so no font is needed and it renders identically
 * everywhere. `height` sets the size; width follows the aspect ratio.
 */
export default function Logo({ height = 22 }: { height?: number }) {
  const Colors = useColors();
  const width = (height * 502) / 279;
  const s = {
    fill: 'none',
    stroke: Colors.text,
    strokeWidth: 34,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={width} height={height} viewBox="13 28 502 279" accessibilityLabel="Fyft">
      <Path d="M60 220 V85 a40 40 0 0 1 40 -40 h12" {...s} />
      <Path d="M30 115 H100" {...s} />
      <Path d="M150 115 V170 a35 35 0 0 0 70 0" {...s} />
      <Path d="M220 115 V250 a40 40 0 0 1 -40 40 H160" {...s} />
      <Path d="M290 220 V85 a40 40 0 0 1 40 -40 h12" {...s} />
      <Path d="M260 115 H330" {...s} />
      <Path d="M400 50 V185 a35 35 0 0 0 35 35 h10" {...s} />
      <Path d="M372 115 H445" {...s} />
      <Circle cx={495} cy={203} r={21} fill={Colors.primary} />
    </Svg>
  );
}
