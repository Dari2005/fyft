import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useParties } from '@/hooks/useParties';
import { useSocial } from '@/lib/SocialContext';
import {
  DEFAULT_FILTERS,
  isFiltering as hasFilters,
  makeEventMatcher,
  type EventFilters,
} from '@/lib/eventFilters';
import EventFilterBar from '@/components/EventFilterBar';
import Logo from '@/components/Logo';
import Icon from '@/components/Icon';
import { mapStyleFor } from '@/lib/mapStyle';
import { outline, Spacing, type Palette } from '@/constants/theme';
import { useColors, useThemedStyles } from '@/lib/ThemeContext';
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
  const Colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const { parties, loading, error, refresh } = useParties();
  const { friendsGoing, followingIds, refresh: refreshSocial } = useSocial();
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS);
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
      refreshSocial();
    }, [refresh, refreshSocial])
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

  const located = useMemo(
    () =>
      parties.filter(
        (p): p is Party & { latitude: number; longitude: number } =>
          p.latitude != null && p.longitude != null
      ),
    [parties]
  );
  // Same search + filters as the Events tab; only matching pins are drawn.
  const pinned = useMemo(() => {
    const matches = makeEventMatcher(filters, { now: new Date(), friendsGoing, followingIds });
    return located.filter(matches);
  }, [located, filters, friendsGoing, followingIds]);
  const selected = pinned.find((p) => p.id === selectedId) ?? null;
  const filtering = hasFilters(filters);

  return (
    <View style={styles.container}>
      {isFocused ? (
        <MapView
          // Remount on theme change so the new map style always applies.
          key={Colors.scheme}
          ref={mapRef}
          style={styles.map}
          customMapStyle={mapStyleFor(Colors.scheme)}
          initialRegion={lastRegion ?? SKOPJE_REGION}
          showsUserLocation={showsUserLocation}
          onRegionChangeComplete={setLastRegion}
          onPanDrag={() => {
            userMovedRef.current = true;
          }}
          onPress={() => {
            Keyboard.dismiss();
            setSelectedId(null);
          }}
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
          <Text style={styles.bannerText}>Failed to load events.</Text>
        </View>
      )}
      {!loading && !error && pinned.length === 0 && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            {filtering && located.length > 0
              ? 'No events match your filters.'
              : 'No events with a location on the map yet.'}
          </Text>
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
                <Icon name="calendar" size={14} color={Colors.primaryBright} />
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
              <Icon name="close" size={14} color={Colors.muted} />
            </TouchableOpacity>
          </View>
          <View style={styles.previewButton}>
            <Text style={styles.previewButtonText}>Show details</Text>
            <Icon name="arrowRight" size={16} color={Colors.primaryBright} />
          </View>
        </Pressable>
      )}

      {/* Floating overlay: brand title, search + filters, create shortcut. */}
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.xs }]} pointerEvents="box-none">
          <View style={styles.appTitle}>
            <Logo height={20} />
          </View>
          <EventFilterBar
            filters={filters}
            onChange={setFilters}
            floating
            style={styles.filterBar}
          />
        </View>
        {!selected && (
          <TouchableOpacity
            onPress={() => router.push('/create')}
            style={styles.fab}
          >
            <Icon name="plus" size={26} color={Colors.primaryBright} strokeWidth={2.2} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const makeStyles = (Colors: Palette) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map: { width: '100%', height: '100%' },
  previewCard: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.lg,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.border,
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
  previewTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
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
    ...outline(Colors),
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  previewButtonText: { color: Colors.primaryText, fontSize: 15, fontWeight: '700' },
  banner: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.glass,
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
  topBar: {},
  filterBar: { marginTop: Spacing.xs },
  appTitle: { paddingHorizontal: Spacing.md, alignSelf: 'flex-start' },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 999,
    ...outline(Colors),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { color: '#ffffff', fontSize: 28, fontWeight: '700', marginTop: -2 },
});
