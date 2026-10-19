import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

export interface LeafletMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  color: string;
}

export interface LeafletCenter {
  latitude: number;
  longitude: number;
  zoom?: number;
}

interface LeafletMapProps {
  center: LeafletCenter;
  markers: LeafletMarker[];
  userLocation?: { latitude: number; longitude: number } | null;
  onMarkerPress?: (id: string) => void;
  onMapPress?: (latitude: number, longitude: number) => void;
  zoomControl?: boolean;
  style?: StyleProp<ViewStyle>;
}

const LEAFLET_VERSION = '1.9.4';
const STADIA_API_KEY = process.env.EXPO_PUBLIC_STADIA_API_KEY ?? '';
// Stadia "Alidade Bright" — a Google-like light map style. Free API key
// (email signup, no card) at https://stadiamaps.com → put it in .env as
// EXPO_PUBLIC_STADIA_API_KEY. Falls back to plain OpenStreetMap tiles when
// the key is missing.
const TILE_URL = STADIA_API_KEY
  ? `https://tiles.stadiamaps.com/tiles/alidade_bright/{z}/{x}/{y}{r}.png?api_key=${STADIA_API_KEY}`
  : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = STADIA_API_KEY
  ? '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Builds the static HTML shell for the map. All dynamic data (center,
 * markers, user location) flows through `window.__fyftUpdate(payload)`
 * via injected JavaScript, so the WebView never reloads on prop changes.
 */
function buildHtml(zoomControl: boolean): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #0f1115; }
  #map { position: absolute; top: 0; bottom: 0; left: 0; right: 0; background: #0f1115; }
  .leaflet-container { background: #0f1115; font: 14px/1.4 system-ui, -apple-system, sans-serif; }
  .fyft-pin-wrap { background: transparent; border: none; }
  .fyft-pin { width: 20px; height: 20px; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.55); }
  .leaflet-control-attribution { background: rgba(15,17,21,0.75) !important; color: #9aa0ae !important; font-size: 10px !important; }
  .leaflet-control-attribution a { color: #9aa0ae !important; }
  .leaflet-control-zoom a { background: #1a1d24 !important; color: #f5f5f7 !important; border-color: #2a2e38 !important; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js"></script>
<script>
(function () {
  var map = L.map('map', { zoomControl: ${zoomControl ? 'true' : 'false'} }).setView([41.9981, 21.4254], 12);
  L.tileLayer('${TILE_URL}', {
    attribution: '${TILE_ATTRIBUTION}',
    maxZoom: 19
  }).addTo(map);

  var markerLayer = L.layerGroup().addTo(map);
  var userDot = null;
  var lastCenter = null;
  var lastMarkerTap = 0;

  function post(msg) {
    window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  function pinIcon(color) {
    return L.divIcon({
      className: 'fyft-pin-wrap',
      html: '<div class="fyft-pin" style="background:' + color + '"></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  function centersDiffer(a, b) {
    if (!a || !b) return true;
    return Math.abs(a.latitude - b.latitude) > 0.000001 ||
           Math.abs(a.longitude - b.longitude) > 0.000001;
  }

  // A marker tap also bubbles a map click in Leaflet — ignore the echo.
  map.on('click', function (e) {
    if (Date.now() - lastMarkerTap < 500) return;
    post({ type: 'mapPress', latitude: e.latlng.lat, longitude: e.latlng.lng });
  });

  window.__fyftUpdate = function (payload) {
    var p = (typeof payload === 'string') ? JSON.parse(payload) : payload;
    if (p.center && centersDiffer(p.center, lastCenter)) {
      lastCenter = p.center;
      map.setView([p.center.latitude, p.center.longitude], p.center.zoom || map.getZoom(), { animate: true });
    }
    markerLayer.clearLayers();
    (p.markers || []).forEach(function (m) {
      var marker = L.marker([m.latitude, m.longitude], { icon: pinIcon(m.color), title: m.title });
      marker.on('click', function () {
        lastMarkerTap = Date.now();
        post({ type: 'markerPress', id: m.id });
      });
      markerLayer.addLayer(marker);
    });
    if (p.userLocation) {
      var ll = [p.userLocation.latitude, p.userLocation.longitude];
      if (!userDot) {
        userDot = L.circleMarker(ll, {
          radius: 8, color: '#ffffff', weight: 2, fillColor: '#2f81f7', fillOpacity: 1
        }).addTo(map);
      } else {
        userDot.setLatLng(ll);
      }
    } else if (userDot) {
      map.removeLayer(userDot);
      userDot = null;
    }
  };

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
}

type IncomingMessage =
  | { type: 'ready' }
  | { type: 'markerPress'; id: string }
  | { type: 'mapPress'; latitude: number; longitude: number };

/**
 * Leaflet + OpenStreetMap map inside a WebView — no API key needed,
 * works in Expo Go. Phone -> web via injected JS (`__fyftUpdate`),
 * web -> phone via `postMessage` (`markerPress` / `mapPress` / `ready`).
 */
export default function LeafletMap({
  center,
  markers,
  userLocation = null,
  onMarkerPress,
  onMapPress,
  zoomControl = true,
  style,
}: LeafletMapProps) {
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  // Memoized so the WebView doesn't reload on every parent render.
  const source = useMemo(() => ({ html: buildHtml(zoomControl) }), [zoomControl]);

  const payload = useMemo(
    () =>
      JSON.stringify({
        center,
        markers,
        userLocation: userLocation ?? null,
      }),
    [center, markers, userLocation]
  );

  // Push prop changes into the already-loaded page — no reload, no flicker.
  useEffect(() => {
    if (ready) {
      webViewRef.current?.injectJavaScript(`window.__fyftUpdate(${payload});true;`);
    }
  }, [payload, ready]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let msg: IncomingMessage;
      try {
        msg = JSON.parse(event.nativeEvent.data) as IncomingMessage;
      } catch {
        return;
      }
      if (msg.type === 'ready') {
        setReady(true);
      } else if (msg.type === 'markerPress') {
        onMarkerPress?.(msg.id);
      } else if (
        msg.type === 'mapPress' &&
        typeof msg.latitude === 'number' &&
        typeof msg.longitude === 'number'
      ) {
        onMapPress?.(msg.latitude, msg.longitude);
      }
    },
    [onMarkerPress, onMapPress]
  );

  return (
    <WebView
      ref={webViewRef}
      source={source}
      style={[styles.webview, style]}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      onMessage={handleMessage}
    />
  );
}

const styles = StyleSheet.create({
  webview: { backgroundColor: '#0f1115' },
});
