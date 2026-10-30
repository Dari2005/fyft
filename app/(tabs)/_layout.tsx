import { View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Colors } from '@/constants/theme';

/** Open on the map tab, not the first one in the bar. */
export const unstable_settings = {
  initialRouteName: 'index',
};

type TabIconName = 'list' | 'map' | 'person';

/**
 * Tab icons drawn as inline SVG (stroke style, 24x24 viewBox).
 *
 * These replaced @expo/vector-icons after its font silently never rendered
 * in Dari's development builds (labels showed, glyphs stayed blank across
 * several builds, even with the font embedded via the expo-font plugin and
 * preloaded with useFonts). SVG paths have no font to load, so they render
 * identically everywhere.
 */
function TabGlyph({
  name,
  color,
  focused,
}: {
  name: TabIconName;
  color: string;
  focused: boolean;
}) {
  const strokeWidth = focused ? 2.4 : 2;
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  return (
    <Svg width={25} height={25} viewBox="0 0 24 24">
      {name === 'list' && (
        <>
          <Line x1={9} y1={6} x2={21} y2={6} {...common} />
          <Line x1={9} y1={12} x2={21} y2={12} {...common} />
          <Line x1={9} y1={18} x2={21} y2={18} {...common} />
          <Circle cx={4.5} cy={6} r={1.4} fill={color} />
          <Circle cx={4.5} cy={12} r={1.4} fill={color} />
          <Circle cx={4.5} cy={18} r={1.4} fill={color} />
        </>
      )}
      {name === 'map' && (
        <>
          <Path
            d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z"
            {...common}
          />
          <Line x1={9} y1={4} x2={9} y2={18} {...common} />
          <Line x1={15} y1={6} x2={15} y2={20} {...common} />
        </>
      )}
      {name === 'person' && (
        <>
          <Circle cx={12} cy={8} r={3.6} {...common} />
          <Path d="M5 20v-1.5C5 15.5 8.1 14 12 14s7 1.5 7 4.5V20" {...common} />
        </>
      )}
    </Svg>
  );
}

/** Tab icon with a violet pill behind it when the tab is active. */
function TabIcon({
  focused,
  color,
  name,
}: {
  focused: boolean;
  color: ColorValue;
  name: TabIconName;
}) {
  return (
    <View
      style={{
        backgroundColor: focused ? Colors.primary : 'transparent',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 3,
      }}
    >
      <TabGlyph
        name={name}
        focused={focused}
        color={focused ? '#ffffff' : String(color)}
      />
    </View>
  );
}

/**
 * Bottom tab bar (Instagram / YouTube Music style):
 * left = party list, center = map (landing), right = profile.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '800' },
        tabBarStyle: {
          backgroundColor: '#120a24',
          borderTopColor: Colors.border,
          height: 62,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarActiveTintColor: Colors.primaryBright,
        tabBarInactiveTintColor: Colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="list"
        options={{
          title: 'Parties in Skopje',
          headerShown: false,
          tabBarLabel: 'Parties',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              name="list"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarLabel: 'Map',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              name="map"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              name="person"
            />
          ),
        }}
      />
    </Tabs>
  );
}
