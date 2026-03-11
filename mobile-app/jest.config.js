module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect', './jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)', '**/__tests__/**/*-Test.[jt]s?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|tamagui|@tamagui/.*)',
  ],
  transform: {
    '\\.geojson$': '<rootDir>/jest-geojson-transform.js',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverage: false,
  collectCoverageFrom: [
    'hooks/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    'services/**/*.{ts,tsx}',
    'context/**/*.{ts,tsx}',
    'constants/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!data/**',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/coverage/**',
  ],
};
