import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface DirectionButtonProps {
  onPress?: () => void;
  disabled?: boolean;
  label?: string;
  backgroundColor?: string;
  textColor?: string;
  iconColor?: string;
}

export default function DirectionButton({
  onPress,
  disabled = false,
  label = 'Directions',
  backgroundColor = '#b21b2c',
  textColor = '#fff',
  iconColor = '#fff',
}: Readonly<DirectionButtonProps>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Get directions"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor },
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <MaterialIcons name="assistant-direction" size={18} color={iconColor} />
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 8,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    marginTop: 14,
  },
  buttonPressed: { opacity: 0.9 },
  buttonDisabled: { opacity: 0.5 },
  text: { fontSize: 15, fontWeight: '600' },
});
