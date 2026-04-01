import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from 'tamagui';
import { getOutdoorPOICategoryLabel, type OutdoorPOI } from '../services/outdoorPOIService';
import DirectionButton from './DirectionButton';

interface OutdoorPOIInfoCardProps {
  poi: OutdoorPOI | null;
  onClose: () => void;
  onDirections?: () => void;
  isColorBlind: boolean;
}

export default function OutdoorPOIInfoCard({
  poi,
  onClose,
  onDirections,
  isColorBlind,
}: Readonly<OutdoorPOIInfoCardProps>) {
  const theme = useTheme();

  if (!poi) return null;

  const brandRed = theme.cred?.val ?? '#b21b2c';
  const colourBlindPrimary = theme.colourBlind2?.val ?? brandRed;
  const colourBlindSecondary = theme.colourBlind1?.val ?? '#B3D4FF';
  const accentColor = isColorBlind ? colourBlindPrimary : brandRed;
  const directionTextColor = isColorBlind ? colourBlindPrimary : '#fff';
  const directionButtonColor = isColorBlind ? colourBlindSecondary : brandRed;

  const categoryLabel = getOutdoorPOICategoryLabel(poi.category);

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.cardWrapper} pointerEvents="box-none">
        <View style={styles.card}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close POI details"
            style={styles.closeButton}
            testID="poi-close-button"
          >
            <MaterialIcons name="close" size={21} color={accentColor} />
          </Pressable>

          <Text style={styles.title} numberOfLines={2} testID="poi-name">
            {poi.name}
          </Text>
          <Text style={styles.address} numberOfLines={1} testID="poi-address">
            {poi.address || 'Address unavailable'}
          </Text>

          <View style={styles.metaRow}>
            <View style={[styles.categoryBadge, { backgroundColor: accentColor }]}>
              <MaterialIcons name="place" size={14} color="#fff" />
              <Text style={styles.categoryText} testID="poi-category">
                {categoryLabel}
              </Text>
            </View>

            {poi.rating != null && (
              <View style={styles.ratingWrap}>
                <MaterialIcons name="star" size={16} color="#f5a623" />
                <Text style={styles.ratingText} testID="poi-rating">
                  {poi.rating.toFixed(1)}
                </Text>
              </View>
            )}

            {poi.openNow != null && (
              <Text
                style={[styles.openStatus, { color: poi.openNow ? '#2e7d32' : '#c62828' }]}
                testID="poi-open-status"
              >
                {poi.openNow ? 'Open now' : 'Closed'}
              </Text>
            )}
          </View>

          <DirectionButton
            onPress={onDirections}
            disabled={!onDirections}
            backgroundColor={directionButtonColor}
            textColor={directionTextColor}
            iconColor={directionTextColor}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  cardWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '35%',
    alignItems: 'center',
    zIndex: 2,
  },
  card: {
    width: '100%',
    maxWidth: 456,
    backgroundColor: '#f7f2f2',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#efd9d9',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  closeButton: {
    position: 'absolute',
    top: 9,
    right: 9,
    padding: 4,
    zIndex: 3,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1c1e', paddingRight: 20 },
  address: { fontSize: 17, color: '#6b6b6b', marginTop: 4 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  categoryText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  ratingWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 14, fontWeight: '600', color: '#4a4a4a' },
  openStatus: { fontSize: 14, fontWeight: '600' },
});
