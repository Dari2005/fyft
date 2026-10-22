/**
 * Dynamic Expo config — reads the Google Maps API key from a LOCAL file
 * so the key never has to be pasted into app.json (and never lands in git).
 *
 * Where the key comes from (first hit wins):
 *   1. Env var GOOGLE_MAPS_KEY (or EXPO_PUBLIC_GOOGLE_MAPS_KEY)
 *   2. maps-key.txt in the project root — Dari restores this file next to .env
 *      every time he unpacks a new zip. The file must contain ONLY the key,
 *      nothing else, no quotes, no spaces around it.
 *   3. Fallback: the PASTE_YOUR_GOOGLE_MAPS_API_KEY_HERE placeholder —
 *      the build still succeeds, but the map tiles won't load.
 */
const fs = require("fs");
const path = require("path");

const PLACEHOLDER = "PASTE_YOUR_GOOGLE_MAPS_API_KEY_HERE";

function loadMapsKey() {
  if (process.env.GOOGLE_MAPS_KEY) return process.env.GOOGLE_MAPS_KEY.trim();
  if (process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY)
    return process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY.trim();

  const keyFile = path.join(__dirname, "maps-key.txt");
  if (fs.existsSync(keyFile)) {
    const key = fs.readFileSync(keyFile, "utf8").trim();
    if (key) return key;
  }

  return PLACEHOLDER;
}

const mapsKey = loadMapsKey();
if (mapsKey === PLACEHOLDER) {
  console.warn(
    "[app.config] maps-key.txt not found — using placeholder Google Maps key; the map will render black. Add maps-key.txt (key only) in the project root and rebuild."
  );
}

module.exports = ({ config }) => {
  const ios = config.ios || {};
  const android = config.android || {};

  return {
    ...config,
    ios: {
      ...ios,
      config: {
        ...(ios.config || {}),
        googleMapsApiKey: mapsKey,
      },
    },
    android: {
      ...android,
      config: {
        ...(android.config || {}),
        googleMaps: {
          ...((android.config || {}).googleMaps || {}),
          apiKey: mapsKey,
        },
      },
    },
  };
};
