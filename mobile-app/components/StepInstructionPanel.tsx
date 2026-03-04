import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getStepIcon } from '../utils/navigationStepUtils';
import { navigationSharedStyles as s } from '../utils/navigationStyles';

interface StepInstructionPanelProps {
  titleText: string;
  maneuver?: string;
  instruction?: string;
  distanceText?: string;
  durationText?: string;
  isLastStep: boolean;
  actionBg: string;
  actionTextColor: string;
  onDone: () => void;
  doneAccessibilityLabel: string;
  doneTestID: string;
}

export default function StepInstructionPanel({
  titleText,
  maneuver,
  instruction,
  distanceText,
  durationText,
  isLastStep,
  actionBg,
  actionTextColor,
  onDone,
  doneAccessibilityLabel,
  doneTestID,
}: Readonly<StepInstructionPanelProps>) {
  return (
    <>
      <Text style={s.instructionTitle}>{titleText}</Text>
      <View style={s.instructionRow}>
        <View style={s.instructionIconWrap}>
          <MaterialIcons name={getStepIcon(maneuver)} size={18} color="#fff" />
        </View>
        <Text style={s.instructionText} numberOfLines={3}>
          {instruction}
        </Text>
      </View>
      <Text style={s.metaText}>
        {distanceText ?? ''}
        {durationText ? ` · ${durationText}` : ''}
      </Text>
      {isLastStep && (
        <Pressable
          onPress={onDone}
          accessibilityRole="button"
          accessibilityLabel={doneAccessibilityLabel}
          style={[s.doneButton, { backgroundColor: actionBg }]}
          testID={doneTestID}
        >
          <Text style={[s.doneButtonText, { color: actionTextColor }]}>Done</Text>
        </Pressable>
      )}
    </>
  );
}
