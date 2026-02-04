import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, ActivityIndicator, Alert, Linking } from "react-native";
import MapView from "react-native-maps";
import * as Location from "expo-location";
import { MaterialIcons } from "@expo/vector-icons";

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [isLocating, setIsLocating] = useState(false);

  const openAppSettings = async () => {
    await Linking.openSettings();
  };

  const promptToOpenSettings = () => {
    Alert.alert(
      'Location permission needed',
      'Location access is disabled. Please enable it in Settings to use "My Location".',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void openAppSettings() },
      ]
    );
  };

  const ensureLocationPermission = async (): Promise<boolean> => {
    // Check current permission
    const current = await Location.getForegroundPermissionsAsync();

    if (current.status === "granted") return true;

    // Try requesting (OS may show popup only if allowed)
    const requested = await Location.requestForegroundPermissionsAsync();

    if (requested.status === "granted") return true;

    // If still denied, direct user to settings (this covers "Don't ask again" cases)
    promptToOpenSettings();
    return false;
  };

  // Optional: try once when screen opens (won’t always show popup if previously denied)
  useEffect(() => {
    (async () => {
      try {
        await ensureLocationPermission();
      } catch (e) {
        console.log("Permission check error:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToUserLocation = async () => {
    setIsLocating(true);
    try {
      const ok = await ensureLocationPermission();
      if (!ok) return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    } catch (error) {
      console.error("Error getting location:", error);
      Alert.alert("Error", "Could not get your location.");
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={mapRef}
        testID="map-view"
        style={{ flex: 1 }}
        provider="google"
        initialRegion={{
          latitude: 45.4973, // SGW
          longitude: -73.5789,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
      />

      <Pressable
        testID="location-button"
        onPress={goToUserLocation}
        disabled={isLocating}
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          backgroundColor: "#ffffff",
          borderRadius: 50,
          width: 52,
          height: 52,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3,
          elevation: 5,
          opacity: isLocating ? 0.85 : 1,
        }}
      >
        {isLocating ? (
          <ActivityIndicator testID="activity-indicator" size="small" color="#c41230" />
        ) : (
          <MaterialIcons name="my-location" size={24} color="#c41230" />
        )}
      </Pressable>
    </View>
  );
}
