import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSocial } from '@/lib/SocialContext';
import { outline, Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';
import type { ProfileLite } from '@/lib/types';

interface FollowButtonProps {
  profile: ProfileLite;
  /** Compact pill for list rows; default is a slightly larger button. */
  compact?: boolean;
}

/** Follow / Following toggle. Sends signed-out users to the sign-in screen. */
export default function FollowButton({ profile, compact = false }: FollowButtonProps) {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { isFollowing, follow, unfollow } = useSocial();
  const [busy, setBusy] = useState(false);
  const active = isFollowing(profile.id);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = active ? await unfollow(profile.id) : await follow(profile);
      if (result === 'logged-out') {
        Alert.alert('Sign In', 'You must be signed in to follow people.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/auth') },
        ]);
      } else if (result === 'error') {
        Alert.alert('Error', 'Something went wrong. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.base,
        compact && styles.compact,
        active ? styles.following : styles.follow,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={active ? Colors.primaryBright : Colors.primaryText} />
      ) : (
        <Text style={[styles.text, compact && styles.textCompact, active && styles.textFollowing]}>
          {active ? 'Following' : 'Follow'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
  base: {
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { paddingVertical: 6, minWidth: 84 },
  follow: { ...outline(Colors) },
  following: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  text: { color: Colors.primaryText, fontSize: 14, fontWeight: '800' },
  textCompact: { fontSize: 13 },
  textFollowing: { color: Colors.primaryBright },
});
