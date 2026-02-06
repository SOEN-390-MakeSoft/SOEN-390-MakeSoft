import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import MapView from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'tamagui';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  CAMPUS_BUILDINGS,
  type CampusId,
  type MainBuilding,
} from '@/constants/campusBuildings';
import { ConcordiaRed, FooterCardColors } from '@/constants/theme';
import BuildingInfoModal from './BuildingInfoModal';

const FOOTER_PADDING = 14;
const CARD_GAP = 6;
const CARD_HEIGHT = 52;

interface MapScreenProps {
  /** When the campus toggle is implemented in another user story, pass selected campus here */
  campusId?: CampusId;
}

export default function MapScreen({ campusId = 'SGW' }: Readonly<MapScreenProps>) {
  const [selectedBuilding, setSelectedBuilding] = useState<MainBuilding | null>(
    null
  );
  const [modalVisible, setModalVisible] = useState(false);
  const mapRef = useRef<MapView>(null);

  const campus = CAMPUS_BUILDINGS[campusId];
  const buildings = campus.buildings;

  const openBuildingInfo = useCallback((building: MainBuilding) => {
    setSelectedBuilding(building);
    setModalVisible(true);
  }, []);

  const closeBuildingInfo = useCallback(() => {
    setModalVisible(false);
    setSelectedBuilding(null);
  }, []);

  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = windowWidth - FOOTER_PADDING * 2;
  const cardWidth = (contentWidth - CARD_GAP) / 2;

  // Mockup: building facade for most cards, location pin for one per campus (Loyola 4th, SGW 2nd)
  const getCardIcon = (index: number) =>
    (campusId === 'Loyola' && index === 3) || (campusId === 'SGW' && index === 1)
      ? 'place'
      : 'domain';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider="google"
          initialRegion={campus.region}
          showsUserLocation
          showsMyLocationButton
        />
      </View>

      {/* Main Buildings footer bar - campus label + 2x2 grid (toggle is another user story) */}
      <SafeAreaView style={styles.footerWrapper} edges={['bottom']}>
        <Text style={styles.campusLabel}>
          {campusId === 'Loyola' ? 'LOYOLA' : 'SGW'}
        </Text>
        <View style={[styles.grid, { width: contentWidth }]}>
          {buildings.map((building, index) => (
            <Pressable
              key={building.id}
              style={({ pressed }) => [
                styles.buildingCard,
                {
                  width: cardWidth,
                  height: CARD_HEIGHT,
                  backgroundColor: FooterCardColors[index],
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
              onPress={() => openBuildingInfo(building)}
            >
              <MaterialIcons
                name={getCardIcon(index)}
                size={22}
                color="#fff"
                style={styles.cardIcon}
              />
              <Text
                numberOfLines={2}
                style={styles.cardTitle}
              >
                {building.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>

      <BuildingInfoModal
        visible={modalVisible}
        building={selectedBuilding}
        onClose={closeBuildingInfo}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  mapWrapper: {
    flex: 1,
  },
  footerWrapper: {
    backgroundColor: '#fff',
    paddingHorizontal: FOOTER_PADDING,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 6,
  },
  campusLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: ConcordiaRed,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1.2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  buildingCard: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardIcon: {
    marginRight: 2,
  },
  cardTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 14,
    letterSpacing: 0.2,
  },
});
