import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Dimensions, Platform, StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from 'tamagui';
import CampusSwitch from './CampusSwitch';
import BuildingInfoCard from './BuildingInfoCard';
import QuickPickPanel from './QuickPickPanel';
import MapMenu from './MapMenu';
import NavigationScreen from './NavigationScreen';
import RoutePreviewScreen from './RoutePreviewScreen';
import SearchBar from './SearchBar';
import CalendarModal from './CalendarModal';
import ClassesCalendarRequired from './ClassesCalendarRequired';
import { useSettings } from '../context/settings';
import { isClassesCalendarValid } from '../utils/calendarValidation';
import { usePublicCalendar } from '../hooks/usePublicCalendar';
import { useNavigationBetweenBuildings } from '../hooks/useNavigationBetweenBuildings';
import { useSelectedBuilding } from '../hooks/useSelectedBuilding';
import { useSearch } from '../hooks/useSearch';
import { useUserLocation } from '../hooks/useUserLocation';
import { useMapUI } from '../hooks/useMapUI';
import { useCampusContext } from '../hooks/useCampusContext';
import {
  findBuildingAtOrNearCoordinate,
  getClosestCampusWithinBorderThreshold,
  polygonCentroid,
  type BuildingWithPolygon,
  type LatLng,
} from '../utils/mapUtils';
import { normalizeLabel } from '../utils/stringUtils';

type QuickPick = {
  code: string;
  label: string;
  color: string;
  colorBlind?: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  hint?: string;
};
type Campus = 'sgw' | 'loyola';
type ResolvedCampusBuilding = { building: BuildingWithPolygon; campus: Campus };
type PendingMapBuilding = { id: string; campus: Campus };
type PendingStartBuilding = { campus: Campus; building: BuildingWithPolygon };

const POLYGON_STROKE = 'rgba(178, 27, 44, 0.9)';
const POLYGON_FILL = 'rgba(178, 27, 44, 0.25)';
const POLYGON_FILL_SELECTED = 'rgba(178, 27, 44, 0.7)';

const DEFAULT_REGION = {
  latitude: 45.4973,
  longitude: -73.5789,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
};

const FEATURED_BUILDINGS: Record<Campus, QuickPick[]> = {
  sgw: [
    {
      code: 'H',
      label: 'Pavillon\nHenry F Hall',
      color: '#b24a53',
      colorBlind: '#f3e0a6',
      icon: 'location-city',
      hint: 'Hall',
    },
    {
      code: 'LB',
      label: 'Pavillon\nMcConnell Bldg',
      color: '#4f7f86',
      colorBlind: '#cfd6df',
      icon: 'place',
      hint: 'McConnell',
    },
    {
      code: 'EV',
      label: 'Pavillon EV',
      color: '#d5964a',
      colorBlind: '#bcd0e8',
      icon: 'location-city',
      hint: 'EV',
    },
    {
      code: 'MB',
      label: 'John Molson\nSchool of Business',
      color: '#6b8f76',
      colorBlind: '#a7b6ad',
      icon: 'location-city',
      hint: 'Molson',
    },
  ],
  loyola: [
    {
      code: 'AD',
      label: 'AD Building',
      color: '#7ba56e',
      colorBlind: '#a3b097',
      icon: 'location-city',
      hint: 'Administration',
    },
    {
      code: 'FC',
      label: 'F.C. Smith\nBuilding',
      color: '#4f7f9b',
      colorBlind: '#8fa3b8',
      icon: 'location-city',
      hint: 'Smith',
    },
    {
      code: 'CC',
      label: 'Central\nBuilding',
      color: '#d5964a',
      colorBlind: '#c8d1e3',
      icon: 'location-city',
      hint: 'Central',
    },
    {
      code: 'SP',
      label: 'Richard J. Renaud\nScience Complex',
      color: '#b24a6a',
      colorBlind: '#d5cfb7',
      icon: 'place',
      hint: 'Renaud',
    },
  ],
};

