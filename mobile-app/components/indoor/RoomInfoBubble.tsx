/**
 * RoomInfoBubble – a floating card that appears when a room is selected
 * (either by tapping a marker on the indoor map or selecting an autocomplete result).
 *
 * Shows the room reference, floor level, and a "Navigate" button to start
 * indoor navigation to that room.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ResolvedRoom } from '../../services/indoor/roomResolver';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RoomInfoBubbleProps {
  /** The room to display info for. If null, nothing is rendered. */
  room: ResolvedRoom | null;
  /** Optional building name for display (e.g. "Henry F. Hall Building"). */
  buildingName?: string;
  /** Called when the user presses the Navigate button. */
  onNavigate: (room: ResolvedRoom) => void;
  /** Called when the user closes/dismisses the bubble. */
  onClose: () => void;
  /** Formatted estimated travel time, e.g. "~58 sec walk". Shown above the Navigate button. */
  estimatedTimeText?: string;
  /** Accent colour (defaults to Concordia red). */
  accentColor?: string;
  /** Distance from the bottom of the screen (defaults to 160). */
  bottomOffset?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format the level string for display (e.g. "-1" → "B1", "0" → "G", "8" → "Floor 8"). */
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

export default function RoomInfoBubble({
  room,
  buildingName,
  onNavigate,
  onClose,
  estimatedTimeText,
  accentColor = '#b21b2c',
  bottomOffset = 160,
}: Readonly<RoomInfoBubbleProps>) {
  if (!room) return null;

  return (
    <View style={[styles.container, { bottom: bottomOffset }]} testID="room-info-bubble">
      {/* Close button */}
      <Pressable
        style={styles.closeButton}
        onPress={onClose}
        accessibilityLabel="Close room info"
        accessibilityRole="button"
        hitSlop={8}
      >
        <MaterialIcons name="close" size={18} color="#666" />
      </Pressable>

      {/* Room reference (e.g. "H-840") */}
      <Text style={styles.roomRef} numberOfLines={1}>
        {room.ref}
      </Text>

      {/* Building name + floor */}
      <Text style={styles.meta} numberOfLines={1}>
        {buildingName ? `${buildingName} · ` : ''}
        {formatLevel(room.level)}
      </Text>

      {estimatedTimeText ? (
        <View style={styles.timeBadge} testID="room-time-badge">
          <MaterialIcons name="directions-walk" size={14} color="#555" />
          <Text style={styles.timeBadgeText}>{estimatedTimeText}</Text>
        </View>
      ) : null}

      {/* Navigate button */}
      <Pressable
        style={[styles.navigateButton, { backgroundColor: accentColor }]}
        onPress={() => onNavigate(room)}
        accessibilityLabel={`Navigate to room ${room.ref}`}
        accessibilityRole="button"
      >
        <MaterialIcons name="directions" size={18} color="#fff" />
        <Text style={styles.navigateText}>Navigate here</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    // bottom is set dynamically via the bottomOffset prop
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
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
  roomRef: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    marginBottom: 2,
  },
  meta: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  timeBadgeText: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 24,
    columnGap: 6,
  },
  navigateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
