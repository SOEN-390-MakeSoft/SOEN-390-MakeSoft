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
  destinationLocked?: boolean;
  onClose: () => void;
  onActiveFieldChange?: (field: 'start' | 'destination' | null) => void;
  onBuildingSelect?: (field: 'start' | 'destination', name: string, code: string | null) => void;
  onRoomSelect?: (
    field: 'start' | 'destination',
    room: { buildingCode: string; roomRef: string },
  ) => void;
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
  /** Override title line with a combined ETA breakdown (e.g., "12 min total: ..."). */
  tripTimeSummary?: string | null;
  isLoading?: boolean;
  directionsError?: DirectionsErrorType;
  isGetDirectionsDisabled?: boolean;
  selectedTransportMode?: TransportMode;
  onTransportModeChange?: (mode: TransportMode) => void;
  disabledTransportModes?: TransportMode[];
  onDisabledTransportModePress?: (mode: TransportMode) => void;
  navigationSteps?: NavigationStep[];
  /** Whether the route is a cross-campus route (SGW <-> Loyola) */
  isShuttleRoute?: boolean;
  /** Whether shuttle schedule is loading */
  isShuttleLoading?: boolean;
  /** Shuttle departure times and route info returned from the backend */
  shuttleInfo?: ShuttleInfo | null;
  /** Whether today is a weekend (shuttle not available) */
  isWeekend?: boolean;
  onOpenPreview?: () => void;
  onOpenDirections?: () => void;
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
  isDisabled = false,
  chipColor,
  chipMutedColor,
  onPress,
}: Readonly<{
  mode: TransportMode;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  isSelected: boolean;
  isDisabled?: boolean;
  chipColor: string;
  chipMutedColor: string;
  onPress: () => void;
}>) {
  return (
    <Pressable
      onPress={onPress}
      testID={`mode-chip-${mode}`}
      style={
        isDisabled
          ? [styles.modeChipMuted, styles.modeChipLate, { backgroundColor: chipMutedColor }]
          : isSelected
            ? [styles.modeChip, styles.modeChipSelected, { backgroundColor: chipColor }]
            : [styles.modeChipMuted, { backgroundColor: chipMutedColor }]
      }
    >
      <MaterialIcons name={icon} size={18} color="#fff" />
      <Text style={styles.modeText}>{label}</Text>
    </Pressable>
  );
}

function renderShuttleChip({
  isShuttleRoute,
  isWeekend,
  isDisabled,
  selectedTransportMode,
  chipColor,
  chipMutedColor,
  onTransportModeChange,
  onDisabledTransportModePress,
}: Readonly<{
  isShuttleRoute: boolean;
  isWeekend: boolean;
  isDisabled: boolean;
  selectedTransportMode: TransportMode;
  chipColor: string;
  chipMutedColor: string;
  onTransportModeChange?: (mode: TransportMode) => void;
  onDisabledTransportModePress?: (mode: TransportMode) => void;
}>) {
  if (isShuttleRoute && isWeekend) {
    return (
      <View
        testID="mode-chip-shuttle-disabled"
        style={[styles.modeChipDisabled, { backgroundColor: chipMutedColor }]}
      >
        <MaterialIcons name="directions-bus" size={18} color="rgba(255,255,255,0.4)" />
        <Text style={styles.shuttleUnavailableText}>N/A</Text>
      </View>
    );
  }

  if (isShuttleRoute) {
    return (
      <ModeChip
        mode="shuttle"
        icon="directions-bus"
        label="Shuttle"
        isSelected={selectedTransportMode === 'shuttle'}
        isDisabled={isDisabled}
        chipColor={chipColor}
        chipMutedColor={chipMutedColor}
        onPress={() => {
          if (isDisabled) {
            onDisabledTransportModePress?.('shuttle');
            return;
          }
          onTransportModeChange?.('shuttle');
        }}
      />
    );
  }

  return (
    <View
      testID="mode-chip-shuttle-disabled"
      style={[styles.modeChipDisabled, { backgroundColor: chipMutedColor }]}
    >
      <MaterialIcons name="directions-bus" size={18} color="rgba(255,255,255,0.4)" />
    </View>
  );
}

type ThemeColors = {
  bottomCardColor: string;
  chipColor: string;
  chipMutedColor: string;
  closeBg: string;
  closeIcon: string;
  previewBg: string;
  previewTextColor: string;
};

