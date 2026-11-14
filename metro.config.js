// Default Expo Metro config + a browser preview of the app.
//
// On WEB ONLY, two native-only modules are swapped for stand-ins from
// scripts/web-preview/ so `expo start --web` can render the screens (the map
// becomes a flat placeholder, notifications do nothing). Android and iOS
// bundles resolve the real modules — nothing changes for them.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const upstream = config.resolver.resolveRequest;

const WEB_STUBS = {
  'react-native-maps': 'maps-stub.js',
  'expo-notifications': 'notifications-stub.js',
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && WEB_STUBS[moduleName]) {
    return {
      type: 'sourceFile',
      filePath: path.join(__dirname, 'scripts', 'web-preview', WEB_STUBS[moduleName]),
    };
  }
  return (upstream ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
