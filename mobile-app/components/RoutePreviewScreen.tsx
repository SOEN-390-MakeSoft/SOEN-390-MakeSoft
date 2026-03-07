import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from 'tamagui';
import type { NavigationStep } from '../hooks/useNavigationBetweenBuildings';
import { useSettings } from '../context/settings';

const STEP_ICON_MAP: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  'turn-left': 'turn-left',
  'turn-right': 'turn-right',
  'turn-slight-left': 'turn-slight-left',
  'turn-slight-right': 'turn-slight-right',
  'turn-sharp-left': 'turn-left',
  'turn-sharp-right': 'turn-right',
  'uturn-left': 'u-turn-left',
  'uturn-right': 'u-turn-right',
  merge: 'merge',
  'fork-left': 'fork-left',
  'fork-right': 'fork-right',
  'ramp-left': 'turn-slight-left',
  'ramp-right': 'turn-slight-right',
  'roundabout-left': 'roundabout-left',
  'roundabout-right': 'roundabout-right',
  straight: 'straight',
};

function getStepIcon(maneuver?: string): keyof typeof MaterialIcons.glyphMap {
  if (!maneuver) return 'straight';
  return STEP_ICON_MAP[maneuver] ?? 'straight';
}

interface RoutePreviewScreenProps {
  visible: boolean;
  steps: NavigationStep[];
  selectedStepIndex: number;
  onSelectStep: (index: number) => void;
  onClose: () => void;
  destinationLabel?: string;
}

export default function RoutePreviewScreen({
  visible,
  steps,
  selectedStepIndex,
  onSelectStep,
  onClose,
  destinationLabel = '',
}: Readonly<RoutePreviewScreenProps>) {
  const { colourBlindMode } = useSettings();
  const theme = useTheme();

  if (!visible) return null;

  const totalSteps = steps.length;
  const safeIndex = Math.min(Math.max(selectedStepIndex, 0), Math.max(totalSteps - 1, 0));
  const currentStep = steps[safeIndex];
  const colourBlindPrimary = theme?.colourBlind1?.get?.() ?? '#B3D4FF';
  const colourBlindAccent = theme?.colourBlind2?.get?.() ?? '#1F4E8C';
  const cardColor = colourBlindMode ? colourBlindAccent : '#8e2334';
  const actionBg = colourBlindMode ? colourBlindPrimary : '#f6dce0';
  const actionTextColor = colourBlindMode ? '#1F4E8C' : '#7f1f2a';

  const handlePrevious = () => {
    onSelectStep(Math.max(safeIndex - 1, 0));
  };

  const handleNext = () => {
    onSelectStep(Math.min(safeIndex + 1, Math.max(totalSteps - 1, 0)));
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none" testID="route-preview-screen">
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <View style={styles.headerSpacer} />
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close preview"
          style={[styles.closeButton, { backgroundColor: actionBg }]}
          testID="route-preview-close"
        >
          <MaterialIcons name="close" size={20} color={actionTextColor} />
        </Pressable>
      </View>

      <View style={[styles.bottomCard, { backgroundColor: cardColor }]}>
        <View style={styles.controlsRow}>
          <Pressable
            onPress={handlePrevious}
            style={styles.arrowButton}
            accessibilityRole="button"
            accessibilityLabel="Previous preview step"
            testID="route-preview-prev"
          >
            <MaterialIcons name="keyboard-arrow-left" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.positionText} testID="route-preview-position">
            Step {totalSteps > 0 ? safeIndex + 1 : 0} of {totalSteps}
          </Text>
          <Pressable
            onPress={handleNext}
            style={styles.arrowButton}
            accessibilityRole="button"
            accessibilityLabel="Next preview step"
            testID="route-preview-next"
          >
            <MaterialIcons name="keyboard-arrow-right" size={24} color="#fff" />
          </Pressable>
        </View>
        {!!destinationLabel && (
          <Text style={styles.destinationText} testID="route-preview-destination">
            Destination: {destinationLabel}
          </Text>
        )}

        <Text style={styles.instructionTitle}>Current action</Text>
        <View style={styles.instructionRow}>
          <View style={styles.instructionIconWrap}>
            <MaterialIcons name={getStepIcon(currentStep?.maneuver)} size={18} color="#fff" />
          </View>
          <Text style={styles.instructionText} numberOfLines={3}>
            {currentStep?.instruction ?? 'No route steps available'}
          </Text>
        </View>
        <Text style={styles.metaText}>
          {currentStep?.distanceText ?? ''}
          {currentStep?.durationText ? ` · ${currentStep.durationText}` : ''}
        </Text>

        {totalSteps > 0 && safeIndex === totalSteps - 1 && (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Done preview"
            style={[styles.doneButton, { backgroundColor: actionBg }]}
            testID="route-preview-done"
          >
            <Text style={[styles.doneButtonText, { color: actionTextColor }]}>Done</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 14,
    paddingBottom: 22,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 40,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCard: {
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  positionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  instructionTitle: {
    marginTop: 10,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  destinationText: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  instructionRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  instructionIconWrap: {
    width: 26,
    alignItems: 'center',
    paddingTop: 1,
    marginRight: 6,
  },
  instructionText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
    flex: 1,
  },
  metaText: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
  },
  doneButton: {
    marginTop: 12,
    alignSelf: 'center',
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 9,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