function getThemeColors(colourBlindMode: boolean): ThemeColors {
  if (colourBlindMode) {
    return {
      bottomCardColor: '#9aa7b2',
      chipColor: 'rgba(255,255,255,0.34)',
      chipMutedColor: 'rgba(255,255,255,0.18)',
      closeBg: '#e6eaee',
      closeIcon: '#4b5862',
      previewBg: '#e6eaee',
      previewTextColor: '#4b5862',
    };
  }

  return {
    bottomCardColor: '#8e2334',
    chipColor: 'rgba(255,255,255,0.30)',
    chipMutedColor: 'rgba(255,255,255,0.14)',
    closeBg: '#f6dce0',
    closeIcon: '#7f1f2a',
    previewBg: '#f6dce0',
    previewTextColor: '#7f1f2a',
  };
}

function getTripTitleText({
  isLoading,
  tripSummary,
  tripTimeSummary,
  selectedTransportMode,
  isShuttleRoute,
  isShuttleLoading,
}: Readonly<{
  isLoading?: boolean;
  tripSummary?: NavigationScreenProps['tripSummary'];
  tripTimeSummary?: NavigationScreenProps['tripTimeSummary'];
  selectedTransportMode: TransportMode;
  isShuttleRoute: boolean;
  isShuttleLoading: boolean;
}>): string {
  if (tripTimeSummary) {
    return tripTimeSummary;
  }

  if (selectedTransportMode === 'shuttle' && isShuttleRoute) {
    return isShuttleLoading ? 'Loading shuttle times...' : 'Shuttle - next departures';
  }

  if (tripSummary) {
    return `Arrive at ${tripSummary.arrivalText} - via ${tripSummary.viaText}`;
  }

  if (isLoading) {
    return 'Loading route...';
  }

  return 'Select start and destination';
}

function TripMeta({
  tripSummary,
  selectedTransportMode,
}: Readonly<{
  tripSummary?: NavigationScreenProps['tripSummary'];
  selectedTransportMode: TransportMode;
}>) {
  if (!tripSummary || selectedTransportMode === 'shuttle') return null;

  return (
    <Text style={styles.tripMeta} numberOfLines={1}>
      {tripSummary.distanceText} - {tripSummary.durationText}
    </Text>
  );
}

