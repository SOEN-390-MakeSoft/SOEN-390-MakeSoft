import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';

// Mock dependencies
jest.mock('react-native-maps', () => 'MapView');
jest.mock('expo-location');

// Import component
import MapScreen from '../components/MapScreen';

// Mock Alert.alert after import
const mockAlertFn = jest.fn();
Alert.alert = mockAlertFn;

// Mock Linking.openSettings
const mockOpenSettings = jest.fn().mockResolvedValue(true);
Linking.openSettings = mockOpenSettings;

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

      const { getByTestId } = render(<MapScreen />);
      const locationButton = getByTestId('location-button');

      fireEvent.press(locationButton);

      await waitFor(() => {
        expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
          accuracy: Location.Accuracy.Balanced,
        });
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

      const { getByTestId } = render(<MapScreen />);
      fireEvent.press(getByTestId('location-button'));

      await waitFor(() => {
        expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
        expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
      });
    });

    it('should show alert when permission is denied', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

      const { getByTestId } = render(<MapScreen />);
      fireEvent.press(getByTestId('location-button'));

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

      const { getByTestId } = render(<MapScreen />);
      fireEvent.press(getByTestId('location-button'));

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

      const { getByTestId } = render(<MapScreen />);
      fireEvent.press(getByTestId('location-button'));

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

      const { getByTestId } = render(<MapScreen />);
      const locationButton = getByTestId('location-button');

      fireEvent.press(locationButton);

      await waitFor(() => {
        expect(locationButton.props.accessibilityState?.disabled).toBe(true);
      });
    });
  });
});

