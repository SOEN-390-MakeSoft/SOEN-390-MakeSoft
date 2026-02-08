// Setup file for Jest


// Configure React Testing Library environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Suppress specific console errors that are expected in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    // Suppress act warnings - we handle them properly with act() in tests
    if (
        typeof args[0] === 'string' &&
        (args[0].includes('Warning: An update to') ||
            args[0].includes('was not wrapped in act') ||
            args[0].includes('The current testing environment is not configured to support act'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { MaterialIcons: (props) => React.createElement(View, props) };
});
