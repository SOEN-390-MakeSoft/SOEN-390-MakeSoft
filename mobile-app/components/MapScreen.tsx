import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import MapView from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, XStack } from 'tamagui';
import {
  CAMPUS_BUILDINGS,
  CAMPUS_IDS,
  type CampusId,
  type MainBuilding,
} from '@/constants/campusBuildings';
import { ConcordiaRed, ConcordiaRedMuted } from '@/constants/theme';
import BuildingInfoModal from './BuildingInfoModal';

const CARD_MIN_WIDTH = 140;
const CARD_GAP = 10;
const FOOTER_HORIZONTAL_PADDING = 16;

export default function MapScreen() {
  const [campusId, setCampusId] = useState<CampusId>('SGW');
  const [selectedBuilding, setSelectedBuilding] = useState<MainBuilding | null>(
    null
  );
  const [modalVisible, setModalVisible] = useState(false);
  const mapRef = useRef<MapView>(null);
  const { width: windowWidth } = useWindowDimensions();

  const campus = CAMPUS_BUILDINGS[campusId];
  const buildings = campus.buildings;

  const handleCampusChange = useCallback((id: CampusId) => {
    setCampusId(id);
    const next = CAMPUS_BUILDINGS[id];
    mapRef.current?.animateToRegion(next.region, 400);
  }, []);

  const openBuildingInfo = useCallback((building: MainBuilding) => {
    setSelectedBuilding(building);
    setModalVisible(true);
  }, []);

  const closeBuildingInfo = useCallback(() => {
    setModalVisible(false);
    setSelectedBuilding(null);
  }, []);

  const footerContentWidth = windowWidth - FOOTER_HORIZONTAL_PADDING * 2;
  const cardWidth = Math.max(
    CARD_MIN_WIDTH,
    (footerContentWidth - CARD_GAP * 3) / 4
  );

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

      {/* Campus selector - above footer, doesn't overlap map controls */}
      <View style={styles.campusSelector}>
        <XStack gap="$2">
          {CAMPUS_IDS.map((id) => (
            <Pressable
              key={id}
              onPress={() => handleCampusChange(id)}
              style={[
                styles.campusChip,
                campusId === id && styles.campusChipActive,
              ]}
            >
              <Text
                fontSize="$2"
                fontWeight={campusId === id ? '600' : '500'}
                color={campusId === id ? '#fff' : ConcordiaRed}
              >
                {id}
              </Text>
            </Pressable>
          ))}
        </XStack>
      </View>

      {/* Main Buildings footer bar */}
      <SafeAreaView style={styles.footerWrapper} edges={['bottom']}>
        <View style={styles.footerHeader}>
          <View style={styles.footerHeaderAccent} />
          <Text
            fontSize="$2"
            fontWeight="600"
            color={ConcordiaRed}
            letterSpacing={0.5}
            paddingHorizontal={FOOTER_HORIZONTAL_PADDING}
          >
            Main Buildings
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.footerScroll,
            { paddingHorizontal: FOOTER_HORIZONTAL_PADDING },
          ]}
        >
          {buildings.map((building) => (
            <Pressable
              key={building.id}
              style={({ pressed }) => [
                styles.buildingCard,
                { width: cardWidth },
                pressed && styles.buildingCardPressed,
              ]}
              onPress={() => openBuildingInfo(building)}
            >
              <View style={styles.buildingCardAccent} />
              <Text
                fontSize="$2"
                fontWeight="600"
                style={styles.buildingCardTitle}
                numberOfLines={2}
              >
                {building.name}
              </Text>
              <Text
                fontSize="$1"
                fontWeight="500"
                style={styles.buildingCardCode}
              >
                {building.code}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
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
  campusSelector: {
    position: 'absolute',
    top: 8,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  campusChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1.5,
    borderColor: ConcordiaRedMuted,
  },
  campusChipActive: {
    backgroundColor: ConcordiaRed,
    borderColor: ConcordiaRed,
  },
  footerWrapper: {
    backgroundColor: '#fff',
    paddingTop: 14,
    paddingBottom: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 3,
    borderTopColor: ConcordiaRed,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  footerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  footerHeaderAccent: {
    width: 4,
    height: 18,
    backgroundColor: ConcordiaRed,
    borderRadius: 2,
    marginRight: 8,
  },
  footerScroll: {
    flexDirection: 'row',
    gap: CARD_GAP,
    paddingBottom: 6,
  },
  buildingCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    paddingLeft: 18,
    borderWidth: 1,
    borderColor: ConcordiaRedMuted,
    minHeight: 78,
    position: 'relative',
    overflow: 'hidden',
  },
  buildingCardPressed: {
    backgroundColor: ConcordiaRedMuted,
  },
  buildingCardAccent: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    backgroundColor: ConcordiaRed,
    borderRadius: 2,
  },
  buildingCardTitle: {
    color: '#11181C',
  },
  buildingCardCode: {
    color: ConcordiaRed,
    marginTop: 6,
  },
});
