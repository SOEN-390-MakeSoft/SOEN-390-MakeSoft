import { useState } from 'react';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';

type LatLng = { latitude: number; longitude: number };
type GoToUserLocationOptions = {
  onResolved?: (coordinate: LatLng) => Promise<void> | void;
  animateToUser?: boolean;
};

/**
 * Hook to manage user location access and map navigation
 */
export function useUserLocation(
  mapRef: React.RefObject<{ animateToRegion: (region: any, duration: number) => void }>,
) {
  const [isLocating, setIsLocating] = useState(false);

  /**
   * Opens app settings for location permissions
   */
  const openAppSettings = async () => {
    await Linking.openSettings();
  };

  /**
   * Shows alert prompting user to enable location in settings
   */
  const promptToOpenSettings = () => {
    Alert.alert(
      'Location permission needed',
      'Location access is disabled. Please enable it in Settings to use "My Location".',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void openAppSettings() },
      ],
    );
  };

  /**
   * Ensures location permission is granted or prompts user
   */
  const ensureLocationPermission = async (): Promise<boolean> => {
    // Check current permission
    const current = await Location.getForegroundPermissionsAsync();

    if (current.status === 'granted') return true;

    // Try requesting (OS may show popup only if allowed)
    const requested = await Location.requestForegroundPermissionsAsync();

    if (requested.status === 'granted') return true;

    // If still denied, direct user to settings (this covers "Don't ask again" cases)
    promptToOpenSettings();
    return false;
  };

  /**
   * Gets user's current location and optionally animates map and/or delegates resolved coordinate.
   */
  const goToUserLocation = async (options?: GoToUserLocationOptions) => {
    const { onResolved, animateToUser = true } = options ?? {};
    setIsLocating(true);
    try {
      const ok = await ensureLocationPermission();
      if (!ok) {
        setIsLocating(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      const coordinate = { latitude, longitude };

      if (onResolved) {
        await onResolved(coordinate);
      }

      if (animateToUser) {
        mapRef.current?.animateToRegion(
          {
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500,
        );
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your location.');
    } finally {
      setIsLocating(false);
    }
  };

  return {
    isLocating,
    goToUserLocation,
  };
}
