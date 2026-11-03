import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import * as Location from 'expo-location';
import { useParties } from '@/hooks/useParties';
import { Colors, Spacing } from '@/constants/theme';
import type { Party } from '@/lib/types';

/** "Mon, Nov 2 · 11:00 PM" — when the party starts, for the pin preview card. */
function formatWhen(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

/** Fallback region: Skopje center — used until location resolves or when denied. */
const SKOPJE_REGION: Region = {
  latitude: 41.9981,
  longitude: 21.4254,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

/** Map screen: browse all published parties as pins. */
export default function MapScreen() {
  const { parties, loading, error, refresh } = useParties();
  const [showsUserLocation, setShowsUserLocation] = useState(false);
  // The native Google MapView must exist ONLY while this screen is focused:
  // when navigation detaches/reattaches the tab (or a stack screen covers
  // it), a live MapView crashes Android with "child already has a parent".
  // While unfocused we render an empty placeholder; the camera position is
  // kept in lastRegion so the map reopens where the user left it.
  const isFocused = useIsFocused();
  const [lastRegion, setLastRegion] = useState<Region | null>(null);
  // Party whose pin was tapped — shown as a preview card at the bottom.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<MapView | null>(null);
  // Once the user drags the map we stop auto-centering on their location.
  const userMovedRef = useRef(false);

  // Refetch whenever the Map tab gains focus, so a party published a
  // minute ago shows up without restarting the app.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // The map renders IMMEDIATELY on the Skopje fallback — it must not wait
  // for GPS (a cold position fix made the old "Locating you…" gate hang
  // for ages). Location resolves in the background: last-known position
  // first (instant), then a balanced-accuracy fix, animating the camera
  // only if the user hasn't started exploring themselves.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled || status !== 'granted') return;
        setShowsUserLocation(true);
        const centerOn = (latitude: number, longitude: number) => {
          if (cancelled || userMovedRef.current) return;
          mapRef.current?.animateToRegion(
            { latitude, longitude, latitudeDelta: 0.1, longitudeDelta: 0.1 },
            600
          );
        };
        const last = await Location.getLastKnownPositionAsync({});
        if (last) centerOn(last.coords.latitude, last.coords.longitude);
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        centerOn(pos.coords.latitude, pos.coords.longitude);
      } catch {
        // Location unavailable — the Skopje fallback is already on screen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pinned = parties.filter(
    (p): p is Party & { latitude: number; longitude: number } =>
      p.latitude != null && p.longitude != null
  );
  const selected = pinned.find((p) => p.id === selectedId) ?? null;

  return (
    <View style={styles.container}>
      {isFocused ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={lastRegion ?? SKOPJE_REGION}
          showsUserLocation={showsUserLocation}
          onRegionChangeComplete={setLastRegion}
          onPanDrag={() => {
            userMovedRef.current = true;
          }}
          onPress={() => setSelectedId(null)}
        >
          {pinned.map((p) => (
            <Marker
              key={p.id}
              coordinate={{ latitude: p.latitude, longitude: p.longitude }}
              pinColor={Colors.primary}
              onPress={(e) => {
                // Keep the map tap from immediately deselecting this pin.
                e.stopPropagation();
                setSelectedId(p.id);
              }}
            />
          ))}
        </MapView>
      ) : (
        <View style={styles.map} />
      )}

      {error && !selected && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Failed to load parties.</Text>
        </View>
      )}
      {!loading && !error && pinned.length === 0 && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>No parties with a location on the map yet.</Text>
        </View>
      )}

      {/* Pin preview: tapping a pin opens this card; tapping it (or the
          button) goes to the full party details. */}
      {selected && (
        <Pressable
          style={styles.previewCard}
          onPress={() =>
            router.push({ pathname: '/party/[id]', params: { id: selected.id } })
          }
        >
          <View style={styles.previewRow}>
            <View style={styles.previewInfo}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {selected.title}
              </Text>
              <View style={styles.previewWhenRow}>
                <Text style={styles.previewWhen}>🗓</Text>
                <Text style={styles.previewWhen}>{formatWhen(selected.starts_at)}</Text>
              </View>
              {selected.address && (
                <Text style={styles.previewAddress} numberOfLines={1}>
                  {selected.address}
                </Text>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setSelectedId(null)}
              style={styles.previewClose}
              hitSlop={8}
            >
              <Text style={styles.previewCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.previewButton}>
            <Text style={styles.previewButtonText}>Show more details →</Text>
          </View>
        </Pressable>
      )}

      {/* Floating overlay: brand title + create shortcut. */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar} pointerEvents="box-none">
          <Text style={styles.appTitle}>Fyft</Text>
        </View>
        {!selected && (
          <TouchableOpacity
            onPress={() => router.push('/create')}
            style={styles.fab}
          >
            <Text style={styles.fabText}>＋</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map: { width: '100%', height: '100%' },
  previewCard: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 18,
    padding: Spacing.md,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  previewInfo: { flex: 1 },
  previewTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  previewWhenRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  previewWhen: { color: Colors.primaryBright, fontSize: 14, fontWeight: '600' },
  previewAddress: { color: Colors.muted, fontSize: 13, marginTop: 2 },
  previewClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  previewCloseText: { color: Colors.muted, fontSize: 13, fontWeight: '700' },
  previewButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  previewButtonText: { color: Colors.primaryText, fontSize: 15, fontWeight: '800' },
  banner: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
  },
  bannerText: { color: Colors.text, fontSize: 14, textAlign: 'center' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
  },
  appTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { color: '#ffffff', fontSize: 28, fontWeight: '700', marginTop: -2 },
});
