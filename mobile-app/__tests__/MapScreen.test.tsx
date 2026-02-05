import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import { TamaguiProvider, Theme } from 'tamagui';
import config from '../tamagui.config';
import { SettingsProvider } from '../context/settings';

// Import component
import MapScreen from '../components/MapScreen';

// Create mock function for animateToRegion
const mockAnimateToRegion = jest.fn();

/**
 * Mock react-native-maps module to avoid native module errors during testing.
 * Replaces MapView with a forwarded ref component that supports animateToRegion.
 */
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
  });

  /**
   * Test: Verifies that the MapScreen component renders the map view.
   * Ensures the mocked MapView component is present in the rendered output.
   */
  it('renders map view', () => {
    const { getByTestId } = renderWithProviders(<MapScreen />);
    expect(getByTestId('map-view')).toBeTruthy();
  });
});

describe('MapScreen - User Permission Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

