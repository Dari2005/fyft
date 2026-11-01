import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useComments } from '@/hooks/useComments';
import { uploadPartyMedia } from '@/lib/media';
import { Colors, Spacing } from '@/constants/theme';
import type { PartyComment, PartyMedia } from '@/lib/types';

/** One video inside a chat bubble, with native playback controls. */
function ChatVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return (
    <VideoView player={player} style={styles.bubbleMedia} nativeControls contentFit="cover" />
  );
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Party group chat: the party's comments presented as chat bubbles
 * (mine right, others left with avatar + name), with photo/video
 * attachments. Backed by the comments table + realtime, so messages
 * from anyone appear instantly.
 */
export default function PartyChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const { comments, loading, actionLoading, error, addComment, deleteComment } =
    useComments(id, user?.id ?? null);

  const [draft, setDraft] = useState('');
  const [pendingMedia, setPendingMedia] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [sending, setSending] = useState(false);

  // On Android the window does not resize for the keyboard in this build,
  // so the composer would stay hidden behind it. Track the keyboard height
  // and pad the screen by it, lifting the composer (and the list) with it.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardHeight(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Header shows which party's chat this is.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('parties')
        .select('title')
        .eq('id', id)
        .single();
      if (data?.title) navigation.setOptions({ title: `${data.title} · Chat` });
    })();
  }, [id, navigation]);

  const promptLogin = () => {
    Alert.alert('Sign In', 'You must be signed in to join the chat.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign In', onPress: () => router.push('/auth') },
    ]);
  };

  const pickMedia = async () => {
    if (!user) {
      promptLogin();
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo access so you can send pictures and videos.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: false,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (!result.canceled) setPendingMedia(result.assets[0]);
  };

  const handleSend = async () => {
    if (!user) {
      promptLogin();
      return;
    }
    setSending(true);
    try {
      let media: PartyMedia | null = null;
      if (pendingMedia) {
        const uploaded = await uploadPartyMedia(user.id, [pendingMedia]);
        media = uploaded[0] ?? null;
      }
      const result = await addComment(draft, media);
      if (result === 'ok') {
        setDraft('');
        setPendingMedia(null);
      } else if (result === 'error') {
        Alert.alert('Error', 'Message not sent. Try again.');
      }
    } catch {
      Alert.alert('Error', 'Upload failed. Try again.');
    } finally {
      setSending(false);
    }
  };

  // Delete confirmation is a custom themed modal (state below), not the
  // plain system alert — long-pressing an own message opens it.
  const [pendingDelete, setPendingDelete] = useState<PartyComment | null>(null);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    const result = await deleteComment(id);
    if (result === 'error') Alert.alert('Error', 'Delete failed. Try again.');
  };

  const renderMessage = ({ item }: { item: PartyComment }) => {
    const mine = user?.id === item.user_id;
    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
        {!mine &&
          (item.author_avatar_url ? (
            <Image source={{ uri: item.author_avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>
                {(item.author_username ?? 'u').charAt(0).toUpperCase()}
              </Text>
            </View>
          ))}
        <Pressable
          style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
          onLongPress={mine ? () => setPendingDelete(item) : undefined}
          delayLongPress={400}
        >
          {!mine && (
            <Text style={styles.author}>@{item.author_username ?? 'user'}</Text>
          )}
          {!!item.body && (
            <Text style={[styles.body, mine && styles.bodyMine]}>{item.body}</Text>
          )}
          {item.media_url &&
            (item.media_type === 'video' ? (
              <ChatVideo url={item.media_url} />
            ) : (
              <Image
                source={{ uri: item.media_url }}
                style={styles.bubbleMedia}
                resizeMode="cover"
              />
            ))}
          <Text style={[styles.time, mine && styles.timeMine]}>
            {formatTime(item.created_at)}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingBottom: keyboardHeight }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : comments.length === 0 ? (
        // Empty state lives outside the inverted FlatList on purpose:
        // inside an inverted list it inherits the list's flip transform
        // and renders mirrored on Android.
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No messages yet 💬</Text>
          <Text style={styles.emptyText}>
            Be the first to say something about this party!
          </Text>
        </View>
      ) : (
        <FlatList
          inverted
          data={comments}
          keyExtractor={(c) => c.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.list}
        />
      )}
      {error && <Text style={styles.error}>{error}</Text>}

      {pendingMedia && (
        <View style={styles.pendingRow}>
          {pendingMedia.type === 'video' ? (
            <Text style={styles.pendingText}>🎬 Video attached</Text>
          ) : (
            <>
              <Image source={{ uri: pendingMedia.uri }} style={styles.pendingThumb} />
              <Text style={styles.pendingText}>Photo attached</Text>
            </>
          )}
          <TouchableOpacity onPress={() => setPendingMedia(null)}>
            <Text style={styles.pendingRemove}>✕ Remove</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}>
        <TouchableOpacity onPress={pickMedia} style={styles.attachButton}>
          <Text style={styles.attachText}>📷</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Message…"
          placeholderTextColor={Colors.muted}
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={sending || actionLoading || (draft.trim().length === 0 && !pendingMedia)}
          style={[
            styles.sendButton,
            draft.trim().length === 0 && !pendingMedia && styles.sendButtonDisabled,
          ]}
        >
          {sending || actionLoading ? (
            <ActivityIndicator size="small" color={Colors.primaryText} />
          ) : (
            <Text style={styles.sendText}>➤</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={pendingDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingDelete(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPendingDelete(null)}
        >
          <Pressable style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Text style={styles.modalIcon}>🗑️</Text>
            </View>
            <Text style={styles.modalTitle}>Delete this message?</Text>
            {!!pendingDelete?.body && (
              <Text style={styles.modalPreview} numberOfLines={2}>
                “{pendingDelete.body}”
              </Text>
            )}
            {pendingDelete?.media_url && !pendingDelete.body && (
              <Text style={styles.modalPreview}>
                {pendingDelete.media_type === 'video' ? '🎬 Video' : '📷 Photo'}
              </Text>
            )}
            <Text style={styles.modalText}>This action cannot be undone.</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setPendingDelete(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalDelete]}
                onPress={confirmDelete}
              >
                <Text style={styles.modalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs },
  rowMine: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.border },
  avatarFallback: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.primaryText, fontSize: 13, fontWeight: '800' },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: 2,
  },
  bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 6 },
  bubbleOther: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: 6,
  },
  author: { color: Colors.primaryBright, fontSize: 12, fontWeight: '700' },
  body: { color: Colors.text, fontSize: 15, lineHeight: 21 },
  bodyMine: { color: Colors.primaryText },
  bubbleMedia: {
    width: 210,
    height: 210,
    borderRadius: 12,
    backgroundColor: Colors.background,
    marginTop: 4,
  },
  time: { color: Colors.muted, fontSize: 11, alignSelf: 'flex-end', marginTop: 2 },
  timeMine: { color: 'rgba(255,255,255,0.75)' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  emptyText: { color: Colors.muted, fontSize: 14, marginTop: Spacing.xs, textAlign: 'center' },
  error: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.sm,
  },
  pendingThumb: { width: 40, height: 40, borderRadius: 8 },
  pendingText: { color: Colors.text, fontSize: 14, flexShrink: 1 },
  pendingRemove: { color: Colors.danger, fontSize: 14, fontWeight: '600' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachText: { fontSize: 19 },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 22,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    maxHeight: 110,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.45 },
  sendText: { color: Colors.primaryText, fontSize: 17, fontWeight: '800' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 2, 12, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  modalIcon: { fontSize: 26 },
  modalTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalPreview: {
    color: Colors.primaryBright,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  modalText: {
    color: Colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    alignSelf: 'stretch',
  },
  modalButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancel: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  modalDelete: { backgroundColor: Colors.danger },
  modalDeleteText: { color: Colors.primaryText, fontSize: 15, fontWeight: '800' },
});
