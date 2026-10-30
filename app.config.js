// Fyft dynamic Expo config — Google Maps API key wiring.
//
// The Maps key is NEVER committed (public repo!). It is resolved in this order:
//   1. process.env.GOOGLE_MAPS_API_KEY -> EAS env var (cloud builds; must be in
//      the "development" environment — builds use --profile development)
//   2. ./google-maps-key.local         -> local file, gitignored, restored next to .env
//   3. placeholder                     -> map stays black, build still works
//
// The config logs (without printing the key) which source won, so starting
// Metro locally shows whether the key is wired BEFORE spending a build.
const fs = require("fs");
const path = require("path");

const KEY_FILE = path.join(__dirname, "google-maps-key.local");
const PLACEHOLDER = "PASTE_YOUR_GOOGLE_MAPS_API_KEY_HERE";

function readMapsKey() {
  if (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY.trim()) {
    console.log("[app.config] Google Maps key: from GOOGLE_MAPS_API_KEY env");
    return process.env.GOOGLE_MAPS_API_KEY.trim();
  }
  try {
    if (fs.existsSync(KEY_FILE)) {
      const k = fs.readFileSync(KEY_FILE, "utf8").trim();
      if (k && k !== PLACEHOLDER) {
        console.log("[app.config] Google Maps key: loaded from google-maps-key.local");
        return k;
      }
    }
  } catch (_) {
    // fall through to placeholder
  }
  console.warn(
    "[app.config] Google Maps key: NOT FOUND — placeholder used, map will be black. " +
      "Create google-maps-key.local (key only, one line) next to .env and rebuild."
  );
  return PLACEHOLDER;
}

module.exports = ({ config }) => {
  const key = readMapsKey();
  const ios = config.ios || {};
  const android = config.android || {};
  const androidConfig = android.config || {};

  return {
    ...config,
    ios: {
      ...ios,
      config: { ...(ios.config || {}), googleMapsApiKey: key },
    },
    android: {
      ...android,
      config: {
        ...androidConfig,
        googleMaps: { ...(androidConfig.googleMaps || {}), apiKey: key },
      },
    },
  };
};
