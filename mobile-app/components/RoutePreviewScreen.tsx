import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from 'tamagui';
import type { NavigationStep } from '../hooks/useNavigationBetweenBuildings';
import { useSettings } from '../context/settings';
import { navigationSharedStyles } from '../utils/navigationStyles';
import StepInstructionPanel from './StepInstructionPanel';

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

        <StepInstructionPanel
          titleText="Current action"
          maneuver={currentStep?.maneuver}
          instruction={currentStep?.instruction ?? 'No route steps available'}
          distanceText={currentStep?.distanceText}
          durationText={currentStep?.durationText}
          isLastStep={totalSteps > 0 && safeIndex === totalSteps - 1}
          actionBg={actionBg}
          actionTextColor={actionTextColor}
          onDone={onClose}
          doneAccessibilityLabel="Done preview"
          doneTestID="route-preview-done"
        />
      </View>
    </View>
  );
}

const styles = {
  ...navigationSharedStyles,
  ...StyleSheet.create({
    destinationText: {
      marginTop: 8,
      fontSize: 13,
      color: 'rgba(255,255,255,0.85)',
      fontWeight: '600' as const,
    },
    arrowButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
  }),
};
