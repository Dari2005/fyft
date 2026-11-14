// Web-preview stand-in for react-native-maps (which has no web build).
// Draws a flat placeholder with tappable pins so the screens around the map
// can be looked at in a browser. Used ONLY on web — see metro.config.js.
const React = require('react');
const { View, Pressable, Text } = require('react-native');

const RegionContext = React.createContext(null);

const MapView = React.forwardRef(function MapView(props, ref) {
  const [region, setRegion] = React.useState(props.region || props.initialRegion);
  React.useImperativeHandle(ref, () => ({
    animateToRegion: (r) => {
      setRegion(r);
      if (props.onRegionChangeComplete) props.onRegionChangeComplete(r);
    },
    animateCamera: () => {},
    fitToCoordinates: () => {},
  }));
  return React.createElement(
    Pressable,
    {
      style: [props.style, { backgroundColor: '#1b1c22', overflow: 'hidden' }],
      onPress: () => props.onPress && props.onPress({ nativeEvent: {} }),
    },
    React.createElement(
      Text,
      {
        style: {
          position: 'absolute',
          bottom: 8,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: '#8e8e9a',
          fontSize: 11,
        },
      },
      'Map placeholder (browser preview)'
    ),
    React.createElement(RegionContext.Provider, { value: region }, props.children)
  );
});

function Marker(props) {
  const region = React.useContext(RegionContext);
  if (!region || !props.coordinate) return null;
  const x = 0.5 + (props.coordinate.longitude - region.longitude) / region.longitudeDelta;
  const y = 0.5 - (props.coordinate.latitude - region.latitude) / region.latitudeDelta;
  return React.createElement(Pressable, {
    onPress: (e) =>
      props.onPress && props.onPress({ stopPropagation: () => e.stopPropagation(), nativeEvent: {} }),
    style: {
      position: 'absolute',
      left: `${x * 100}%`,
      top: `${y * 100}%`,
      width: 22,
      height: 22,
      marginLeft: -11,
      marginTop: -22,
      borderRadius: 11,
      borderBottomLeftRadius: 0,
      transform: [{ rotate: '-45deg' }],
      backgroundColor: props.pinColor || 'red',
    },
  });
}

// Keep View referenced for bundlers that tree-shake unused requires.
void View;

module.exports = MapView;
module.exports.default = MapView;
module.exports.Marker = Marker;
module.exports.PROVIDER_GOOGLE = 'google';
module.exports.__esModule = true;
