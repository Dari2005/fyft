import { Image, StyleSheet, Text, View } from 'react-native';
import { outline, type Palette } from '@/constants/theme';
import { useThemedStyles } from '@/lib/ThemeContext';
import type { ProfileLite } from '@/lib/types';

/** Round profile picture with an initial as fallback. */
export default function Avatar({
  profile,
  size = 36,
}: {
  profile: Pick<ProfileLite, 'username' | 'avatar_url'>;
  size?: number;
}) {
  const styles = useThemedStyles(makeStyles);
  const dim = { width: size, height: size, borderRadius: size / 2 };
  if (profile.avatar_url) {
    return <Image source={{ uri: profile.avatar_url }} style={[styles.image, dim]} />;
  }
  return (
    <View style={[styles.fallback, dim]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>
        {(profile.username ?? 'u').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
  image: { backgroundColor: Colors.border },
  fallback: { ...outline(Colors), alignItems: 'center', justifyContent: 'center' },
  initial: { color: Colors.primaryText, fontWeight: '800' },
});
