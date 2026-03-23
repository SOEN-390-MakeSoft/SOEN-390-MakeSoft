/**
 * FloorSelector – a compact vertical pill for switching floor levels.
 *
 * Designed to sit alongside the map (typically right edge) and let users
 * quickly jump between floors of an indoor building.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

interface FloorSelectorProps {
  /** Sorted list of available levels. */
  levels: string[];
  /** Currently active level. */
  activeLevel: string;
  /** Called when the user taps a level. */
  onSelectLevel: (level: string) => void;
  /** Accent colour for the active chip (defaults to Concordia red). */
  accentColor?: string;
}

/** Map raw level strings to user-friendly labels. */
function levelLabel(level: string): string {
  const n = Number(level);
  if (Number.isNaN(n)) return level;
  if (n < 0) return `B${Math.abs(n)}`; // Basement levels
  if (n === 0) return 'G'; // Ground
  return String(n);
}

export default function FloorSelector({
  levels,
  activeLevel,
  onSelectLevel,
  accentColor = '#b21b2c',
}: Readonly<FloorSelectorProps>) {
  // Display levels top-to-bottom (highest first)
  const sorted = [...levels].sort((a, b) => Number(b) - Number(a));

  return (
    <View style={styles.container} testID="floor-selector">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {sorted.map((level) => {
          const isActive = level === activeLevel;
          return (
            <Pressable
              key={level}
              testID={`floor-btn-${level}`}
              onPress={() => onSelectLevel(level)}
              style={[styles.chip, isActive && { backgroundColor: accentColor }]}
            >
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {levelLabel(level)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    top: '30%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: 320,
  },
  scroll: {
    alignItems: 'center',
    gap: 2,
  },
  chip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  labelActive: {
    color: '#fff',
    fontWeight: '700',
  },
});
