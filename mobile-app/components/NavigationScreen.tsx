import React, { useEffect, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { NavigationStep, ShuttleInfo } from '../hooks/useNavigationBetweenBuildings';
import NavigationMenu from './NavigationMenu';
import { useSettings } from '../context/settings';

export type DirectionsErrorType = 'same_origin_destination' | 'missing_coordinates' | null;

type TransportMode = 'driving' | 'walking' | 'shuttle';

interface NavigationScreenProps {
  visible: boolean;
  startLabel: string;
  destinationLabel: string;
  onClose: () => void;
  onActiveFieldChange?: (field: 'start' | 'destination' | null) => void;
  onBuildingSelect?: (field: 'start' | 'destination', name: string, code: string | null) => void;
  modeDurations?: {
    driving?: string;
    walking?: string;
  };
  tripSummary?: {
    arrivalText: string;
    distanceText: string;
    durationText: string;
    viaText: string;
  } | null;
  isLoading?: boolean;
  directionsError?: DirectionsErrorType;
  isGetDirectionsDisabled?: boolean;
  selectedTransportMode?: TransportMode;
  onTransportModeChange?: (mode: TransportMode) => void;
  navigationSteps?: NavigationStep[];
  /** Whether the route is a cross-campus route (SGW ↔ Loyola) */
  isShuttleRoute?: boolean;
  /** Whether shuttle schedule is loading */
  isShuttleLoading?: boolean;
  /** Shuttle departure times and route info returned from the backend */
  shuttleInfo?: ShuttleInfo | null;
  /** Whether today is a weekend (shuttle not available) */
  isWeekend?: boolean;
  onOpenPreview?: () => void;
}

const DRAG_THRESHOLD = 40;

const DIRECTIONS_ERROR_MESSAGES: Record<NonNullable<DirectionsErrorType>, string> = {
  same_origin_destination: 'Origin and destination cannot be the same.',
  missing_coordinates: 'Coordinates are missing for the selected name.',
};

function ModeChip({
  mode,
  icon,
  label,
  isSelected,
  chipColor,
  chipMutedColor,
  onPress,
}: Readonly<{
  mode: TransportMode;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  isSelected: boolean;
  chipColor: string;
  chipMutedColor: string;
  onPress: (mode: TransportMode) => void;
}>) {
  return (
    <Pressable
      onPress={() => onPress(mode)}
      testID={`mode-chip-${mode}`}
      style={
        isSelected
          ? [styles.modeChip, styles.modeChipSelected, { backgroundColor: chipColor }]
          : [styles.modeChipMuted, { backgroundColor: chipMutedColor }]
      }
    >
      <MaterialIcons name={icon} size={18} color="#fff" />
      <Text style={styles.modeText}>{label}</Text>
    </Pressable>
  );
}

export default function NavigationScreen({
  visible,
  startLabel,
  destinationLabel,
  onClose,
  onActiveFieldChange,
  onBuildingSelect,
  modeDurations,
  tripSummary,
  isLoading,
  directionsError = null,
  isGetDirectionsDisabled = true,
  selectedTransportMode = 'driving',
  onTransportModeChange,
  navigationSteps = [],
  isShuttleRoute = false,
  isShuttleLoading = false,
  shuttleInfo = null,
  isWeekend = false,
  onOpenPreview,
}: Readonly<NavigationScreenProps>) {
  const { colourBlindMode } = useSettings();
  const [isMinimized, setIsMinimized] = useState(false);
  const isMinimizedRef = React.useRef(false);

  const hasSteps = navigationSteps.length > 0;
  const isPreviewButtonDisabled = isGetDirectionsDisabled || !hasSteps;

  useEffect(() => {
    isMinimizedRef.current = isMinimized;
  }, [isMinimized]);

  let tripTitleText = 'Select start and destination';
  if (isLoading) {
    tripTitleText = 'Loading route...';
  }
  if (tripSummary) {
    tripTitleText = `Arrive at ${tripSummary.arrivalText} - via ${tripSummary.viaText}`;
  }

  const bottomCardColor = colourBlindMode ? '#9aa7b2' : '#8e2334';
  const chipColor = colourBlindMode ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.30)';
  const chipMutedColor = colourBlindMode ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.14)';
  const closeBg = colourBlindMode ? '#e6eaee' : '#f6dce0';
  const closeIcon = colourBlindMode ? '#4b5862' : '#7f1f2a';
  const previewBg = colourBlindMode ? '#e6eaee' : '#f6dce0';
  const previewTextColor = colourBlindMode ? '#4b5862' : '#7f1f2a';

  const handleToggleMinimized = () => {
    setIsMinimized((prev) => !prev);
  };

  const handleOpenPreview = () => {
    if (isPreviewButtonDisabled) return;
    setIsMinimized(false);
    onOpenPreview?.();
  };

  const handlePanRelease = (_: unknown, dy: number) => {
    const currentlyMinimized = isMinimizedRef.current;
    const nextMinimized = currentlyMinimized ? dy >= -DRAG_THRESHOLD : dy > DRAG_THRESHOLD;
    setIsMinimized(nextMinimized);
  };

  const handlePanResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderRelease: (_, gestureState) => {
        handlePanRelease(_, gestureState.dy);
      },
      onPanResponderTerminate: (_, gestureState) => {
        handlePanRelease(_, gestureState.dy);
      },
    }),
  ).current;

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <NavigationMenu
        startLabel={startLabel}
        destinationLabel={destinationLabel}
        onActiveFieldChange={onActiveFieldChange}
        onBuildingSelect={onBuildingSelect}
      />

      <View
        style={[
          styles.bottomCard,
          isMinimized && styles.bottomCardMinimized,
          { backgroundColor: bottomCardColor },
        ]}
      >
        <Pressable
          onPress={handleToggleMinimized}
          style={styles.minimizeHandleTouch}
          {...handlePanResponder.panHandlers}
          accessibilityRole="button"
          accessibilityLabel={isMinimized ? 'Expand menu' : 'Minimize menu'}
          testID="menu-minimize-toggle"
        >
          <View style={styles.minimizeHandleBar} />
        </Pressable>
        <View style={styles.bottomHeader}>
          <View style={styles.tripModeRow}>
            <ModeChip
              mode="driving"
              icon="directions-car"
              label={modeDurations?.driving ?? '--'}
              isSelected={selectedTransportMode === 'driving'}
              chipColor={chipColor}
              chipMutedColor={chipMutedColor}
              onPress={onTransportModeChange ?? (() => {})}
            />
            <ModeChip
              mode="walking"
              icon="directions-walk"
              label={modeDurations?.walking ?? '--'}
              isSelected={selectedTransportMode === 'walking'}
              chipColor={chipColor}
              chipMutedColor={chipMutedColor}
              onPress={onTransportModeChange ?? (() => {})}
            />
            {isShuttleRoute ? (
              isWeekend ? (
                // Cross-campus but weekend — show disabled chip with N/A label
                <View
                  testID="mode-chip-shuttle-disabled"
                  style={[styles.modeChipDisabled, { backgroundColor: chipMutedColor }]}
                >
                  <MaterialIcons name="directions-bus" size={18} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.shuttleUnavailableText}>N/A</Text>
                </View>
              ) : (
                // Cross-campus weekday — fully enabled shuttle chip
                <ModeChip
                  mode="shuttle"
                  icon="directions-bus"
                  label="Shuttle"
                  isSelected={selectedTransportMode === 'shuttle'}
                  chipColor={chipColor}
                  chipMutedColor={chipMutedColor}
                  onPress={onTransportModeChange ?? (() => {})}
                />
              )
            ) : (
              // Not a cross-campus route — show plain disabled bus icon, no text
              <View
                testID="mode-chip-shuttle-disabled"
                style={[styles.modeChipDisabled, { backgroundColor: chipMutedColor }]}
              >
                <MaterialIcons name="directions-bus" size={18} color="rgba(255,255,255,0.4)" />
              </View>
            )}
          </View>
          <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: closeBg }]}>
            <MaterialIcons name="close" size={18} color={closeIcon} />
          </Pressable>
        </View>
        <Text style={styles.tripTitle} numberOfLines={2}>
          {selectedTransportMode === 'shuttle' && isShuttleRoute
            ? isShuttleLoading
              ? 'Loading shuttle times...'
              : 'Shuttle - next departures'
            : tripTitleText}
        </Text>
        {tripSummary && selectedTransportMode !== 'shuttle' ? (
          <Text style={styles.tripMeta} numberOfLines={1}>
            {tripSummary.distanceText} - {tripSummary.durationText}
          </Text>
        ) : null}
        {/* Shuttle departure times panel */}
        {selectedTransportMode === 'shuttle' &&
        isShuttleRoute &&
        !isShuttleLoading &&
        shuttleInfo ? (
          <View style={styles.shuttlePanel} testID="shuttle-departures-panel">
            <Text style={styles.shuttleHubText}>
              {`Departs from ${shuttleInfo.departureCampus === 'SGW' ? 'Hall Building (SGW)' : 'Vanier Library (Loyola)'}`}
            </Text>
            <View style={styles.shuttleTimesRow}>
              {shuttleInfo.departureTimes.map((t, i) =>
                t ? (
                  <View
                    key={`dep-${i}`}
                    style={styles.shuttleTimeChip}
                    testID={`shuttle-time-${i}`}
                  >
                    <MaterialIcons name="directions-bus" size={14} color="#fff" />
                    <Text style={styles.shuttleTimeText}>
                      {new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                ) : null,
              )}
              {shuttleInfo.departureTimes.every((t) => t === null) ? (
                <Text style={styles.shuttleNoMore} testID="shuttle-no-more">
                  No more shuttles today
                </Text>
              ) : null}
            </View>
            <Text style={styles.shuttleRideTime}>{`~${shuttleInfo.tripDurationMin} min ride`}</Text>
          </View>
        ) : null}
        {selectedTransportMode === 'shuttle' && isWeekend && isShuttleRoute ? (
          <Text style={styles.shuttleWeekendText} testID="shuttle-weekend-notice">
            Shuttle service is not available on weekends.
          </Text>
        ) : null}
        {directionsError ? (
          <Text style={styles.errorText} testID="directions-error">
            {DIRECTIONS_ERROR_MESSAGES[directionsError]}
          </Text>
        ) : null}
        {navigationSteps.length > 0 ? (
          <ScrollView
            style={styles.scrollableContent}
            showsVerticalScrollIndicator
            nestedScrollEnabled
          >
            <Pressable
              style={[
                styles.getDirectionsButton,
                { backgroundColor: previewBg },
                isPreviewButtonDisabled && styles.getDirectionsButtonDisabled,
              ]}
              disabled={isPreviewButtonDisabled}
              onPress={handleOpenPreview}
              accessibilityRole="button"
              accessibilityLabel="Preview route"
              testID="preview-route-button"
            >
              <MaterialIcons
                name="arrow-forward"
                size={16}
                color={isPreviewButtonDisabled ? '#9b9b9b' : previewTextColor}
              />
              <Text
                style={[
                  styles.getDirectionsText,
                  {
                    color: isPreviewButtonDisabled ? '#9b9b9b' : previewTextColor,
                  },
                ]}
              >
                Preview
              </Text>
            </Pressable>
            {hasSteps && (
              <View testID="navigation-steps-list" style={styles.stepsList}>
                {navigationSteps.map((step, index) => (
                  <View key={step.instruction} testID={`nav-step-${index}`} style={styles.stepRow}>
                    <Text style={styles.stepInstruction}>{step.instruction}</Text>
                    <Text style={styles.stepMeta}>
                      {step.durationText
                        ? `${step.distanceText} · ${step.durationText}`
                        : step.distanceText}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  bottomCard: {
    backgroundColor: '#8e2334',
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 22,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomCardMinimized: {
    paddingBottom: 10,
  },
  scrollableContent: {
    maxHeight: 350,
  },
  minimizeHandleTouch: {
    alignSelf: 'center',
    paddingBottom: 8,
  },
  minimizeHandleBar: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  bottomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tripModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    flexWrap: 'nowrap',
    paddingRight: 40,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modeChipSelected: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  modeChipMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modeChipDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    opacity: 0.45,
  },
  modeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f6dce0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
    elevation: 3,
  },
  tripTitle: {
    marginTop: 12,
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  tripMeta: { marginTop: 4, fontSize: 14, color: '#f3d7dc' },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },
  getDirectionsButton: {
    marginTop: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    backgroundColor: '#f6dce0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  getDirectionsButtonDisabled: {
    opacity: 0.6,
  },
  getDirectionsText: { fontSize: 14, fontWeight: '700' },
  stepsList: {
    marginTop: 12,
  },
  stepRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  stepInstruction: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  stepMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  shuttleUnavailableText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    marginLeft: 4,
    fontWeight: '600',
  },
  shuttlePanel: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 12,
  },
  shuttleHubText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 8,
    fontWeight: '600',
  },
  shuttleTimesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    columnGap: 8,
    marginBottom: 6,
  },
  shuttleTimeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  shuttleTimeText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '700',
  },
  shuttleNoMore: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic',
  },
  shuttleRideTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
  },
  shuttleWeekendText: {
    marginTop: 10,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
