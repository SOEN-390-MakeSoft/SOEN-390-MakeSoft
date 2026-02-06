// Setup file for Jest
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { MaterialIcons: (props) => React.createElement(View, props) };
});
