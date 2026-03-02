import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Dimensions, Keyboard, Platform, StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polygon, Polyline, type Region } from 'react-native-maps';
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
import IndoorMapOverlay from './indoor/IndoorMapOverlay';
import FloorSelector from './indoor/FloorSelector';
import RoomInfoBubble from './indoor/RoomInfoBubble';
import { findBuildingAtCoordinate } from '../services/indoor';
import { useSettings } from '../context/settings';
import { usePublicCalendar } from '../hooks/usePublicCalendar';
import { useNavigationBetweenBuildings } from '../hooks/useNavigationBetweenBuildings';
import { useSelectedBuilding } from '../hooks/useSelectedBuilding';
import { useSearch } from '../hooks/useSearch';
import { useUserLocation } from '../hooks/useUserLocation';
import { useMapUI } from '../hooks/useMapUI';
import { useCampusContext } from '../hooks/useCampusContext';
import { useIndoorNavigation } from '../hooks/useIndoorNavigation';
import {
  findBuildingAtOrNearCoordinate,
  getClosestCampusWithinBorderThreshold,
  polygonCentroid,
  type BuildingWithPolygon,
  type LatLng,
} from '../utils/mapUtils';
import { normalizeLabel } from '../utils/stringUtils';

/** Format seconds into a compact label like "1 min" or "30 sec". */
function formatIndoorTime(seconds: number): string {
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded} sec`;
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  if (secs === 0) return `${mins} min`;
  return `${mins} min ${secs} sec`;
}

/**
 * Parse a Google-style duration label (e.g. "12 mins", "1 hour 5 mins")
 * into total seconds, add extra seconds, then re-format.
 */
function addSecondsToLabel(label: string, extraSeconds: number): string {
  // Parse hours and minutes from the label
  const hourMatch = label.match(/(\d+)\s*hour/);
  const minMatch = label.match(/(\d+)\s*min/);
  let totalSec =
    (hourMatch ? parseInt(hourMatch[1], 10) * 3600 : 0) +
    (minMatch ? parseInt(minMatch[1], 10) * 60 : 0);
  // If neither matched, try bare number ("5" → 5 min)
  if (!hourMatch && !minMatch) {
    const bare = parseInt(label, 10);
    if (!isNaN(bare)) totalSec = bare * 60;
  }
  totalSec += extraSeconds;
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.ceil((totalSec % 3600) / 60);
  if (hours > 0) return mins > 0 ? `${hours} hour ${mins} mins` : `${hours} hour`;
  return `${mins} mins`;
}

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
// When latitudeDelta drops below this value, auto-show indoor floor plan (≈ zoom 19)
const INDOOR_ZOOM_THRESHOLD = 0.002;

// Google Maps style that hides POI labels/icons (used when indoor overlay is active)
const HIDE_POIS_MAP_STYLE = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

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
  // Indoor navigation
  const indoor = useIndoorNavigation();

  // -----------------------------------------------------------------------
  // Room autocomplete: when indoor is active, merge room suggestions into
  // the search results so the user sees rooms like "H-840" alongside buildings.
  // -----------------------------------------------------------------------
  const roomSearchResults = useMemo(() => {
    if (!indoor.isIndoorActive || !searchQuery.trim()) return [];
    return indoor.searchRooms(searchQuery, 6).map((room) => ({
      id: `room-${room.featureId}`,
      name: room.ref,
      address: `${indoor.buildingMeta?.name ?? ''} · Floor ${room.level}`,
      code: indoor.activeBuildingCode,
      // Stash the full resolved room for later selection
      _room: room,
    }));
  }, [indoor, searchQuery]);

  type RoomSearchResult = (typeof roomSearchResults)[number];

  const mergedSearchResults = useMemo(() => {
    // Room results first, then building results
    return [...roomSearchResults, ...searchResults];
  }, [roomSearchResults, searchResults]);

  /** Handle selecting an autocomplete result — room or building. */
  const handleSelectMergedResult = useCallback(
    (result: {
      id: string;
      name: string;
      address: string | null;
      code: string | null;
      _room?: any;
    }) => {
      // If it's a room result, select the room and show the bubble
      if (result.id.startsWith('room-') && (result as RoomSearchResult)._room) {
        const room = (result as RoomSearchResult)._room;
        indoor.selectRoom(room);
        indoor.setActiveLevel(room.level);
        setSearchQuery(room.ref);
        setIsSearchFocused(false);
        searchInputRef.current?.blur();

        // Zoom to the room position
        mapRef.current?.animateToRegion(
          {
            latitude: room.position.latitude,
            longitude: room.position.longitude,
            latitudeDelta: 0.001,
            longitudeDelta: 0.001,
          },
          500,
        );
        return;
      }
      // Otherwise delegate to the normal building search handler
      handleSelectSearchResult(result as any);
    },
    [indoor, handleSelectSearchResult, setSearchQuery, setIsSearchFocused, searchInputRef],
  );

  /** Navigate to the room from the info bubble — triggers full outdoor+indoor directions. */
  const handleRoomNavigate = useCallback(
    (room: { ref: string; level: string }) => {
      // 1. Compute the indoor route
      indoor.navigateToRoom(room.ref);
      indoor.selectRoom(null); // close the bubble

      // Mark as user-triggered so zoom-out won’t deactivate indoor mode
      lastIndoorAutoRef.current = null;

      // 2. Close the building info card if open so it doesn't overlap
      handleCloseCard();

      // 3. Directly open outdoor navigation to the building entrance.
      //    This skips the BuildingInfoCard step so the user doesn't need
      //    to tap "Navigate" again on a separate popup.
      if (indoor.activeBuildingCode) {
        const outdoorBuilding = buildings.find(
          (b) => b.code?.toUpperCase() === indoor.activeBuildingCode!.toUpperCase(),
        );
        if (outdoorBuilding) {
          openNavigationForBuilding(outdoorBuilding, null);
        }
      }
    },
    [indoor, buildings, handleCloseCard, openNavigationForBuilding],
  );

  /** Room marker tapped on the indoor overlay → toggle selection. */
  const handleRoomMarkerPress = useCallback(
    (room: any) => {
      // If this room is already selected, deselect it
      if (indoor.selectedRoom?.featureId === room.featureId) {
        indoor.selectRoom(null);
      } else {
        indoor.selectRoom(room);
      }
    },
    [indoor],
  );

  // Track the last map region for zoom-based indoor auto-show
  const lastIndoorAutoRef = useRef<string | null>(null);

  /**
   * When the user zooms in close enough over a building that has an indoor map,
   * automatically activate the indoor view (with the last-selected or default floor).
   * When they zoom back out, deactivate.
   */
  const handleRegionChange = useCallback(
    (region: Region) => {
      if (region.latitudeDelta < INDOOR_ZOOM_THRESHOLD) {
        // Zoomed in — check if a building with indoor data is under the camera centre
        const center = { latitude: region.latitude, longitude: region.longitude };
        const meta = findBuildingAtCoordinate(center);
        if (meta && (!indoor.isIndoorActive || indoor.activeBuildingCode !== meta.code)) {
          indoor.activateBuilding(meta.code);
          lastIndoorAutoRef.current = meta.code;
        }
      } else if (indoor.isIndoorActive && lastIndoorAutoRef.current && !indoor.indoorRoute) {
        // Zoomed out — deactivate ONLY if it was auto-activated (not user-search-triggered)
        // and there’s no active indoor route (navigation in progress).
        indoor.deactivate();
        lastIndoorAutoRef.current = null;
      }
    },
    [indoor],
  );

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
  /**
   * Detect indoor room destinations typed in the search / navigation fields.
   * If matched (e.g. "H-840"), activate the building + compute the indoor route,
   * AND trigger outdoor navigation to the building entrance for seamless directions.
   */
  const handleIndoorSearchQuery = useCallback(
    (query: string) => {
      const detected = indoor.detectIndoor(query);
      if (!detected) return false;

      // 1. Activate indoor map + compute indoor route
      indoor.activateBuilding(detected.buildingCode);
      indoor.navigateToRoom(detected.roomRef);

      // Mark as NOT auto-activated so zoom-out won't dismiss it
      lastIndoorAutoRef.current = null;

      // 2. Find the matching outdoor building and open navigation to it
      //    This triggers Google Directions from user location → building entrance.
      const outdoorBuilding = buildings.find(
        (b) => b.code?.toUpperCase() === detected.buildingCode.toUpperCase(),
      );
      if (outdoorBuilding) {
        handleSelectBuilding(outdoorBuilding.id);
        openNavigationForBuilding(outdoorBuilding, null);
      }

      // 3. Zoom the map to the building entrance area
      const meta = indoor.buildingMeta;
      const entrance = meta?.entrances?.[0];
      if (entrance) {
        mapRef.current?.animateToRegion(
          {
            latitude: entrance.latitude,
            longitude: entrance.longitude,
            latitudeDelta: 0.002,
            longitudeDelta: 0.002,
          },
          600,
        );
      } else {
        mapRef.current?.animateToRegion(
          { latitude: 45.4973, longitude: -73.5789, latitudeDelta: 0.003, longitudeDelta: 0.003 },
          600,
        );
      }
      return true;
    },
    [indoor, buildings, handleSelectBuilding, openNavigationForBuilding],
  );

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

  /**
   * Combine outdoor navigation steps with indoor route steps for a seamless
   * step-by-step experience: "Walk to Hall Building → Enter building →
   * Take elevator to floor 8 → Walk to room H-840".
   */
  const combinedNavigationSteps = useMemo(() => {
    if (!indoor.isIndoorActive || !indoor.indoorRoute) return navigationSteps;

    const indoorSteps = indoor.indoorRoute.steps.map((step) => ({
      instruction: step.instruction,
      distanceText: step.distanceMeters != null ? `${Math.round(step.distanceMeters)} m` : '',
      durationText: step.estimatedSeconds != null ? formatIndoorTime(step.estimatedSeconds) : '',
      maneuver: step.fromLevel !== step.toLevel ? 'level-change' : 'walk',
      focusCoordinate:
        step.path.length > 0 ? step.path[Math.floor(step.path.length / 2)] : undefined,
      _indoorLevel: step.toLevel, // used to auto-switch floor during preview
    }));

    // Add a bridging step between outdoor and indoor
    const entrance = indoor.buildingMeta?.entrances?.[0];
    const enterStep = {
      instruction: `Enter ${indoor.buildingMeta?.name ?? 'the building'}`,
      distanceText: '',
      durationText: '',
      maneuver: 'enter-building' as const,
      focusCoordinate: entrance,
      _indoorLevel: indoor.indoorRoute.startLevel,
    };

    return [...navigationSteps, enterStep, ...indoorSteps];
  }, [navigationSteps, indoor.isIndoorActive, indoor.indoorRoute, indoor.buildingMeta]);

  // -----------------------------------------------------------------------
  // Augment the Google route summary with indoor navigation time so the
  // displayed total reflects outdoor travel + indoor wayfinding.
  // -----------------------------------------------------------------------
  const indoorTimeSec = indoor.indoorRoute?.totalEstimatedSeconds ?? 0;

  const augmentedRouteSummary = useMemo(() => {
    if (!routeSummary || indoorTimeSec <= 0) return routeSummary;
    return {
      ...routeSummary,
      durationText: addSecondsToLabel(routeSummary.durationText, indoorTimeSec),
    };
  }, [routeSummary, indoorTimeSec]);

  const augmentedModeDurations = useMemo(() => {
    if (!modeDurations || indoorTimeSec <= 0) return modeDurations;
    return {
      driving: modeDurations.driving
        ? addSecondsToLabel(modeDurations.driving, indoorTimeSec)
        : modeDurations.driving,
      walking: modeDurations.walking
        ? addSecondsToLabel(modeDurations.walking, indoorTimeSec)
        : modeDurations.walking,
    };
  }, [modeDurations, indoorTimeSec]);

  const handlePreviewStepChange = useCallback(
    (
      step: { focusCoordinate?: { latitude: number; longitude: number }; _indoorLevel?: string },
      index: number,
    ) => {
      const coordinate = step.focusCoordinate;
      if (!coordinate) return;

      // If this is an indoor step, auto-switch to the right floor and zoom close
      if (step._indoorLevel) {
        indoor.setActiveLevel(step._indoorLevel);
        mapRef.current?.animateToRegion(
          {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            latitudeDelta: 0.001,
            longitudeDelta: 0.001,
          },
          450,
        );
      } else {
        mapRef.current?.animateToRegion(
          {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            latitudeDelta: 0.003,
            longitudeDelta: 0.003,
          },
          450,
        );
      }
    },
    [indoor],
  );

  const handleOpenRoutePreview = useCallback(() => {
    if (combinedNavigationSteps.length === 0) return;
    setPreviewStepIndex(0);
    setIsRoutePreviewOpen(true);
    const firstStep = combinedNavigationSteps[0];
    if (firstStep) {
      handlePreviewStepChange(firstStep, 0);
    }
  }, [handlePreviewStepChange, combinedNavigationSteps]);

  const handleCloseRoutePreview = useCallback(() => {
    setIsRoutePreviewOpen(false);
  }, []);

  const handleSelectPreviewStep = useCallback(
    (index: number) => {
      if (combinedNavigationSteps.length === 0) return;
      const safeIndex = Math.min(Math.max(index, 0), combinedNavigationSteps.length - 1);
      setPreviewStepIndex(safeIndex);
      const step = combinedNavigationSteps[safeIndex];
      if (step) {
        handlePreviewStepChange(step, safeIndex);
      }
    },
    [handlePreviewStepChange, combinedNavigationSteps],
  );

  const prevNavOpenRef = useRef(isNavigationOpen);
  useEffect(() => {
    const wasOpen = prevNavOpenRef.current;
    prevNavOpenRef.current = isNavigationOpen;

    if (!isNavigationOpen) {
      setIsRoutePreviewOpen(false);
      setPreviewStepIndex(0);

      // Only clear indoor state on the transition from open → closed,
      // not on every render where navigation happens to be closed
      // (otherwise zoom-auto-activation gets immediately undone).
      if (wasOpen) {
        indoor.deactivate();
        lastIndoorAutoRef.current = null;
      }
    }
  }, [isNavigationOpen, indoor]);

  return (
    <View style={styles.container} testID="map-screen">
      <MapView
        ref={mapRef}
        style={styles.map}
        provider="google"
        initialRegion={DEFAULT_REGION}
        testID="campus-map"
        showsUserLocation
        showsCompass={false}
        showsMyLocationButton={false}
        showsPointsOfInterest={!indoor.isIndoorActive}
        customMapStyle={indoor.isIndoorActive ? HIDE_POIS_MAP_STYLE : []}
        onRegionChangeComplete={handleRegionChange}
        onPress={(e) => {
          // Always dismiss keyboard & search focus when tapping the map
          if (isSearchFocused) {
            Keyboard.dismiss();
            setIsSearchFocused(false);
          }

          const coordinate = e.nativeEvent?.coordinate;
          if (coordinate?.latitude != null && coordinate?.longitude != null) {
            // When indoor mode is active, tapping empty space on the map should
            // dismiss the selected room bubble rather than selecting the building.
            if (indoor.isIndoorActive) {
              indoor.selectRoom(null);
              return;
            }
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
          // When indoor mode is active for this building, disable the polygon/marker
          // tap so that room markers underneath can receive the press events.
          const isIndoorBuilding =
            indoor.isIndoorActive &&
            building.code?.toUpperCase() === indoor.activeBuildingCode?.toUpperCase();
          return (
            <React.Fragment key={building.id}>
              <Polygon
                coordinates={[...building.polygon]}
                strokeColor={polygonStroke}
                fillColor={isSelected ? polygonFillSelected : polygonFill}
                strokeWidth={2}
                tappable={!isIndoorBuilding}
                onPress={
                  isIndoorBuilding
                    ? undefined
                    : () => {
                        handleMapBuildingPress(building.id);
                      }
                }
              />
              {!isIndoorBuilding && (
                <Marker
                  coordinate={centroid}
                  onPress={() => {
                    handleMapBuildingPress(building.id);
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  opacity={0}
                />
              )}
            </React.Fragment>
          );
        })}
        {/* Indoor floor plan overlay — GeoJSON-based (no image alignment needed) */}
        {indoor.isIndoorActive && (
          <IndoorMapOverlay
            activeLevelFeatures={indoor.activeLevelFeatures}
            route={indoor.indoorRoute}
            activeLevel={indoor.activeLevel}
            destinationRoom={indoor.destinationRoom}
            selectedRoom={indoor.selectedRoom}
            onRoomPress={handleRoomMarkerPress}
            routeColor={routeColor}
          />
        )}
      </MapView>

      {/* Indoor floor selector pill */}
      {indoor.isIndoorActive && !isNavigationOpen && (
        <FloorSelector
          levels={indoor.levels}
          activeLevel={indoor.activeLevel}
          onSelectLevel={indoor.setActiveLevel}
          accentColor={brandRed}
        />
      )}

      {/* Room info bubble — appears when a room is tapped or selected from search */}
      {indoor.isIndoorActive && indoor.selectedRoom && (
        <RoomInfoBubble
          room={indoor.selectedRoom}
          buildingName={indoor.buildingMeta?.name}
          onNavigate={handleRoomNavigate}
          onClose={() => indoor.selectRoom(null)}
          accentColor={brandRed}
          bottomOffset={isQuickPickOpen ? 320 : 160}
        />
      )}

      {/* Top Controls: Search, Menu, Brand Badge */}
      {!isRoutePreviewOpen && (
        <View
          style={[styles.topControls, { top: menuTop, paddingHorizontal: menuLeft }]}
          pointerEvents="box-none"
        >
          <SearchBar
            searchQuery={searchQuery}
            onChangeText={setSearchQuery}
            onSubmit={() => {
              // Try indoor destination first (e.g. "H-840"); fall back to normal building search
              if (!handleIndoorSearchQuery(searchQuery)) {
                handleSearchSubmit();
              }
            }}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            isSearchFocused={isSearchFocused}
            isSearchDisabled={isSearchDisabled}
            searchResults={mergedSearchResults}
            onSelectResult={handleSelectMergedResult}
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
      {/* Indoor error toast */}
      {indoor.error ? (
        <View style={styles.indoorErrorToast} testID="indoor-error-toast">
          <Text style={styles.toastText}>{indoor.error}</Text>
        </View>
      ) : null}

      {/* Building Info Card */}
      <BuildingInfoCard
        selectedBuilding={selectedBuilding}
        remoteBuilding={remoteBuilding}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onClose={() => {
          handleCloseCard();
          clearTapMarker();
          indoor.deactivate();
          lastIndoorAutoRef.current = null;
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
        modeDurations={augmentedModeDurations}
        tripSummary={augmentedRouteSummary}
        isLoading={isRouteLoading}
        directionsError={directionsError}
        isGetDirectionsDisabled={isGetDirectionsDisabled}
        selectedTransportMode={selectedTransportMode}
        onTransportModeChange={setSelectedTransportMode}
        navigationSteps={combinedNavigationSteps}
        isShuttleRoute={isShuttleRoute}
        isShuttleLoading={isShuttleLoading}
        shuttleInfo={shuttleInfo}
        isWeekend={isWeekend}
        onOpenPreview={handleOpenRoutePreview}
      />

      <RoutePreviewScreen
        visible={isRoutePreviewOpen}
        steps={combinedNavigationSteps}
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
  indoorErrorToast: {
    position: 'absolute',
    bottom: 140,
    alignSelf: 'center',
    backgroundColor: 'rgba(180,30,30,0.9)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
});
