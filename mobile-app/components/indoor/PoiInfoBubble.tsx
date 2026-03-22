/**
 * PoiInfoBubble – a floating card that appears when a POI is selected
 * (either by tapping a marker on the indoor map or selecting an autocomplete result).
 * Shows the POI title, floor level, and a "Navigate" button to start
 * indoor navigation to that POI.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PoiInfoBubbleProps {
  poiTitle: string;
  level?: string;
  buildingName?: string;
  onClose: () => void;
  accentColor?: string;
  bottomOffset?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLevel(level: string): string {
  const n = Number(level);
  if (Number.isNaN(n)) return `Level ${level}`;
  if (n < 0) return `Basement ${Math.abs(n)}`;
  if (n === 0) return 'Ground floor';
  return `Floor ${n}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PoiInfoBubble({
  poiTitle,
  level,
  buildingName,
  onClose,
  accentColor = '#b21b2c',
  bottomOffset = 160,
}: Readonly<PoiInfoBubbleProps>) {
  return (
    <View style={[styles.container, { bottom: bottomOffset }]} testID="poi-info-bubble">
      {/* Close button */}
      <Pressable
        style={styles.closeButton}
        onPress={onClose}
        accessibilityLabel="Close POI info"
        accessibilityRole="button"
        hitSlop={8}
      >
        <MaterialIcons name="close" size={18} color="#666" />
      </Pressable>

      {/* POI Title (e.g. "Washroom") */}
      <Text style={styles.poiTitle} numberOfLines={1}>
        {poiTitle}
      </Text>

      {/* Building name + floor */}
      <Text style={styles.meta} numberOfLines={1}>
        {buildingName ? `${buildingName} · ` : ''}
        {level ? formatLevel(level) : ''}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 24,
    minWidth: 200,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
  poiTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 4,
  },
  meta: {
    fontSize: 14,
    color: '#666',
  },
});
