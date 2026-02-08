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

jest.mock('expo-location');
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light' },
}));
jest.mock('tamagui', () => {
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
    expect(getByTestId('map-view')).toBeTruthy();
    (Platform as any).OS = originalOS;
  });

  it('triggers haptics when a building polygon is pressed', () => {
    const { getAllByTestId } = renderWithProviders(<MapScreen />);
    const polygons = getAllByTestId('polygon');
    fireEvent.press(polygons[0]);
    expect(Haptics.impactAsync).toHaveBeenCalled();
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
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
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
    expect(getByTestId('map-view')).toBeTruthy();
    useSettingsSpy.mockRestore();
  });

  it('uses buildingPrimary when provided', () => {
    mockTheme = {
      buildingPrimary: { get: () => '#123456' },
      cred: { get: () => '#912338' },
    };
    const { getByTestId } = renderWithProviders(<MapScreen />);
    expect(getByTestId('map-view')).toBeTruthy();
  });

  it('opens menu when the menu button is pressed', () => {
    const { getByLabelText } = renderWithProviders(<MapScreen />);
    fireEvent.press(getByLabelText('Open menu'));
    expect(mockPush).toHaveBeenCalledWith('/menu');
  });

  it('logs permission check errors on mount', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation();
    (Location.getForegroundPermissionsAsync as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    renderWithProviders(<MapScreen />);
    await waitFor(() => {
      expect(logSpy).toHaveBeenCalledWith('Permission check error:', expect.any(Error));
    });
    logSpy.mockRestore();
  });

  it('shows address from lookup and closes the modal', () => {
    const { getAllByTestId, getByText, UNSAFE_getByType } = renderWithProviders(<MapScreen />);
    fireEvent.press(getAllByTestId('marker')[0]);

    expect(getByText('Test Building')).toBeTruthy();
    expect(getByText('123 Test St')).toBeTruthy();

    const modal = UNSAFE_getByType(Modal);
    act(() => {
      modal.props.onRequestClose();
    });

    fireEvent.press(getAllByTestId('marker')[0]);
    const titleNode: any = getByText('Test Building');
    const overlay = titleNode.parent?.parent;
    expect(overlay).toBeTruthy();
    fireEvent.press(overlay);
  });
});

describe('MapScreen - User Permission Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTheme = { cred: { get: () => '#912338' } };
  });

  describe('Permission Granted', () => {
    it('should get user location when permission is granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 45.5017, longitude: -73.5673 },
      });

      const { findByTestId } = renderWithProviders(<MapScreen />);
      const locationButton = await findByTestId('location-button');

      fireEvent.press(locationButton);

      await waitFor(() => {
        expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
          accuracy: Location.Accuracy.Balanced,
        });
      });

      // Verify map animates to user location
      await waitFor(() => {
        expect(mockAnimateToRegion).toHaveBeenCalledWith(
          {
            latitude: 45.5017,
            longitude: -73.5673,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500
        );
      });

      await waitFor(() => {
        expect(Haptics.impactAsync).toHaveBeenCalled();
      });
    });
  });

  describe('Permission Denied', () => {
    it('should request permission when denied and proceed if granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
        coords: { latitude: 45.5017, longitude: -73.5673 },
      });

      const { findByTestId } = renderWithProviders(<MapScreen />);
      const locationButton = await findByTestId('location-button');

      fireEvent.press(locationButton);

      await waitFor(() => {
        expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
        expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
      });
    });

    it('should show alert when permission is denied', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      const { findByTestId } = renderWithProviders(<MapScreen />);
      const locationButton = await findByTestId('location-button');

      fireEvent.press(locationButton);

      await waitFor(() => {
        expect(mockAlertFn).toHaveBeenCalledWith(
          'Location permission needed',
          expect.stringContaining('Please enable it in Settings'),
          expect.any(Array)
        );
      });
    });

    it('should open settings when user chooses "Open Settings"', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      const { findByTestId } = renderWithProviders(<MapScreen />);
      const locationButton = await findByTestId('location-button');

      fireEvent.press(locationButton);

      await waitFor(() => expect(mockAlertFn).toHaveBeenCalled());

      // Simulate pressing "Open Settings"
      const alertButtons = mockAlertFn.mock.calls[0][2];
      const openSettingsBtn = alertButtons?.find((btn: any) => btn.text === 'Open Settings');
      openSettingsBtn?.onPress?.();

      expect(mockOpenSettings).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle location retrieval errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error('Location unavailable'));

      const { findByTestId } = renderWithProviders(<MapScreen />);
      const locationButton = await findByTestId('location-button');

      fireEvent.press(locationButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting location:', expect.any(Error));
        expect(mockAlertFn).toHaveBeenCalledWith('Error', 'Could not get your location.');
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Button State', () => {
    it('should disable button while fetching location', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      (Location.getCurrentPositionAsync as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({
          coords: { latitude: 45.5017, longitude: -73.5673 }
        }), 100))
      );

      const { findByTestId } = renderWithProviders(<MapScreen />);
      const locationButton = await findByTestId('location-button');

      fireEvent.press(locationButton);

      await waitFor(() => {
        expect(locationButton.props.accessibilityState?.disabled).toBe(true);
      });
    });
  });
});
