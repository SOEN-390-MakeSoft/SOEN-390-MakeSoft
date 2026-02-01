const React = require('react');
const { View } = require('react-native');

// Mock MapView for Jest (native component cannot run in jsdom)
function MapView(props) {
  return React.createElement(View, { ...props, testID: 'map-view' });
}

module.exports = {
  __esModule: true,
  default: MapView,
};
