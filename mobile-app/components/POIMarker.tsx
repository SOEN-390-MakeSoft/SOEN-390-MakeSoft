import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { OutdoorPOI } from '../services/outdoorPOIService';

type Props = {
  poi: OutdoorPOI;
  iconName?: keyof typeof MaterialIcons.glyphMap;
  onPress?: () => void;
  testID?: string;
  zIndex?: number;
  markerColor?: string;
};

export default function POIMarker({
  poi,
  iconName = 'place',
  onPress,
  testID,
  zIndex,
  markerColor = '#912338',
}: Props) {
  return (
    <Marker coordinate={poi.coordinate} testID={testID} zIndex={zIndex} onPress={onPress}>
      <View style={[styles.markerPin, { backgroundColor: markerColor }]}>
        <MaterialIcons name={iconName} size={16} color="#fff" />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 5,
  },
});
