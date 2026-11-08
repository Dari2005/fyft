import Svg, { Circle, Line, Path } from 'react-native-svg';

export type IconName =
  | 'search'
  | 'pin'
  | 'calendar'
  | 'clock'
  | 'users'
  | 'star'
  | 'flame'
  | 'close'
  | 'plus'
  | 'arrowRight'
  | 'arrowLeft'
  | 'share'
  | 'chat'
  | 'flag'
  | 'check'
  | 'navigate'
  | 'edit'
  | 'trash'
  | 'bell'
  | 'sun';

/**
 * Small stroke icons drawn as inline SVG (24x24 viewBox), used instead of
 * emoji: emoji render differently on every phone and icon fonts never
 * rendered in Dari's builds, while SVG paths look the same everywhere.
 */
export default function Icon({
  name,
  size = 16,
  color,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const p = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'search' && (
        <>
          <Circle cx={11} cy={11} r={6.5} {...p} />
          <Line x1={16} y1={16} x2={20.5} y2={20.5} {...p} />
        </>
      )}
      {name === 'pin' && (
        <>
          <Path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" {...p} />
          <Circle cx={12} cy={10} r={2.3} {...p} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Path d="M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" {...p} />
          <Line x1={4} y1={10.5} x2={20} y2={10.5} {...p} />
          <Line x1={8.5} y1={3.5} x2={8.5} y2={7.5} {...p} />
          <Line x1={15.5} y1={3.5} x2={15.5} y2={7.5} {...p} />
        </>
      )}
      {name === 'clock' && (
        <>
          <Circle cx={12} cy={12} r={8.5} {...p} />
          <Path d="M12 7.5V12l3 2" {...p} />
        </>
      )}
      {name === 'users' && (
        <>
          <Circle cx={9} cy={8.5} r={3.2} {...p} />
          <Path d="M3.5 19v-.8c0-2.7 2.5-4.4 5.5-4.4s5.5 1.7 5.5 4.4v.8" {...p} />
          <Path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.2c1.8.6 3 1.9 3 4v.8" {...p} />
        </>
      )}
      {name === 'star' && (
        <Path
          d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"
          {...p}
        />
      )}
      {name === 'flame' && (
        <Path
          d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 2.6-5.3 3.6-8.4 1.9 1.3 2.4 3.3 2.2 4.9 1-.6 1.9-1.9 2.1-3.4 2.1 1.8 4.1 4.2 4.1 7 0 3.1-2.4 5.5-6 5.5z"
          {...p}
        />
      )}
      {name === 'close' && (
        <>
          <Line x1={6.5} y1={6.5} x2={17.5} y2={17.5} {...p} />
          <Line x1={17.5} y1={6.5} x2={6.5} y2={17.5} {...p} />
        </>
      )}
      {name === 'plus' && (
        <>
          <Line x1={12} y1={5} x2={12} y2={19} {...p} />
          <Line x1={5} y1={12} x2={19} y2={12} {...p} />
        </>
      )}
      {name === 'arrowRight' && (
        <>
          <Line x1={5} y1={12} x2={19} y2={12} {...p} />
          <Path d="M13 6l6 6-6 6" {...p} />
        </>
      )}
      {name === 'arrowLeft' && (
        <>
          <Line x1={19} y1={12} x2={5} y2={12} {...p} />
          <Path d="M11 6l-6 6 6 6" {...p} />
        </>
      )}
      {name === 'share' && (
        <>
          <Circle cx={18} cy={5.5} r={2.5} {...p} />
          <Circle cx={6} cy={12} r={2.5} {...p} />
          <Circle cx={18} cy={18.5} r={2.5} {...p} />
          <Line x1={8.2} y1={10.8} x2={15.8} y2={6.7} {...p} />
          <Line x1={8.2} y1={13.2} x2={15.8} y2={17.3} {...p} />
        </>
      )}
      {name === 'chat' && (
        <Path d="M5 18.5V6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9z" {...p} />
      )}
      {name === 'flag' && (
        <>
          <Line x1={6} y1={3.5} x2={6} y2={20.5} {...p} />
          <Path d="M6 4.5h11l-2.5 4 2.5 4H6" {...p} />
        </>
      )}
      {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7.5" {...p} />}
      {name === 'navigate' && <Path d="M21 3 14.5 21l-3.5-8-8-3.5z" {...p} />}
      {name === 'edit' && (
        <Path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" {...p} />
      )}
      {name === 'bell' && (
        <>
          <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" {...p} />
          <Path d="M10 20.5a2 2 0 0 0 4 0" {...p} />
        </>
      )}
      {name === 'sun' && (
        <>
          <Circle cx={12} cy={12} r={4} {...p} />
          <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" {...p} />
        </>
      )}
      {name === 'trash' && (
        <>
          <Line x1={4.5} y1={7} x2={19.5} y2={7} {...p} />
          <Path d="M9 7V4.5h6V7M6.5 7l1 13h9l1-13" {...p} />
        </>
      )}
    </Svg>
  );
}
