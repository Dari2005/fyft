import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useParties } from '@/hooks/useParties';
import LeafletMap, { type LeafletCenter } from '@/components/LeafletMap';
import { Colors, Spacing } from '@/constants/theme';
import type { Party } from '@/lib/types';

/** Fallback center: Skopje — used until location resolves or when denied. */
const SKOPJE_CENTER: LeafletCenter = { latitude: 41.9981, longitude: 21.4254, zoom: 12 };

/** Map screen: browse all published parties as pins (OpenStreetMap/Leaflet). */
export default function MapScreen() {
  const { parties, loading, error } = useParties();
  const [center, setCenter] = useState<LeafletCenter | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setUserLocation(loc);
          setCenter({ ...loc, zoom: 13 });
        } else {
          setCenter(SKOPJE_CENTER);
        }
      } catch {
        setCenter(SKOPJE_CENTER);
      }
    })();
  }, []);

  const pinned = parties.filter(
    (p): p is Party & { latitude: number; longitude: number } =>
      p.latitude != null && p.longitude != null
  );

  if (!center) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.hint}>Ја одредувам локацијата…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LeafletMap
        style={styles.map}
        center={center}
        userLocation={userLocation}
        markers={pinned.map((p) => ({
          id: p.id,
          latitude: p.latitude,
          longitude: p.longitude,
          title: p.title,
          color: p.venue_type === 'house' ? Colors.primary : Colors.success,
        }))}
        onMarkerPress={(id) => router.push({ pathname: '/party/[id]', params: { id } })}
      />

      {error && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Грешка при вчитување на журките.</Text>
        </View>
      )}
      {!loading && !error && pinned.length === 0 && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Уште нема журки со локација на мапата.</Text>
        </View>
      )}
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
});
