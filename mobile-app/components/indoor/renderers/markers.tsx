import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Marker } from 'react-native-maps';
import type { IndoorRoom, LatLng } from '../../../services/indoor/types';

export function RoomLabelMarker({
  room,
  shortLabel,
  onPress,
}: Readonly<{
  room: IndoorRoom;
  shortLabel: string;
  onPress?: () => void;
}>) {
  const [tracked, setTracked] = useState(true);

  const handleLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      if (tracked) {
        setTimeout(() => setTracked(false), Platform.OS === 'ios' ? 250 : 100);
      }
    },
    [tracked],
  );

  return (
    <Marker
      coordinate={room.centroid}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracked}
      zIndex={10}
      onPress={onPress}
    >
      <View collapsable={false} onLayout={handleLayout} style={indoorMarkerStyles.labelContainer}>
        <Text style={indoorMarkerStyles.labelText} allowFontScaling={false}>
          {shortLabel}
        </Text>
      </View>
    </Marker>
  );
}

export function IconMarker({
  coordinate,
  children,
  zIndex = 10,
  onPress,
  opacity,
}: Readonly<{
  coordinate: LatLng;
  children: React.ReactNode;
  zIndex?: number;
  onPress?: () => void;
  opacity?: number;
}>) {
  const [tracked, setTracked] = useState(true);

  const handleLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      if (tracked) {
        setTimeout(() => setTracked(false), Platform.OS === 'ios' ? 250 : 100);
      }
    },
    [tracked],
  );

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracked}
      zIndex={zIndex}
      onPress={onPress}
      opacity={opacity}
    >
      <View collapsable={false} onLayout={handleLayout} style={indoorMarkerStyles.iconContainer}>
        {children}
      </View>
    </Marker>
  );
}

export function PoiMarker({
  coordinate,
  children,
  zIndex = 10,
  opacity,
  onPress,
  testID,
  accessibilityLabel,
}: Readonly<{
  coordinate: LatLng;
  children: React.ReactNode;
  zIndex?: number;
  opacity?: number;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
}>) {
  const [tracked, setTracked] = useState(true);

  const handleLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      if (tracked) {
        setTimeout(() => setTracked(false), Platform.OS === 'ios' ? 250 : 100);
      }
    },
    [tracked],
  );

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracked}
      zIndex={zIndex}
      opacity={opacity}
      onPress={onPress}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      <View
        collapsable={false}
        onLayout={handleLayout}
        style={indoorMarkerStyles.poiMarkerContainer}
      >
        {children}
      </View>
    </Marker>
  );
}

export const indoorMarkerStyles = StyleSheet.create({
  labelContainer: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(120,140,170,0.5)',
  },
  labelText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  iconContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 14,
    padding: 5,
  },
  iconImage: {
    width: 14,
    height: 14,
    tintColor: '#fff',
  },
  poiIconImage: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  poiMarkerContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