function ShuttleDeparturesPanel({
  show,
  shuttleInfo,
}: Readonly<{
  show: boolean;
  shuttleInfo: ShuttleInfo | null;
}>) {
  if (!show || !shuttleInfo) return null;

  const formatHoursMinutes = (totalMinutes: number): string => {
    const safeMinutes = Math.max(0, Math.round(totalMinutes));
    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours} h ${minutes} min`;
    if (hours > 0) return `${hours} h`;
    return `${minutes} min`;
  };

  const departureHubLabel =
    shuttleInfo.departureCampus === 'SGW' ? 'Hall Building (SGW)' : 'Vanier Library (Loyola)';
  const firstDeparture =
    shuttleInfo.departureTimes.find(
      (value): value is string => typeof value === 'string' && value.length > 0,
    ) ?? null;
  const noMoreShuttles = firstDeparture === null;
  const hasDirections = shuttleInfo.hasDirections !== false;
  const waitTimeText =
    shuttleInfo.waitDurationMin != null && shuttleInfo.waitDurationMin > 0
      ? formatHoursMinutes(shuttleInfo.waitDurationMin)
      : null;

  return (
    <View style={styles.shuttlePanel} testID="shuttle-departures-panel">
      <Text style={styles.shuttleHubText}>{`Departs from ${departureHubLabel}`}</Text>
      <View style={styles.shuttleTimesRow}>
        {firstDeparture ? (
          <View
            key={`dep-${firstDeparture}`}
            style={styles.shuttleTimeChip}
            testID="shuttle-time-0"
          >
            <MaterialIcons name="directions-bus" size={14} color="#fff" />
            <Text style={styles.shuttleTimeText}>
              {new Date(firstDeparture).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>
        ) : null}
        {noMoreShuttles ? (
          <Text style={styles.shuttleNoMore} testID="shuttle-no-more">
            No more shuttles today
          </Text>
        ) : null}
      </View>
      {!noMoreShuttles && waitTimeText ? (
        <Text
          style={styles.shuttleRideTime}
          testID="shuttle-wait-time"
        >{`Wait: ${waitTimeText}`}</Text>
      ) : null}
      {!noMoreShuttles && !hasDirections ? (
        <Text style={styles.shuttleNoMore} testID="shuttle-long-wait-notice">
          Wait exceeds 2 h. Showing next shuttle only (no directions).
        </Text>
      ) : null}
      {!noMoreShuttles && hasDirections ? (
        <Text style={styles.shuttleRideTime}>{`~${shuttleInfo.tripDurationMin} min ride`}</Text>
      ) : null}
    </View>
  );
}

function ShuttleWeekendNotice({ show }: Readonly<{ show: boolean }>) {
  if (!show) return null;

  return (
    <Text style={styles.shuttleWeekendText} testID="shuttle-weekend-notice">
      Shuttle service is not available on weekends.
    </Text>
  );
}

function DirectionsErrorNotice({
  directionsError,
}: Readonly<{ directionsError: DirectionsErrorType }>) {
  if (!directionsError) return null;

  return (
    <Text style={styles.errorText} testID="directions-error">
      {DIRECTIONS_ERROR_MESSAGES[directionsError]}
    </Text>
  );
}

function formatStepMeta(step: NavigationStep): string {
  if (step.durationText) {
    return `${step.distanceText} \u00B7 ${step.durationText}`;
  }
  return step.distanceText;
}

function PreviewAndSteps({
  hasSteps,
  isPreviewButtonDisabled,
  previewBg,
  previewTextColor,
  onOpenPreview,
  onOpenDirections,
  navigationSteps,
}: Readonly<{
  hasSteps: boolean;
  isPreviewButtonDisabled: boolean;
  previewBg: string;
  previewTextColor: string;
  onOpenPreview: () => void;
  onOpenDirections?: () => void;
  navigationSteps: NavigationStep[];
}>) {
  if (!hasSteps) return null;

  const buttonTextColor = isPreviewButtonDisabled ? '#9b9b9b' : previewTextColor;

  return (
    <ScrollView style={styles.scrollableContent} showsVerticalScrollIndicator nestedScrollEnabled>
      <View style={styles.actionButtonsRow}>
        <Pressable
          style={[
            styles.getDirectionsButton,
            styles.getDirectionsButtonFlex,
            { backgroundColor: previewBg },
            isPreviewButtonDisabled && styles.getDirectionsButtonDisabled,
          ]}
          disabled={isPreviewButtonDisabled}
          onPress={onOpenPreview}
          accessibilityRole="button"
          accessibilityLabel="Preview route"
          testID="preview-route-button"
        >
          <MaterialIcons name="arrow-forward" size={16} color={buttonTextColor} />
          <Text style={[styles.getDirectionsText, { color: buttonTextColor }]}>Preview</Text>
        </Pressable>
        <Pressable
          style={[
            styles.getDirectionsButton,
            styles.getDirectionsButtonFlex,
            { backgroundColor: previewBg },
            isPreviewButtonDisabled && styles.getDirectionsButtonDisabled,
          ]}
          disabled={isPreviewButtonDisabled}
          onPress={onOpenDirections}
          accessibilityRole="button"
          accessibilityLabel="Start turn-by-turn directions"
          testID="directions-mode-button"
        >
          <MaterialIcons name="navigation" size={16} color={buttonTextColor} />
          <Text style={[styles.getDirectionsText, { color: buttonTextColor }]}>Directions</Text>
        </Pressable>
      </View>
      <View testID="navigation-steps-list" style={styles.stepsList}>
        {navigationSteps.map((step, index) => {
          const stepKey = [
            step.instruction,
            step.distanceText,
            step.durationText,
            step.maneuver ?? '',
            step.focusCoordinate?.latitude ?? '',
            step.focusCoordinate?.longitude ?? '',
            index,
          ].join('|');

          return (
            <View key={stepKey} testID={`nav-step-${index}`} style={styles.stepRow}>
              <Text style={styles.stepInstruction}>{step.instruction}</Text>
              <Text style={styles.stepMeta}>{formatStepMeta(step)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

export default function NavigationScreen({
  visible,
  startLabel,
  destinationLabel,
  destinationLocked = false,
  onClose,
  onActiveFieldChange,
  onBuildingSelect,
  onRoomSelect,
  modeDurations,
  tripSummary,
  tripTimeSummary,
  isLoading,
  directionsError = null,
  isGetDirectionsDisabled = true,
  selectedTransportMode = 'driving',
  onTransportModeChange,
  disabledTransportModes = [],
  onDisabledTransportModePress,
  navigationSteps = [],
  isShuttleRoute = false,
  isShuttleLoading = false,
  shuttleInfo = null,
  isWeekend = false,
  onOpenPreview,
  onOpenDirections,
}: Readonly<NavigationScreenProps>) {
  const { colourBlindMode } = useSettings();
  const [isMinimized, setIsMinimized] = useState(false);
  const isMinimizedRef = React.useRef(false);

  const hasSteps = navigationSteps.length > 0;
  const isPreviewButtonDisabled = isGetDirectionsDisabled || !hasSteps;
  const themeColors = getThemeColors(colourBlindMode);
  const tripTitleText = getTripTitleText({
    isLoading,
    tripSummary,
    tripTimeSummary,
    selectedTransportMode,
    isShuttleRoute,
    isShuttleLoading,
  });
  const showShuttlePanel =
    selectedTransportMode === 'shuttle' && isShuttleRoute && !isShuttleLoading && !!shuttleInfo;
  const showShuttleWeekendNotice =
    selectedTransportMode === 'shuttle' && isWeekend && isShuttleRoute;

  const isModeDisabled = (mode: TransportMode) => disabledTransportModes.includes(mode);

  const handleOpenPreview = () => {
    if (isPreviewButtonDisabled) return;
    setIsMinimized(false);
    onOpenPreview?.();
  };

  const handleOpenDirections = () => {
    if (isPreviewButtonDisabled) return;
    setIsMinimized(false);
    onOpenDirections?.();
  };

  const handlePanRelease = (_: unknown, gestureState: { dy: number; dx: number }) => {
    const { dy, dx } = gestureState;
    const currentlyMinimized = isMinimizedRef.current;

    // Tap (very little movement) → toggle minimized state
    if (Math.abs(dy) < 6 && Math.abs(dx) < 6) {
      setIsMinimized(!currentlyMinimized);
      return;
    }

    // Swipe: expand if swiped up past threshold; minimize if swiped down
    const nextMinimized = currentlyMinimized ? dy >= -DRAG_THRESHOLD : dy > DRAG_THRESHOLD;
    setIsMinimized(nextMinimized);
  };

  const handlePanResponder = React.useRef(
    PanResponder.create({
      // Immediately claim the gesture so Pressable / ScrollView don't steal it
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, gestureState) => {
        handlePanRelease(_, gestureState);
      },
      onPanResponderTerminate: (_, gestureState) => {
        handlePanRelease(_, gestureState);
      },
    }),
  ).current;

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <NavigationMenu
        startLabel={startLabel}
        destinationLabel={destinationLabel}
        destinationLocked={destinationLocked}
        onActiveFieldChange={onActiveFieldChange}
        onBuildingSelect={onBuildingSelect}
        onRoomSelect={onRoomSelect}
      />

      <View
        style={[
          styles.bottomCard,
          isMinimized && styles.bottomCardMinimized,
          { backgroundColor: themeColors.bottomCardColor },
        ]}
      >
        <Pressable
          style={styles.minimizeHandleTouch}
          {...handlePanResponder.panHandlers}
          onPress={() => setIsMinimized((prev) => !prev)}
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
              isDisabled={isModeDisabled('driving')}
              chipColor={themeColors.chipColor}
              chipMutedColor={themeColors.chipMutedColor}
              onPress={() => {
                if (isModeDisabled('driving')) {
                  onDisabledTransportModePress?.('driving');
                  return;
                }
                onTransportModeChange?.('driving');
              }}
            />
            <ModeChip
              mode="walking"
              icon="directions-walk"
              label={modeDurations?.walking ?? '--'}
              isSelected={selectedTransportMode === 'walking'}
              isDisabled={isModeDisabled('walking')}
              chipColor={themeColors.chipColor}
              chipMutedColor={themeColors.chipMutedColor}
              onPress={() => {
                if (isModeDisabled('walking')) {
                  onDisabledTransportModePress?.('walking');
                  return;
                }
                onTransportModeChange?.('walking');
              }}
            />
            {renderShuttleChip({
              isShuttleRoute,
              isWeekend,
              isDisabled: isModeDisabled('shuttle'),
              selectedTransportMode,
              chipColor: themeColors.chipColor,
              chipMutedColor: themeColors.chipMutedColor,
              onTransportModeChange,
              onDisabledTransportModePress,
            })}
          </View>
          <Pressable
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: themeColors.closeBg }]}
          >
            <MaterialIcons name="close" size={18} color={themeColors.closeIcon} />
          </Pressable>
        </View>
        {!isMinimized && (
          <>
            <Text style={styles.tripTitle} numberOfLines={2}>
              {tripTitleText}
            </Text>
            <TripMeta tripSummary={tripSummary} selectedTransportMode={selectedTransportMode} />
            <ShuttleDeparturesPanel show={showShuttlePanel} shuttleInfo={shuttleInfo} />
            <ShuttleWeekendNotice show={showShuttleWeekendNotice} />
            <DirectionsErrorNotice directionsError={directionsError} />
            <PreviewAndSteps
              hasSteps={hasSteps}
              isPreviewButtonDisabled={isPreviewButtonDisabled}
              previewBg={themeColors.previewBg}
              previewTextColor={themeColors.previewTextColor}
              onOpenPreview={handleOpenPreview}
              onOpenDirections={handleOpenDirections}
              navigationSteps={navigationSteps}
            />
          </>
        )}
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
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 10,
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
  modeChipLate: {
    opacity: 0.55,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
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
  actionButtonsRow: {
    marginTop: 14,
    flexDirection: 'row',
    columnGap: 10,
    justifyContent: 'center',
  },
  getDirectionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 6,
    backgroundColor: '#f6dce0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  getDirectionsButtonFlex: {
    flex: 1,
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
