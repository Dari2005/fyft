import { Image, StyleSheet, Text, View } from 'react-native';
import { Accent, Colors } from '@/constants/theme';
import type { ProfileLite } from '@/lib/types';

/** Round profile picture with an initial as fallback. */
export default function Avatar({
  profile,
  size = 36,
}: {
  profile: Pick<ProfileLite, 'username' | 'avatar_url'>;
  size?: number;
}) {
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

const styles = StyleSheet.create({
  image: { backgroundColor: Colors.border },
  fallback: { ...Accent.outline, alignItems: 'center', justifyContent: 'center' },
  initial: { color: Colors.primaryText, fontWeight: '800' },
});
