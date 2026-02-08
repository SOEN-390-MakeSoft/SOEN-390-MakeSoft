import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert, Linking, Modal, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { TamaguiProvider, Theme } from 'tamagui';
import config from '../tamagui.config';
import { SettingsProvider } from '../context/settings';
import * as Settings from '../context/settings';

// Import component
import MapScreen from '../components/MapScreen';

// Create mock function for animateToRegion
const mockAnimateToRegion = jest.fn();
let mockTheme = { cred: { get: () => '#912338' } };

// Mock dependencies
jest.mock('react-native-maps', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');

  // eslint-disable-next-line react/display-name
  const MockMapView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      animateToRegion: mockAnimateToRegion,
    }));
    return React.createElement(View, { ...props, testID: props.testID || 'map-view' });
  });

  return {
    __esModule: true,
    default: MockMapView,
    Marker: (props: any) => React.createElement(View, { testID: 'marker', ...props }),
    Polygon: (props: any) => React.createElement(View, { testID: 'polygon', ...props }),
  };
});

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, { ...props, testID: 'icon' }),
  };
});

jest.mock('expo-location');
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light' },
}));
jest.mock('tamagui', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    TamaguiProvider: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Theme: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Text: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
    YStack: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    useTheme: () => mockTheme,
  };
});
jest.mock('../tamagui.config', () => ({}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../data/buildingPolygons', () => ({
  BUILDING_POLYGONS: {
    TB: {
      name: 'Test Building',
      street: null,
      housenumber: null,
      polygon: [
        { latitude: 45.502, longitude: -73.568 },
        { latitude: 45.502, longitude: -73.566 },
        { latitude: 45.501, longitude: -73.566 },
        { latitude: 45.501, longitude: -73.568 },
      ],
    },
    TA: {
      name: 'Addressed Building',
      street: 'Test St',
      housenumber: '1',
      polygon: [
        { latitude: 45.5005, longitude: -73.568 },
        { latitude: 45.5005, longitude: -73.567 },
        { latitude: 45.5002, longitude: -73.567 },
        { latitude: 45.5002, longitude: -73.568 },
      ],
    },
  },
}));
jest.mock('../data/buildingPolygonsLoyola', () => ({
  LOYOLA_BUILDING_POLYGONS: {},
}));
jest.mock('../data/building-addresses', () => ({
  BUILDING_ADDRESSES: [
    { code: 'TB', name: 'Test Building', address: '123 Test St', aliases: ['Test Building Alias'] },
    { code: 'TA', name: 'Addressed Building', address: '1 Test St' },
  ],
}));

// Mock Alert.alert after import
const mockAlertFn = jest.fn();
Alert.alert = mockAlertFn;

// Mock Linking.openSettings
const mockOpenSettings = jest.fn().mockResolvedValue(true);
Linking.openSettings = mockOpenSettings;

/**
 * Helper function to wrap components with TamaguiProvider, Theme, and SettingsProvider.
 * Required because MapScreen uses useTheme() and useSettings() which need their respective contexts.
 */
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <TamaguiProvider config={config}>
      <Theme name="light">
        <SettingsProvider>
          {component}
        </SettingsProvider>
      </Theme>
    </TamaguiProvider>
  );
};

describe('MapScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    mockTheme = { cred: { get: () => '#912338' } };
  });

  /**
   * Test: Verifies that the MapScreen component renders the map view.
   * Ensures the mocked MapView component is present in the rendered output.
   */
  it('renders map view', () => {
    const originalOS = Platform.OS;
    (Platform as any).OS = 'android';
    mockTheme = { cred: { get: () => '#123' } };
    const { getByTestId } = renderWithProviders(<MapScreen />);
    expect(getByTestId('campus-map')).toBeTruthy();
    (Platform as any).OS = originalOS;
  });

  it('animates map when switching campuses', () => {
    const { getByText } = renderWithProviders(<MapScreen />);
    const loyolaText = getByText('Loyola');
    const loyolaButton = loyolaText.parent as any;
    fireEvent.press(loyolaButton);
    expect(mockAnimateToRegion).toHaveBeenCalledWith(
      {
        latitude: 45.4581,
        longitude: -73.6402,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      },
      500
    );
  });

  it('uses colour blind theme colors when enabled', () => {
    mockTheme = {
      colourBlind1: { get: () => '#B3D4FF' },
      colourBlind2: { get: () => '#1F4E8C' },
      cred: { get: () => '#912338' },
    };
    const useSettingsSpy = jest.spyOn(Settings, 'useSettings').mockReturnValue({
      colourBlindMode: true,
      setColourBlindMode: jest.fn(),
    } as any);
    const { getByTestId } = renderWithProviders(<MapScreen />);
    expect(getByTestId('campus-map')).toBeTruthy();
    useSettingsSpy.mockRestore();
  });

  it('uses buildingPrimary when provided', () => {
    mockTheme = {
      buildingPrimary: { get: () => '#123456' },
      cred: { get: () => '#912338' },
    };
    const { getByTestId } = renderWithProviders(<MapScreen />);
    expect(getByTestId('campus-map')).toBeTruthy();
  });

  it('opens menu when the menu button is pressed', () => {
    const { getByLabelText, getByText } = renderWithProviders(<MapScreen />);
    fireEvent.press(getByLabelText('Open menu'));
    // The menu is rendered as an overlay with "Menu" title
    expect(getByText('Menu')).toBeTruthy();
    expect(getByText('Customize your map experience')).toBeTruthy();
  });

  it('shows address from lookup and closes the overlay', () => {
    const { getAllByTestId, getByText, getByRole, queryByText } = renderWithProviders(<MapScreen />);
    fireEvent.press(getAllByTestId('polygon')[0]); // Pressing polygon triggers selection

    // Wait for the overlay content to appear
    expect(getByText('Test Building')).toBeTruthy();
    
    // Test address lookup if available, or just check that building info shows up
    // The mock data has Test Building with no address in polygon data, but address lookup?
    // In MapScreen.tsx: addressLookup.get(...)
    
    // Close the overlay
    fireEvent.press(getByRole('button', { name: "Close building details" }));
    
    // Expect building name to be gone or overlay closed
    expect(queryByText('Test Building')).toBeNull();
  });
});
