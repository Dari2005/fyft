import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useDialog } from '@/lib/DialogContext';
import { useSocial } from '@/lib/SocialContext';
import { outline, Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';
import type { ProfileLite } from '@/lib/types';

type FollowButtonProps = {
  /** Compact pill for list rows; default is a slightly larger button. */
  compact?: boolean;
  /** Called after a successful follow / unfollow (e.g. to update a count). */
  onChange?: (following: boolean) => void;
} & (
  | { profile: ProfileLite; venue?: undefined }
  | { venue: { id: string; name: string }; profile?: undefined }
);

/**
 * Follow / Following toggle for an organizer (profile) or a venue.
 * Sends signed-out users to the sign-in screen.
 */
export default function FollowButton({ profile, venue, compact = false, onChange }: FollowButtonProps) {
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { isFollowing, follow, unfollow, isFollowingVenue, followVenue, unfollowVenue } =
    useSocial();
  const { ask, notify } = useDialog();
  const [busy, setBusy] = useState(false);
  const active = venue ? isFollowingVenue(venue.id) : isFollowing(profile!.id);
  const name = venue ? venue.name : profile!.username;

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = venue
        ? active
          ? await unfollowVenue(venue.id)
          : await followVenue(venue.id)
        : active
          ? await unfollow(profile!.id)
          : await follow(profile!);
      if (result === 'ok') onChange?.(!active);
      if (result === 'logged-out') {
        ask({
          title: 'Sign in to follow',
          message: venue
            ? `Follow ${venue.name} to hear about its next events.`
            : 'Follow organizers to hear about their next events.',
          confirmLabel: 'Sign in',
          onConfirm: () => router.push('/auth'),
        });
      } else if (result === 'error') {
        notify("Couldn't update follow", 'Check your connection and try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      // The compact pill is 31pt tall; the slop brings it to a 47pt target.
      hitSlop={compact ? 8 : 4}
      accessibilityRole="button"
      accessibilityState={{ selected: active, busy }}
      accessibilityLabel={
        active ? `Following ${name}. Tap to unfollow.` : `Follow ${name}`
      }
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
