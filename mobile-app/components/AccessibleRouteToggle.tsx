import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

interface AccessibleRouteToggleProps {
  enabled: boolean;
  chipColor: string;
  chipMutedColor: string;
  onToggle?: (nextEnabled: boolean) => void;
}

export default function AccessibleRouteToggle({
  enabled,
  chipColor,
  chipMutedColor,
  onToggle,
}: Readonly<AccessibleRouteToggleProps>) {
  const backgroundColor = enabled ? chipColor : chipMutedColor;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel="Accessible Route"
      accessibilityState={{ checked: enabled }}
      testID="accessible-route-toggle"
      onPress={() => onToggle?.(!enabled)}
      style={[styles.chip, enabled ? styles.chipEnabled : styles.chipDisabled, { backgroundColor }]}
    >
      <FontAwesome name="wheelchair" size={16} color="#fff" />
      <Text style={styles.label}>Accessible Route</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipEnabled: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  chipDisabled: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    opacity: 0.85,
  },
  label: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
