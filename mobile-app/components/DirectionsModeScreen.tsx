import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import { useTheme } from 'tamagui';
import type { NavigationStep } from '../hooks/useNavigationBetweenBuildings';
import { distanceToPolylineMeters, type LatLng } from '../utils/mapUtils';
import { useSettings } from '../context/settings';
import { navigationSharedStyles } from '../utils/navigationStyles';
import StepInstructionPanel from './StepInstructionPanel';

/** How far (metres) the user must stray from the route to trigger a reroute. */
const OFF_ROUTE_THRESHOLD_METERS = 30;
/** Minimum milliseconds between consecutive reroute requests. */
const REROUTE_COOLDOWN_MS = 15_000;

/** Approximate distance in metres between two lat/lng points (Haversine). */
function haversineDistance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aVal =
    sinLat * sinLat +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sinLng *
      sinLng;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}

/**
 * Looks ahead from `fromIndex` and returns the index of the step whose
 * focusCoordinate is closest to the user. Never goes backwards.
 */
function findBestStepIndex(
  userCoord: { latitude: number; longitude: number },
  steps: NavigationStep[],
  fromIndex: number,
): number {
  let bestIndex = fromIndex;
  let bestDist = Infinity;
  for (let i = fromIndex; i < steps.length; i++) {
    const coord = steps[i]?.focusCoordinate;
    if (!coord) continue;
    const dist = haversineDistance(userCoord, coord);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

interface DirectionsModeScreenProps {
  visible: boolean;
  steps: NavigationStep[];
  onClose: () => void;
  /** Decoded polyline of the active route, used for off-route detection. */
  routePolyline?: LatLng[];
  /** Called when the user drifts more than OFF_ROUTE_THRESHOLD_METERS from the route. */
  onOffRoute?: (coordinate: LatLng) => void;
  /** True while a new route is being fetched after going off-route. */
  isRerouting?: boolean;
  /** Called when the user taps the Live badge to recenter the map to their current position. */
  onRecenterToUser?: () => void;
  /** Called whenever the user's location updates, with their coordinate and the new step index. */
  onLocationUpdate?: (
    coordinate: { latitude: number; longitude: number },
    stepIndex: number,
  ) => void;
}

export default function DirectionsModeScreen({
  visible,
  steps,
  onClose,
  routePolyline,
  onOffRoute,
  isRerouting,
  onRecenterToUser,
  onLocationUpdate,
}: Readonly<DirectionsModeScreenProps>) {
  const { colourBlindMode } = useSettings();
  const theme = useTheme();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const currentStepIndexRef = useRef(0);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastRerouteRef = useRef<number>(0);

  const colourBlindPrimary = theme?.colourBlind1?.get?.() ?? '#B3D4FF';
  const colourBlindAccent = theme?.colourBlind2?.get?.() ?? '#1F4E8C';
  const cardColor = colourBlindMode ? colourBlindAccent : '#8e2334';
  const actionBg = colourBlindMode ? colourBlindPrimary : '#f6dce0';
  const actionTextColor = colourBlindMode ? '#1F4E8C' : '#7f1f2a';

  const handleLocationUpdate = useCallback(
    (location: Location.LocationObject) => {
      const userCoord = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      const newIndex = findBestStepIndex(userCoord, steps, currentStepIndexRef.current);
      if (newIndex !== currentStepIndexRef.current) {
        currentStepIndexRef.current = newIndex;
        setCurrentStepIndex(newIndex);
      }
      onLocationUpdate?.(userCoord, newIndex);

      // Off-route detection: if the user drifts too far from the polyline,
      // request a reroute (guarded by a cooldown to avoid rapid re-fetching).
      if (routePolyline && routePolyline.length > 1 && onOffRoute) {
        const distFromRoute = distanceToPolylineMeters(userCoord, routePolyline);
        const now = Date.now();
        if (
          distFromRoute > OFF_ROUTE_THRESHOLD_METERS &&
          now - lastRerouteRef.current > REROUTE_COOLDOWN_MS
        ) {
          lastRerouteRef.current = now;
          onOffRoute(userCoord);
        }
      }
    },
    [steps, onLocationUpdate, routePolyline, onOffRoute],
  );

  useEffect(() => {
    if (!visible) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      setIsTracking(false);
      setCurrentStepIndex(0);
      currentStepIndexRef.current = 0;
      lastRerouteRef.current = 0;
      return;
    }

    let cancelled = false;

    const startTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      setIsTracking(true);
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5, // update every ~5 metres of movement
          timeInterval: 3000, // or every 3 seconds, whichever comes first
        },
        handleLocationUpdate,
      );
    };

    void startTracking();

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [visible, handleLocationUpdate]);

  if (!visible) return null;

  const totalSteps = steps.length;
  const safeIndex = Math.min(Math.max(currentStepIndex, 0), Math.max(totalSteps - 1, 0));
  const currentStep = steps[safeIndex];

  let trackingIconName: keyof typeof MaterialIcons.glyphMap;
  if (isRerouting) {
    trackingIconName = 'sync';
  } else if (isTracking) {
    trackingIconName = 'my-location';
  } else {
    trackingIconName = 'location-searching';
  }

  let trackingLabel: string;
  if (isRerouting) {
    trackingLabel = 'Recalculating\u2026';
  } else if (isTracking) {
    trackingLabel = 'Live';
  } else {
    trackingLabel = 'Locating\u2026';
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none" testID="directions-mode-screen">
      {/* Header row: spacer | tracking badge | close */}
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <Pressable
          onPress={onRecenterToUser}
          disabled={!onRecenterToUser}
          accessibilityRole="button"
          accessibilityLabel="Recenter map to my location"
          testID="tracking-badge"
          style={({ pressed }) => [
            styles.trackingBadge,
            { backgroundColor: actionBg },
            pressed && onRecenterToUser ? { opacity: 0.7 } : undefined,
          ]}
        >
          <MaterialIcons name={trackingIconName} size={14} color={actionTextColor} />
          <Text style={[styles.trackingText, { color: actionTextColor }]}>{trackingLabel}</Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close directions"
          style={[styles.closeButton, { backgroundColor: actionBg }]}
          testID="directions-mode-close"
        >
          <MaterialIcons name="close" size={20} color={actionTextColor} />
        </Pressable>
      </View>

      {/* Bottom card */}
      <View style={[styles.bottomCard, { backgroundColor: cardColor }]}>
        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Text style={styles.positionText} testID="directions-mode-position">
            Step {totalSteps > 0 ? safeIndex + 1 : 0} of {totalSteps}
          </Text>
        </View>

        <StepInstructionPanel
          titleText="Next action"
          maneuver={currentStep?.maneuver}
          instruction={currentStep?.instruction ?? 'Waiting for location…'}
          distanceText={currentStep?.distanceText}
          durationText={currentStep?.durationText}
          isLastStep={totalSteps > 0 && safeIndex === totalSteps - 1}
          actionBg={actionBg}
          actionTextColor={actionTextColor}
          onDone={onClose}
          doneAccessibilityLabel="Done directions"
          doneTestID="directions-mode-done"
        />
      </View>
    </View>
  );
}

const styles = {
  ...navigationSharedStyles,
  ...StyleSheet.create({
    trackingBadge: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 4,
    },
    trackingText: {
      fontSize: 12,
      fontWeight: '700' as const,
    },
  }),
};
