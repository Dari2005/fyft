import { View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

/** Open on the map tab, not the first one in the bar. */
export const unstable_settings = {
  initialRouteName: 'index',
};

/** Tab icon with a violet pill behind it when the tab is active. */
function TabIcon({
  focused,
  color,
  size,
  name,
  nameFocused,
}: {
  focused: boolean;
  color: ColorValue;
  size: number;
  name: keyof typeof Ionicons.glyphMap;
  nameFocused: keyof typeof Ionicons.glyphMap;
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
      <Ionicons
        name={focused ? nameFocused : name}
        size={size}
        color={focused ? '#ffffff' : color}
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
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={size}
              name="list-outline"
              nameFocused="list"
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
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={size}
              name="map-outline"
              nameFocused="map"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon
              focused={focused}
              color={color}
              size={size}
              name="person-circle-outline"
              nameFocused="person-circle"
            />
          ),
        }}
      />
    </Tabs>
  );
}
