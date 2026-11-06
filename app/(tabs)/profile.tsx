import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/lib/AuthContext';
import { useSocial } from '@/lib/SocialContext';
import { useParties } from '@/hooks/useParties';
import { supabase } from '@/lib/supabase';
import { uploadPartyMedia } from '@/lib/media';
import PartyCard from '@/components/PartyCard';
import PrimaryButton from '@/components/PrimaryButton';
import { Colors, Spacing } from '@/constants/theme';

/** Profile tab (right tab): user info, profile picture, my parties, sign out. */
export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { parties } = useParties();
  const { following } = useSocial();
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .single();
      setUsername(data?.username ?? null);
      setAvatarUrl(data?.avatar_url ?? null);
    })();
  }, [user]);

  /** Pick a square profile picture, upload it, and save it on the profile. */
  const changeAvatar = async () => {
    if (!user || uploadingAvatar) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo access so you can set a profile picture.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingAvatar(true);
    try {
      const uploaded = await uploadPartyMedia(user.id, [result.assets[0]]);
      const url = uploaded[0]?.url;
      if (!url) throw new Error('Upload failed');
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', user.id);
      if (error) throw error;
      setAvatarUrl(url);
    } catch {
      Alert.alert('Error', 'Could not update your profile picture. Try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.bigEmoji}>👤</Text>
        <Text style={styles.title}>You are not signed in</Text>
        <Text style={styles.subtitle}>
          Sign in to publish events and see your profile.
        </Text>
        <Link href="/auth" asChild>
          <PrimaryButton title="Sign In" onPress={() => {}} />
        </Link>
      </View>
    );
  }

  const myParties = parties.filter((p) => p.organizer_id === user.id);
  const displayName = username ?? user.email?.split('@')[0] ?? 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={changeAvatar} disabled={uploadingAvatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          {uploadingAvatar && (
            <View style={styles.avatarLoading}>
              <ActivityIndicator color={Colors.primaryText} />
            </View>
          )}
        </Pressable>
        <Text style={styles.changePhoto}>
          {uploadingAvatar ? 'Uploading…' : '📷 Tap to change photo'}
        </Text>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.followingCount}>
          <Text style={styles.followingNum}>{following.length}</Text> following
        </Text>
        <View style={styles.actionsRow}>
          <Link href="/people" asChild>
            <Pressable style={styles.actionButton}>
              <Text style={styles.actionText}>👥 Find people</Text>
            </Pressable>
          </Link>
          <Link href="/notifications" asChild>
            <Pressable style={styles.actionButton}>
              <Text style={styles.actionText}>🔔 Notifications</Text>
            </Pressable>
          </Link>
        </View>
        <View style={styles.signOut}>
          <PrimaryButton title="Sign Out" variant="outline" onPress={signOut} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>My Events ({myParties.length})</Text>
      <FlatList
        data={myParties}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PartyCard party={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            You haven&apos;t published any events yet. Tap ＋ on the map for your first one!
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  bigEmoji: { fontSize: 56, marginBottom: Spacing.sm },
  title: { color: Colors.text, fontSize: 20, fontWeight: '700' },
  subtitle: {
    color: Colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.primaryBright,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  avatarText: { color: Colors.primaryText, fontSize: 36, fontWeight: '800' },
  avatarImage: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: Colors.primaryBright,
    backgroundColor: Colors.surface,
    marginBottom: Spacing.sm,
  },
  avatarLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: Spacing.sm,
    borderRadius: 42,
    backgroundColor: 'rgba(10, 6, 20, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhoto: { color: Colors.muted, fontSize: 13, marginBottom: Spacing.xs },
  name: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  email: { color: Colors.muted, fontSize: 14 },
  followingCount: { color: Colors.muted, fontSize: 14, marginTop: 2 },
  followingNum: { color: Colors.text, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  actionButton: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  actionText: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  signOut: { width: 140, marginTop: Spacing.md },
  sectionTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  list: { padding: Spacing.md, paddingTop: 0, paddingBottom: Spacing.xl },
  empty: {
    color: Colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