const isSearchDisabled = false;
const USER_LOCATION_REGION_DELTA = 0.01;
// 150m captures near-campus border usage; 800m caps snapping to plausible campus buildings only.
const BORDER_THRESHOLD_METERS = 150;
const NEAREST_BUILDING_MAX_METERS = 800;

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { width, height } = Dimensions.get('window');

  // Use custom hooks for state management
  const { activeCampus, buildings, sgwBuildings, loyolaBuildings, handleSelectCampus } =
    useCampusContext();
  const {
    selectedBuildingId,
    remoteBuilding,
    isLoading,
    errorMessage,
    handleSelectBuilding,
    handleCloseCard,
  } = useSelectedBuilding(buildings, mapRef);
  const [buildingNotFoundToast, setBuildingNotFoundToast] = useState(false);
  const [isRoutePreviewOpen, setIsRoutePreviewOpen] = useState(false);
  const [previewStepIndex, setPreviewStepIndex] = useState(0);
  const [pendingMapBuilding, setPendingMapBuilding] = useState<PendingMapBuilding | null>(null);
  const [pendingStartBuilding, setPendingStartBuilding] = useState<PendingStartBuilding | null>(
    null,
  );
  const showBuildingNotFoundToast = useCallback(() => setBuildingNotFoundToast(true), []);
  useEffect(() => {
    if (!buildingNotFoundToast) return;
    const t = setTimeout(() => setBuildingNotFoundToast(false), 2500);
    return () => clearTimeout(t);
  }, [buildingNotFoundToast]);

  const {
    isNavigationOpen,
    navigationStart,
    navigationDestination,
    routeSummary,
    modeDurations,
    isRouteLoading,
    directionsError,
    isGetDirectionsDisabled,
    setNavigationActiveField,
    openNavigationForBuilding,
    handleMapBuildingPress,
    handleMapCoordinatePress,
    handleSearchSelect,
    setStartToCurrentLocation,
    setStartToCurrentLocationBuilding,
    closeNavigation,
    clearTapMarker,
    tapMarkerCoordinate,
    selectedTransportMode,
    setSelectedTransportMode,
    routePolyline,
    routeRegion,
    navigationSteps,
    isShuttleRoute,
    isShuttleLoading,
    shuttleInfo,
    isWeekend,
    routeSegments,
  } = useNavigationBetweenBuildings({
    buildings,
    onSelectBuilding: handleSelectBuilding,
    onBuildingNotFound: showBuildingNotFoundToast,
  });
  const {
    searchQuery,
    setSearchQuery,
    isSearchFocused,
    setIsSearchFocused,
    searchInputRef,
    searchResults,
    handleSearchSubmit,
    handleSelectSearchResult,
  } = useSearch(buildings, (building) => {
    handleSelectBuilding(building.id);
    const centroid = polygonCentroid(building.polygon);
    mapRef.current?.animateToRegion(
      { ...centroid, latitudeDelta: 0.0032, longitudeDelta: 0.0032 },
      500,
    );
  });
  const {
    isMenuOpen,
    setIsMenuOpen,
    isQuickPickOpen,
    quickPickContentHeight,
    setQuickPickContentHeight,
    quickPickVisibleHeight,
    quickPickMaxHeight,
    handleToggleQuickPick,
  } = useMapUI();
  const { colourBlindMode } = useSettings();
  const theme = useTheme();
  const { isLocating, goToUserLocation } = useUserLocation(
    mapRef as React.RefObject<{ animateToRegion: (region: any, duration: number) => void }>,
  );

  // Google Calendar integration (public calendar — no OAuth needed)
  const {
    connectCalendar,
    disconnect: calendarDisconnect,
    refreshEvents,
    isConnected: isCalendarConnected,
    events: calendarEvents,
    loading: calendarLoading,
    error: calendarError,
  } = usePublicCalendar();
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);

  const handleLogoPress = useCallback(() => {
    setCalendarModalVisible(true);
    if (isCalendarConnected) {
      refreshEvents();
    }
  }, [isCalendarConnected, refreshEvents]);

  const handleCalendarDisconnect = useCallback(async () => {
    await calendarDisconnect();
  }, [calendarDisconnect]);

  // Get selected building for info card
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) ?? null;

  // Auto-zoom camera to fit the route polyline
  useEffect(() => {
    if (routeRegion) {
      mapRef.current?.animateToRegion(routeRegion, 600);
    }
  }, [routeRegion]);

  const menuTop =
    Platform.OS === 'ios'
      ? Math.max(16, Math.round(height * 0.06))
      : Math.max(12, Math.round(height * 0.02));
  const menuLeft =
    Platform.OS === 'ios'
      ? Math.max(10, Math.round(width * 0.04))
      : Math.max(8, Math.round(width * 0.02));

  const isColorBlind = colourBlindMode;
  const brandRed = theme?.cred?.get?.() ?? '#b21b2c';
  const colourBlindAccent = theme?.colourBlind2?.get?.() ?? '#1F4E8C';
  const routeColor = isColorBlind ? colourBlindAccent : brandRed;
  const defaultColor = theme?.cred?.get?.() ?? POLYGON_STROKE;
  let polygonFillBase = POLYGON_FILL;
  let polygonStrokeBase = POLYGON_STROKE;
  let polygonFillSelected = POLYGON_FILL_SELECTED;

  if (colourBlindMode) {
    if (theme?.colourBlind1?.get) {
      polygonFillBase = theme.colourBlind1.get() || defaultColor;
      polygonFillSelected = polygonFillBase;
    }
    if (theme?.colourBlind2?.get) {
      polygonStrokeBase = theme.colourBlind2.get() || defaultColor;
    }
  } else if (theme?.buildingPrimary?.get) {
    const primaryColor = theme.buildingPrimary.get() || defaultColor;
    polygonFillBase = primaryColor;
    polygonStrokeBase = primaryColor;
    polygonFillSelected = primaryColor;
  }

  const polygonStroke = polygonStrokeBase;
  const polygonFill = polygonFillBase;

  /**
   * Handle quick pick building selection
   */
  const handleQuickPick = (pick: QuickPick) => {
    const hint = pick.hint ? normalizeLabel(pick.hint) : null;
    const match =
      buildings.find((building) => hint && normalizeLabel(building.name).includes(hint)) ??
      buildings.find((building) => building.code?.toUpperCase() === pick.code);
    if (!match) return;
    handleSelectBuilding(match.id);
    const centroid = polygonCentroid(match.polygon);
    mapRef.current?.animateToRegion(
      { ...centroid, latitudeDelta: 0.0032, longitudeDelta: 0.0032 },
      500,
    );
  };

  /**
   * Handle campus selection - reset search and selection
   */
  const handleCampusChange = (campus: Campus) => {
    handleSelectCampus(campus, mapRef);
    setSearchQuery('');
    setIsSearchFocused(false);
    searchInputRef.current?.blur();
  };

  const resolveInsideBuilding = useCallback(
    (coordinate: LatLng): ResolvedCampusBuilding | null => {
      const sgwMatch = findBuildingAtOrNearCoordinate(coordinate, sgwBuildings, 0);
      if (sgwMatch) {
        return { building: sgwMatch, campus: 'sgw' };
      }
      const loyolaMatch = findBuildingAtOrNearCoordinate(coordinate, loyolaBuildings, 0);
      if (loyolaMatch) {
        return { building: loyolaMatch, campus: 'loyola' };
      }
      return null;
    },
    [loyolaBuildings, sgwBuildings],
  );

  const selectResolvedBuildingOnMap = useCallback(
    (resolved: ResolvedCampusBuilding) => {
      if (resolved.campus !== activeCampus) {
        setPendingMapBuilding({ id: resolved.building.id, campus: resolved.campus });
        handleSelectCampus(resolved.campus, mapRef);
        return;
      }
      handleSelectBuilding(resolved.building.id);
    },
    [activeCampus, handleSelectBuilding, handleSelectCampus],
  );

  const setDirectionsStartToBuilding = useCallback(
    (resolved: ResolvedCampusBuilding) => {
      if (resolved.campus !== activeCampus) {
        setPendingStartBuilding({
          campus: resolved.campus,
          building: resolved.building,
        });
        handleSelectCampus(resolved.campus, mapRef);
        return;
      }
      const centroid = polygonCentroid(resolved.building.polygon);
      setStartToCurrentLocationBuilding(resolved.building.name, resolved.building.code, centroid);
    },
    [activeCampus, handleSelectCampus, setStartToCurrentLocationBuilding],
  );

  const resolveDirectionsStartFromCoordinate = useCallback(
    (coordinate: LatLng) => {
      const insideMatch = resolveInsideBuilding(coordinate);
      if (insideMatch) {
        setDirectionsStartToBuilding(insideMatch);
        return;
      }

      const closestCampus = getClosestCampusWithinBorderThreshold(
        coordinate,
        BORDER_THRESHOLD_METERS,
      );
      if (closestCampus) {
        const campusKey: Campus = closestCampus === 'SGW' ? 'sgw' : 'loyola';
        const campusBuildings = campusKey === 'sgw' ? sgwBuildings : loyolaBuildings;
        const nearBorderBuilding = findBuildingAtOrNearCoordinate(
          coordinate,
          campusBuildings,
          NEAREST_BUILDING_MAX_METERS,
        );

        if (nearBorderBuilding) {
          setDirectionsStartToBuilding({
            building: nearBorderBuilding,
            campus: campusKey,
          });
          return;
        }
      }

      setStartToCurrentLocation(coordinate);
    },
    [
      loyolaBuildings,
      resolveInsideBuilding,
      setDirectionsStartToBuilding,
      setStartToCurrentLocation,
      sgwBuildings,
    ],
  );

  const handleNavigationBuildingSelect = useCallback(
    (field: 'start' | 'destination', name: string, code: string | null) => {
      const normalizedName = normalizeLabel(name);
      const isCurrentLocationStart =
        field === 'start' &&
        (normalizedName === normalizeLabel('Your location') ||
          normalizedName === normalizeLabel('Current location'));
      if (!isCurrentLocationStart) {
        handleSearchSelect(field, name, code);
        return;
      }

      void goToUserLocation({
        animateToUser: false,
        onResolved: resolveDirectionsStartFromCoordinate,
      });
    },
    [goToUserLocation, handleSearchSelect, resolveDirectionsStartFromCoordinate],
  );

  const handleLocationPress = useCallback(async () => {
    await goToUserLocation({
      animateToUser: false,
      onResolved: (coordinate) => {
        const insideMatch = resolveInsideBuilding(coordinate);
        if (insideMatch) {
          selectResolvedBuildingOnMap(insideMatch);
          return;
        }

        mapRef.current?.animateToRegion(
          {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            latitudeDelta: USER_LOCATION_REGION_DELTA,
            longitudeDelta: USER_LOCATION_REGION_DELTA,
          },
          500,
        );
      },
    });
  }, [goToUserLocation, resolveInsideBuilding, selectResolvedBuildingOnMap]);

  useEffect(() => {
    if (!pendingMapBuilding) return;
    if (activeCampus !== pendingMapBuilding.campus) return;
    handleSelectBuilding(pendingMapBuilding.id);
    setPendingMapBuilding(null);
  }, [activeCampus, handleSelectBuilding, pendingMapBuilding]);

  useEffect(() => {
    if (!pendingStartBuilding) return;
    if (activeCampus !== pendingStartBuilding.campus) return;
    const centroid = polygonCentroid(pendingStartBuilding.building.polygon);
    setStartToCurrentLocationBuilding(
      pendingStartBuilding.building.name,
      pendingStartBuilding.building.code,
      centroid,
    );
    setPendingStartBuilding(null);
  }, [activeCampus, pendingStartBuilding, setStartToCurrentLocationBuilding]);

  const handlePreviewStepChange = useCallback(
    (step: { focusCoordinate?: { latitude: number; longitude: number } }, index: number) => {
      const coordinate = step.focusCoordinate;
      if (!coordinate) return;
      mapRef.current?.animateToRegion(
        {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        },
        450,
      );
    },
    [],
  );

  const handleOpenRoutePreview = useCallback(() => {
    if (navigationSteps.length === 0) return;
    setPreviewStepIndex(0);
    setIsRoutePreviewOpen(true);
    const firstStep = navigationSteps[0];
    if (firstStep) {
      handlePreviewStepChange(firstStep, 0);
    }
  }, [handlePreviewStepChange, navigationSteps]);

  const handleCloseRoutePreview = useCallback(() => {
    setIsRoutePreviewOpen(false);
  }, []);

  const handleSelectPreviewStep = useCallback(
    (index: number) => {
      if (navigationSteps.length === 0) return;
      const safeIndex = Math.min(Math.max(index, 0), navigationSteps.length - 1);
      setPreviewStepIndex(safeIndex);
      const step = navigationSteps[safeIndex];
      if (step) {
        handlePreviewStepChange(step, safeIndex);
      }
    },
    [handlePreviewStepChange, navigationSteps],
  );

  useEffect(() => {
    if (!isNavigationOpen) {
      setIsRoutePreviewOpen(false);
      setPreviewStepIndex(0);
    }
  }, [isNavigationOpen]);

  const showCalendarRequired = !isClassesCalendarValid(isCalendarConnected);

  return (
    <View style={styles.container} testID="map-screen">
      {showCalendarRequired ? (
        <ClassesCalendarRequired onConnectCalendar={() => setCalendarModalVisible(true)} />
      ) : null}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider="google"
        initialRegion={DEFAULT_REGION}
        testID="campus-map"
        showsUserLocation
        showsCompass={false}
        showsMyLocationButton={false}
        onPress={(e) => {
          const coordinate = e.nativeEvent?.coordinate;
          if (coordinate?.latitude != null && coordinate?.longitude != null) {
            handleMapCoordinatePress(coordinate);
          }
        }}
      >
        {tapMarkerCoordinate && (
          <Marker coordinate={tapMarkerCoordinate} testID="map-tap-marker" pinColor={brandRed} />
        )}
        {routePolyline.length > 0 && selectedTransportMode === 'driving' && (
          <Polyline
            key="route-driving"
            coordinates={routePolyline}
            strokeColor="#4A89F3"
            strokeWidth={5}
          />
        )}
        {routePolyline.length > 0 && selectedTransportMode === 'walking' && (
          <Polyline
            key="route-walking"
            coordinates={routePolyline}
            strokeColor={routeColor}
            strokeWidth={5}
            lineDashPattern={[10, 6]}
          />
        )}
        {/* Shuttle mode: render each segment with appropriate style */}
        {selectedTransportMode === 'shuttle' &&
          routeSegments.map((seg, i) => {
            if (seg.polyline.length === 0) return null;
            const isShuttleSegment = seg.kind === 'shuttle';
            const segmentColor = isShuttleSegment
              ? (brandRed ?? 'rgba(178, 27, 44, 0.9)')
              : '#4A89F3';
            const dashPattern = isShuttleSegment ? undefined : [10, 6];
            return (
              <Polyline
                key={`shuttle-seg-${seg.kind}-${i}`}
                testID={`route-shuttle-segment-${seg.kind}-${i}`}
                coordinates={seg.polyline}
                strokeColor={segmentColor}
                strokeWidth={isShuttleSegment ? 5 : 4}
                {...(dashPattern ? { lineDashPattern: dashPattern } : {})}
              />
            );
          })}
        {buildings.map((building) => {
          const centroid = polygonCentroid(building.polygon);
          const isSelected = building.id === selectedBuildingId;
          return (
            <React.Fragment key={building.id}>
              <Polygon
                coordinates={[...building.polygon]}
                strokeColor={polygonStroke}
                fillColor={isSelected ? polygonFillSelected : polygonFill}
                strokeWidth={2}
                tappable
                onPress={() => handleMapBuildingPress(building.id)}
              />
              <Marker
                coordinate={centroid}
                onPress={() => handleMapBuildingPress(building.id)}
                anchor={{ x: 0.5, y: 0.5 }}
                opacity={0}
              />
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Top Controls: Search, Menu, Brand Badge */}
      {!isRoutePreviewOpen && (
        <View
          style={[styles.topControls, { top: menuTop, paddingHorizontal: menuLeft }]}
          pointerEvents="box-none"
        >
          <SearchBar
            searchQuery={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={handleSearchSubmit}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            isSearchFocused={isSearchFocused}
            isSearchDisabled={isSearchDisabled}
            searchResults={searchResults}
            onSelectResult={handleSelectSearchResult}
            onOpenMenu={() => setIsMenuOpen(true)}
            inputRef={searchInputRef}
            brandColor={brandRed}
            logoSource={require('../assets/images/Concordia_icon.png')}
            onLogoPress={handleLogoPress}
          />
          <View style={[styles.campusToggle, isNavigationOpen && styles.campusToggleNavigation]}>
            <CampusSwitch
              selectedCampus={activeCampus === 'sgw' ? 'SGW' : 'Loyola'}
              onCampusChange={(campus) => handleCampusChange(campus === 'SGW' ? 'sgw' : 'loyola')}
            />
          </View>
        </View>
      )}

      {/* Building Info Card */}
      <BuildingInfoCard
        selectedBuilding={selectedBuilding}
        remoteBuilding={remoteBuilding}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onClose={() => {
          handleCloseCard();
          clearTapMarker();
        }}
        isColorBlind={isColorBlind}
        onDirections={() => {
          openNavigationForBuilding(selectedBuilding, remoteBuilding);
          handleCloseCard();
        }}
      />
      <NavigationScreen
        visible={isNavigationOpen && !isRoutePreviewOpen}
        startLabel={navigationStart}
        destinationLabel={navigationDestination}
        onClose={closeNavigation}
        onActiveFieldChange={setNavigationActiveField}
        onBuildingSelect={handleNavigationBuildingSelect}
        modeDurations={modeDurations}
        tripSummary={routeSummary}
        isLoading={isRouteLoading}
        directionsError={directionsError}
        isGetDirectionsDisabled={isGetDirectionsDisabled}
        selectedTransportMode={selectedTransportMode}
        onTransportModeChange={setSelectedTransportMode}
        navigationSteps={navigationSteps}
        isShuttleRoute={isShuttleRoute}
        isShuttleLoading={isShuttleLoading}
        shuttleInfo={shuttleInfo}
        isWeekend={isWeekend}
        onOpenPreview={handleOpenRoutePreview}
      />

      <RoutePreviewScreen
        visible={isRoutePreviewOpen}
        steps={navigationSteps}
        selectedStepIndex={previewStepIndex}
        onSelectStep={handleSelectPreviewStep}
        onClose={handleCloseRoutePreview}
      />
      {/* Quick Pick Panel and Location Button */}
      {!isMenuOpen && !isNavigationOpen ? (
        <QuickPickPanel
          activeCampus={activeCampus}
          isColorBlind={isColorBlind}
          isQuickPickOpen={isQuickPickOpen}
          quickPickMaxHeight={quickPickMaxHeight}
          quickPickVisibleHeight={quickPickVisibleHeight}
          quickPickContentHeight={quickPickContentHeight}
          featuredBuildings={FEATURED_BUILDINGS[activeCampus]}
          isLocating={isLocating}
          onToggleOpen={handleToggleQuickPick}
          onHeightChange={setQuickPickContentHeight}
          onQuickPick={handleQuickPick}
          onLocationPress={handleLocationPress}
        />
      ) : null}

      {!isRoutePreviewOpen && <MapMenu visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />}

      {buildingNotFoundToast ? (
        <View style={styles.toast} testID="building-not-found-toast">
          <Text style={styles.toastText}>Building not found</Text>
        </View>
      ) : null}

      {/* Google Calendar Modal */}
      <CalendarModal
        visible={calendarModalVisible}
        events={calendarEvents}
        loading={calendarLoading}
        error={calendarError}
        isConnected={isCalendarConnected}
        onClose={() => setCalendarModalVisible(false)}
        onConnect={connectCalendar}
        onDisconnect={handleCalendarDisconnect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  topControls: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: 23,
    padding: 11,
    width: '90%',
  },
  campusToggle: {
    alignSelf: 'center',
    marginTop: 10,
  },
  campusToggleNavigation: {
    marginTop: Platform.OS === 'ios' ? 56 : 80,
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
  },
});
