import type { MapStyleElement } from 'react-native-maps';

/**
 * Dark Google Maps style matching the "Dark Glass" theme. Pass as
 * `customMapStyle` (Google provider; it is the default on Android).
 */
export const DARK_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#15151b' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8e8e9a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b0b0f' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#26262f' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#b5b5c0' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#16201b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#23232c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#15151b' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2e2e38' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7a7a86' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0d1420' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a5468' }] },
];

/**
 * Light Google Maps style matching the Light theme (cool gray, white roads,
 * no POI clutter). An explicit style instead of `[]`: switching from the dark
 * style back to "no style" did not always reset on Android.
 */
export const LIGHT_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#eceef1' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#62646d' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#d2d4da' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#3a3c44' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#dcebdf' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#dfe1e6' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f7f7f9' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#7b7d86' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#cfdcea' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6f8094' }] },
];

/** The map style for the active theme. */
export function mapStyleFor(scheme: 'dark' | 'light'): MapStyleElement[] {
  return scheme === 'dark' ? DARK_MAP_STYLE : LIGHT_MAP_STYLE;
}
