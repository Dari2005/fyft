import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, type Region } from 'react-native-maps';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useParties } from '@/hooks/useParties';
import { Colors, Spacing } from '@/constants/theme';
import type { Party } from '@/lib/types';

/** Fallback region: Skopje center — used until location resolves or when denied. */
const SKOPJE_REGION: Region = {
  latitude: 41.9981,
  longitude: 21.4254,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

/** Map screen: browse all published parties as pins. */
export default function MapScreen() {
  const { parties, loading, error } = useParties();
  const [region, setRegion] = useState<Region | null>(null);
  const [showsUserLocation, setShowsUserLocation] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          setShowsUserLocation(true);
          setRegion({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          });
        } else {
          setRegion(SKOPJE_REGION);
        }
      } catch {
        setRegion(SKOPJE_REGION);
      }
    })();
  }, []);

  const pinned = parties.filter(
    (p): p is Party & { latitude: number; longitude: number } =>
      p.latitude != null && p.longitude != null
  );

  if (!region) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.hint}>Locating you…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={region}
        showsUserLocation={showsUserLocation}
      >
        {pinned.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            pinColor={p.venue_type === 'house' ? Colors.primary : Colors.success}
          >
            <Callout
              onPress={() =>
                router.push({ pathname: '/party/[id]', params: { id: p.id } })
              }
            >
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{p.title}</Text>
                <Text style={styles.calloutMeta}>
                  {p.venue_type === 'house' ? '🏠 House' : '🎶 Club'} · tap for details →
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {error && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Failed to load parties.</Text>
        </View>
      )}
      {!loading && !error && pinned.length === 0 && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>No parties with a location on the map yet.</Text>
        </View>
      )}

      {/* Floating overlay: brand title + create shortcut. */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar} pointerEvents="box-none">
          <Text style={styles.appTitle}>Fyft</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/create')}
          style={styles.fab}
        >
          <Text style={styles.fabText}>＋</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  hint: { color: Colors.muted, fontSize: 14 },
  map: { width: '100%', height: '100%' },
  callout: { minWidth: 160, padding: Spacing.xs },
  calloutTitle: { fontSize: 15, fontWeight: '700', color: '#111111' },
  calloutMeta: { fontSize: 13, color: '#555555', marginTop: 2 },
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabText: { color: '#ffffff', fontSize: 28, fontWeight: '700', marginTop: -2 },
});
