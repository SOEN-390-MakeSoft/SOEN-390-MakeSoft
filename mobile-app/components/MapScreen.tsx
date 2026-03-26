import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker, Polygon, Polyline, type Region } from 'react-native-maps';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from 'tamagui';
import CampusSwitch from './CampusSwitch';
import BuildingInfoCard from './BuildingInfoCard';
import QuickPickPanel from './QuickPickPanel';
import MapMenu from './MapMenu';
import NavigationScreen from './NavigationScreen';
import RoutePreviewScreen from './RoutePreviewScreen';
import DirectionsModeScreen from './DirectionsModeScreen';
import SearchBar from './SearchBar';
import CalendarModal from './CalendarModal';
import NextClassPanel from './NextClassPanel';
import ClassesCalendarRequired from './ClassesCalendarRequired';
import IndoorMapOverlay from './indoor/IndoorMapOverlay';
import FloorSelector from './indoor/FloorSelector';
import RoomInfoBubble from './indoor/RoomInfoBubble';
import PoiInfoBubble from './indoor/PoiInfoBubble';
import IndoorStartPromptModal from './indoor/IndoorStartPromptModal';
import {
  INDOOR_BUILDINGS,
  findBuildingAtCoordinate,
  detectIndoorDestination,
  loadBuilding,
  resolveRoom,
  searchRooms as searchIndoorRooms,
  getBuildingMeta,
  hasIndoorMap,
  findRoomAtCoordinate,
} from '../services/indoor';
import type {
  IndoorPOI,
  IndoorEscalator,
  IndoorElevator,
  IndoorRoute,
} from '../services/indoor/types';
import { useSettings } from '../context/settings';
import { isClassesCalendarValid } from '../utils/calendarValidation';
import {
  usePublicCalendar,
  getNextClassForToday,
  type CalendarEvent,
  getNextEvent,
} from '../hooks/usePublicCalendar';
import { useNavigationBetweenBuildings } from '../hooks/useNavigationBetweenBuildings';
import type { NavigationStep } from '../hooks/useNavigationBetweenBuildings';
import { useSelectedBuilding } from '../hooks/useSelectedBuilding';
import { useSearch } from '../hooks/useSearch';
import { useUserLocation } from '../hooks/useUserLocation';
import { useMapUI } from '../hooks/useMapUI';
import { useCampusContext } from '../hooks/useCampusContext';
import { useIndoorNavigation } from '../hooks/useIndoorNavigation';
import { useIndoorRoomPicker } from '../hooks/useIndoorRoomPicker';
import {
  findBuildingAtOrNearCoordinate,
  getClosestCampusWithinBorderThreshold,
  polygonCentroid,
  type BuildingWithPolygon,
  type LatLng,
} from '../utils/mapUtils';
import { resolveIndoorCategorySelection } from '../utils/indoorCategoryFilter';
import {
  normalizeLabel,
  parseLocationString,
  resolveEventLocation,
  type LocationConflict,
} from '../utils/stringUtils';
import { useOutdoorPOI } from '../hooks/useOutdoorPOI';
import type { OutdoorPOI } from '../services/outdoorPOIService';
import { isSupportedPOICategory } from '../services/outdoorPOIService';
import OutdoorPOIInfoCard from './OutdoorPOIInfoCard';
import {
  trackCampusSwitched,
  trackBuildingSelected,
  trackBuildingInfoViewed,
  trackBuildingDirectionsTapped,
  trackNavigationOpened,
  trackTransportModeSelected,
  trackWalkingVariantSelected,
  trackCurrentLocationUsed,
  trackRoutePreviewOpened,
  trackDirectionsModeOpened,
  trackCalendarModalOpened,
  trackNextClassDirectionsTapped,
  trackNextClassGoTapped,
  trackIndoorMapActivated,
  trackIndoorRoomSearched,
  trackIndoorRoomSelected,
  trackIndoorNavigateTapped,
  trackFloorChanged,
  trackAccessibleRouteToggled,
  trackIndoorPoiCategoryFiltered,
  trackIndoorPoiTapped,
  trackOutdoorPoiSearched,
  trackOutdoorPoiSelected,
  trackOutdoorPoiDirectionsTapped,
} from '../services/analytics';

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
  // Parse hours/minutes without regex to avoid backtracking hotspots.
  const tokens = label.toLowerCase().split(/\s+/).filter(Boolean);
  let hoursFromLabel = 0;
  let minsFromLabel = 0;

  for (let i = 0; i < tokens.length - 1; i += 1) {
    const value = Number.parseInt(tokens[i], 10);
    if (Number.isNaN(value)) continue;

    const unit = tokens[i + 1];
    if (unit.startsWith('hour')) {
      hoursFromLabel = value;
      continue;
    }
    if (unit.startsWith('min')) {
      minsFromLabel = value;
    }
  }

  let totalSec = hoursFromLabel * 3600 + minsFromLabel * 60;
  // If neither unit matched, try bare number ("5" -> 5 min)
  if (hoursFromLabel === 0 && minsFromLabel === 0) {
    const bare = Number.parseInt(label, 10);
    if (Number.isNaN(bare) === false) totalSec = bare * 60;
  }
  totalSec += extraSeconds;
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.ceil((totalSec % 3600) / 60);
  const hourLabel = hours === 1 ? 'hour' : 'hours';
  const minLabel = mins === 1 ? 'min' : 'mins';

  if (hours > 0)
    return mins > 0 ? `${hours} ${hourLabel} ${mins} ${minLabel}` : `${hours} ${hourLabel}`;
  return `${mins} ${minLabel}`;
}

/**
 * Get the display title for a POI based on its type and amenity
 */
function getPoiTitle(
  poi:
    | IndoorPOI
    | (IndoorEscalator & { type: 'escalator' })
    | (IndoorElevator & { type: 'elevator' }),
): string {
  if (poi.type === 'escalator') return 'Escalator';
  if (poi.type === 'elevator') return 'Elevator';
  if (poi.amenity === 'toilets') {
    if (poi.male && !poi.female) return "Men's Washroom";
    if (poi.female && !poi.male) return "Women's Washroom";
    return 'Unisex Washroom';
  }
  if (poi.amenity === 'drinking_water') return 'Water Fountain';
  return poi.amenity;
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
type PendingStartBuilding = { campus: Campus; building: BuildingWithPolygon; coordinate: LatLng };
type AugmentedNavigationStep = NavigationStep & {
  _indoorLevel?: string;
  _indoorBuildingCode?: string;
};
type NextClassPreview = {
  event: CalendarEvent;
  building: BuildingWithPolygon | null;
  campus: Campus | null;
  rawLocation: string;
  indoorRoomRef: string | null;
  conflict: LocationConflict | null;
};

const POLYGON_STROKE = 'rgba(178, 27, 44, 0.9)';
const POLYGON_FILL = 'rgba(178, 27, 44, 0.25)';
const POLYGON_FILL_SELECTED = 'rgba(178, 27, 44, 0.7)';

function getPolygonThemeColors(
  theme: ReturnType<typeof useTheme> | undefined,
  colourBlindMode: boolean,
  defaultColor: string,
): { polygonFillBase: string; polygonStrokeBase: string; polygonFillSelected: string } {
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
  return { polygonFillBase, polygonStrokeBase, polygonFillSelected };
}

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
const FLOOR_SELECTOR_FOCUS_RADIUS_METERS = 120;

function getConflictLabel(c: LocationConflict): string {
  switch (c.type) {
    case 'unresolvable_location':
      return `[WARN] unresolvable_location — algorithm could not match "${c.rawLocation}". The place may exist but the string format is unrecognised.`;
    case 'building_not_in_polygons':
      return `[WARN] building_not_in_polygons — resolveBuilding matched id="${c.resolvedId}" but it was absent from the runtime polygon arrays. Possible data shape mismatch.`;
    case 'campus_inferred':
      return `[INFO] campus_inferred — no campus in location string; inferred campus="${c.inferredCampus}" from polygon dataset (building id="${c.buildingId}").`;
    case 'campus_mismatch':
      return `[WARN] campus_mismatch — string said campus="${c.parsedCampus}" but polygon data says campus="${c.actualCampus}" for building id="${c.buildingId}". Trusting polygon data.`;
  }
}

const NORMALIZED_YOUR_LOCATION = normalizeLabel('Your location');
const NORMALIZED_CURRENT_LOCATION = normalizeLabel('Current location');
// When latitudeDelta drops below this value, auto-show indoor floor plan (≈ zoom 19)
const INDOOR_ZOOM_THRESHOLD = 0.002;
const INDOOR_NO_PATH_ERROR = 'No indoor route found between the given points';

const FALLBACK_POI_ICON: keyof typeof MaterialIcons.glyphMap = 'place';

const POI_MARKER_ICONS: Partial<Record<string, keyof typeof MaterialIcons.glyphMap>> = {
  restaurant: 'restaurant',
  cafe: 'local-cafe',
  pharmacy: 'local-pharmacy',
  gym: 'fitness-center',
  bank: 'account-balance',
  supermarket: 'shopping-cart',
  bar: 'local-bar',
  hospital: 'local-hospital',
  library: 'local-library',
  parking: 'local-parking',
  gas_station: 'local-gas-station',
  hotel: 'hotel',
  place: 'place',
};

// Google Maps style that hides POI labels/icons (used when indoor overlay is active)
const HIDE_POIS_MAP_STYLE = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const userPositionRef = useRef<{ latitude: number; longitude: number } | null>(null);
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
  const [isDirectionsModeOpen, setIsDirectionsModeOpen] = useState(false);
  const [previewStepIndex, setPreviewStepIndex] = useState(0);

  // Indoor Location Detection Modal State
  const [showFloorSelectModal, setShowFloorSelectModal] = useState(false);
  const [indoorStartCoordPending, setIndoorStartCoordPending] = useState<LatLng | null>(null);
  const [indoorStartBuildingPending, setIndoorStartBuildingPending] =
    useState<ResolvedCampusBuilding | null>(null);

  const [pendingMapBuilding, setPendingMapBuilding] = useState<PendingMapBuilding | null>(null);
  const [pendingStartBuilding, setPendingStartBuilding] = useState<PendingStartBuilding | null>(
    null,
  );
  const [pendingDestinationRef, setPendingDestinationRef] = useState<string | null>(null);
  const [pendingDestinationBuildingCode, setPendingDestinationBuildingCode] = useState<
    string | null
  >(null);
  const [focusedIndoorBuildingCode, setFocusedIndoorBuildingCode] = useState<string | null>(null);
  const [nextClassPreview, setNextClassPreview] = useState<NextClassPreview | null>(null);
  const [arriveByClassEnd, setArriveByClassEnd] = useState<Date | null>(null);
  const [isAccessibleRouteEnabled, setIsAccessibleRouteEnabled] = useState(false);

  const [visiblePoiAmenities, setVisiblePoiAmenities] = useState<string[]>([
    'toilets',
    'drinking_water',
  ]);
  const [selectedPoi, setSelectedPoi] = useState<any>(null);
  const [indoorCategoryFilter, setIndoorCategoryFilter] = useState<string | null>(null);
  const { colourBlindMode, simulatedNow } = useSettings();
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
    navigationOrigin,
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
    setSelectedWalkingRouteVariant,
    walkingRouteComparison,
    routePolyline,
    routeRegion,
    navigationSteps,
    isShuttleRoute,
    isShuttleLoading,
    shuttleInfo,
    isWeekend,
    lateTransportModes = [],
    routeSegments,
    openNavigationForResolvedDestination,
    openNavigationForCoordinate,
    openIndoorOnlyNavigation,
    isIndoorOnlyRoute,
    isDestinationLocked,
    rerouteFromLocation,
  } = useNavigationBetweenBuildings({
    buildings,
    onSelectBuilding: handleSelectBuilding,
    onBuildingNotFound: showBuildingNotFoundToast,
    currentTime: simulatedNow,
    arriveBy: arriveByClassEnd,
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

  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    outdoorPOIResults,
    selectedOutdoorPOI,
    isOutdoorPOILoading,
    selectPOI,
    selectPOIFromMap,
    clearSelectedPOI,
  } = useOutdoorPOI({
    debouncedQuery,
    userLocation: userPositionRef.current,
    activeCampus,
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
  const startIndoor = useIndoorNavigation();
  // Track the last map region for zoom-based indoor auto-show
  const lastIndoorAutoRef = useRef<string | null>(null);
  const floorSelectorFocusLockRef = useRef<{ buildingCode: string | null; until: number }>({
    buildingCode: null,
    until: 0,
  });

  // Indoor room picker (lets navigation inputs accept rooms like "H-840")
  const { indoorRoomOptions, handleIndoorRoomSelect } = useIndoorRoomPicker({
    indoor,
    isIndoorOnlyRoute,
    isAccessibleRouteEnabled,
  });

  // Accessible indoor routing support
  const [accessibleNavAttempt, setAccessibleNavAttempt] = useState(0);
  const lastAlertedAccessibleAttemptRef = useRef(0);
  const markAccessibleRouteAttempt = useCallback(() => {
    if (!isAccessibleRouteEnabled) return;
    setAccessibleNavAttempt((prev) => prev + 1);
  }, [isAccessibleRouteEnabled]);

  useEffect(() => {
    if (!isAccessibleRouteEnabled) {
      lastAlertedAccessibleAttemptRef.current = 0;
      return;
    }

    if (accessibleNavAttempt === 0) return;
    if (indoor.error !== INDOOR_NO_PATH_ERROR) return;
    if (lastAlertedAccessibleAttemptRef.current === accessibleNavAttempt) return;

    lastAlertedAccessibleAttemptRef.current = accessibleNavAttempt;
    Alert.alert(
      'No wheelchair-accessible route available',
      'We could not find a wheelchair-accessible path to that destination. Try a different room or contact building services for assistance.',
    );
  }, [accessibleNavAttempt, indoor.error, isAccessibleRouteEnabled]);

  const navigateToIndoorRoom = useCallback(
    (roomRef: string) => {
      const routeOptions = isAccessibleRouteEnabled
        ? { avoidStairs: true, avoidEscalators: true, preferElevator: true }
        : {};

      markAccessibleRouteAttempt();
      indoor.navigateToRoomAccessible(roomRef, routeOptions);
    },
    [indoor, isAccessibleRouteEnabled, markAccessibleRouteAttempt],
  );

  const previousAccessibleRouteEnabledRef = useRef(isAccessibleRouteEnabled);
  const previousStartAccessibleRouteEnabledRef = useRef(isAccessibleRouteEnabled);

  useEffect(() => {
    if (previousAccessibleRouteEnabledRef.current === isAccessibleRouteEnabled) return;
    previousAccessibleRouteEnabledRef.current = isAccessibleRouteEnabled;

    if (!indoor.destinationRoom) return;

    const routeOptions = isAccessibleRouteEnabled
      ? { avoidStairs: true, avoidEscalators: true, preferElevator: true }
      : {};

    markAccessibleRouteAttempt();

    indoor.rerouteCurrent(routeOptions);
  }, [
    indoor.destinationRoom,
    indoor.rerouteCurrent,
    isAccessibleRouteEnabled,
    markAccessibleRouteAttempt,
  ]);

  useEffect(() => {
    if (previousStartAccessibleRouteEnabledRef.current === isAccessibleRouteEnabled) return;
    previousStartAccessibleRouteEnabledRef.current = isAccessibleRouteEnabled;

    if (!startIndoor.destinationRoom) return;

    const routeOptions = isAccessibleRouteEnabled
      ? { avoidStairs: true, avoidEscalators: true, preferElevator: true }
      : {};

    startIndoor.rerouteCurrent(routeOptions);
  }, [startIndoor.destinationRoom, startIndoor.rerouteCurrent, isAccessibleRouteEnabled]);

  // -----------------------------------------------------------------------
  // Room autocomplete: search rooms on-the-fly (even before indoor is active)
  // using the service-layer functions so the user sees rooms like "H-840"
  // alongside buildings in the global search bar.
  // -----------------------------------------------------------------------
  const roomSearchResults = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return [];

    let results: any[] = [];
    let buildingsToSearch =
      indoor.isIndoorActive && indoor.activeBuildingCode
        ? [
            indoor.activeBuildingCode,
            ...INDOOR_BUILDINGS.map((b) => b.code).filter((c) => c !== indoor.activeBuildingCode),
          ]
        : INDOOR_BUILDINGS.map((b) => b.code);

    // If query looks like a specific building room (e.g. H-840), prioritize that building
    const detected = detectIndoorDestination(q);
    if (detected) {
      buildingsToSearch = [
        detected.buildingCode,
        ...buildingsToSearch.filter((code) => code !== detected.buildingCode),
      ];
    }

    for (const code of buildingsToSearch) {
      // Lazily load each building's data (will hit cache if already loaded)
      const data = loadBuilding(code);
      if (!data) continue;

      const meta = getBuildingMeta(code);
      const matches = searchIndoorRooms(q, data.roomIndex, code, 6);

      for (const room of matches) {
        if (results.length >= 6) break;
        results.push({
          id: `room-${code}-${room.featureId}`,
          name: room.ref,
          address: `${meta?.name ?? code} \u00B7 Floor ${room.level}`,
          code: code,
          _room: room,
          _buildingCode: code,
        });
      }

      if (results.length >= 6) break;
    }

    return results;
  }, [indoor, searchQuery]);

  type RoomSearchResult = (typeof roomSearchResults)[number];

  const outdoorPOISearchResults = useMemo(() => {
    return outdoorPOIResults.map((poi) => ({
      id: `poi-${poi.id}`,
      name: poi.name,
      address: poi.address,
      code: poi.category.replace(/_/g, ' '),
      _poi: poi,
    }));
  }, [outdoorPOIResults]);

  useEffect(() => {
    if (outdoorPOIResults.length > 0 && debouncedQuery.trim()) {
      trackOutdoorPoiSearched(debouncedQuery.trim(), outdoorPOIResults.length);
    }
  }, [outdoorPOIResults, debouncedQuery]);

  const mergedSearchResults = useMemo(() => {
    return [...roomSearchResults, ...searchResults, ...outdoorPOISearchResults];
  }, [roomSearchResults, searchResults, outdoorPOISearchResults]);

  const handleSelectRoomResult = useCallback(
    (result: RoomSearchResult) => {
      const room = result._room;
      const buildingCode = (result as any)._buildingCode as string | undefined;

      trackIndoorRoomSearched(room.ref);
      if (buildingCode) {
        trackIndoorRoomSelected(room.ref, buildingCode);
      }

      // Auto-activate indoor mode if not already on the right building
      if (buildingCode && (!indoor.isIndoorActive || indoor.activeBuildingCode !== buildingCode)) {
        trackIndoorMapActivated(buildingCode, 'search');
        indoor.activateBuilding(buildingCode);
        lastIndoorAutoRef.current = buildingCode;
      }

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
    },
    [indoor, setSearchQuery, setIsSearchFocused],
  );

  /** Handle selecting an autocomplete result — room, building, or outdoor POI. */
  const handleSelectMergedResult = useCallback(
    (result: {
      id: string;
      name: string;
      address: string | null;
      code: string | null;
      _room?: any;
      _poi?: OutdoorPOI;
    }) => {
      if (result.id.startsWith('room-') && (result as RoomSearchResult)._room) {
        handleSelectRoomResult(result as RoomSearchResult);
        return;
      }
      if (result.id.startsWith('poi-') && result._poi) {
        const poi = result._poi;
        trackOutdoorPoiSelected(poi.name, poi.category, 'search');
        handleCloseCard();
        selectPOI(poi);
        setSearchQuery(poi.name);
        setIsSearchFocused(false);
        searchInputRef.current?.blur();
        mapRef.current?.animateToRegion(
          {
            ...poi.coordinate,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500,
        );
        return;
      }
      clearSelectedPOI();
      handleSelectSearchResult(result as any);
    },
    [
      indoor,
      handleSelectSearchResult,
      handleSelectRoomResult,
      setSearchQuery,
      setIsSearchFocused,
      searchInputRef,
      handleCloseCard,
      selectPOI,
      clearSelectedPOI,
    ],
  );

  /** Navigate to the room from the info bubble. Uses GPS proximity to decide:
   *  if the user is near/inside the target building → indoor-only;
   *  if the user is far away → combined outdoor+indoor. */
  const handleRoomNavigate = useCallback(
    (room: { ref: string; level: string }) => {
      trackIndoorNavigateTapped(room.ref);
      // 1. Compute the indoor route (accessible if enabled)
      navigateToIndoorRoom(room.ref);
      setPendingDestinationRef(room.ref);
      setPendingDestinationBuildingCode(indoor.activeBuildingCode);

      // Close the bubble
      indoor.selectRoom(null);

      // Mark as user-triggered so zoom-out won’t deactivate indoor mode
      lastIndoorAutoRef.current = null;
      handleCloseCard();

      const userNearBuilding =
        userPositionRef.current &&
        findBuildingAtCoordinate(userPositionRef.current)?.code === indoor.activeBuildingCode;

      if (isIndoorOnlyRoute || userNearBuilding) {
        openIndoorOnlyNavigation(room.ref, 'Your location');
        return;
      }

      const outdoorBuilding = buildings.find(
        (b) => b.code?.toUpperCase() === indoor.activeBuildingCode?.toUpperCase(),
      );
      if (outdoorBuilding) {
        handleSelectBuilding(outdoorBuilding.id);
        openNavigationForBuilding(outdoorBuilding, null);
      } else {
        openIndoorOnlyNavigation(room.ref, 'Your location');
      }
    },
    [
      indoor,
      buildings,
      isIndoorOnlyRoute,
      handleCloseCard,
      handleSelectBuilding,
      openNavigationForBuilding,
      openIndoorOnlyNavigation,
      navigateToIndoorRoom,
    ],
  );

  const roomPressedRef = useRef(false);
  const poiPressedRef = useRef(false);

  /** Room marker tapped on the indoor overlay → toggle selection. */
  const handleRoomMarkerPress = useCallback(
    (room: any) => {
      roomPressedRef.current = true;
      requestAnimationFrame(() => {
        roomPressedRef.current = false;
      });

      if (indoor.selectedRoom?.featureId === room.featureId) {
        indoor.selectRoom(null);
      } else {
        if (room.ref && indoor.activeBuildingCode) {
          trackIndoorRoomSelected(room.ref, indoor.activeBuildingCode);
        }
        indoor.selectRoom(room);
      }
    },
    [indoor],
  );

  /** POI polygon tapped on the indoor overlay → toggle selection. */
  const handlePoiPress = useCallback(
    (poi: any) => {
      if (selectedPoi?.id === poi.id) {
        setSelectedPoi(null);
      } else {
        trackIndoorPoiTapped(getPoiTitle(poi));
        setSelectedPoi(poi);
      }
    },
    [selectedPoi],
  );

  /** Category chip tapped → filter POIs and escalators/elevators. */
  const handleCategoryChipPress = useCallback(
    (category: string) => {
      trackIndoorPoiCategoryFiltered(category);
      const { nextCategoryFilter, nextVisiblePoiAmenities } = resolveIndoorCategorySelection(
        indoorCategoryFilter,
        category,
      );
      setIndoorCategoryFilter(nextCategoryFilter);
      setVisiblePoiAmenities(nextVisiblePoiAmenities);
      setSelectedPoi(null);
    },
    [indoorCategoryFilter],
  );

  /**
   * When the user zooms in close enough over a building that has an indoor map,
   * automatically activate the indoor view (with the last-selected or default floor).
   * When they zoom back out, deactivate.
   */
  const handleRegionChange = useCallback(
    (region: Region) => {
      const center = { latitude: region.latitude, longitude: region.longitude };
      const now = Date.now();
      const focusLock = floorSelectorFocusLockRef.current;
      const isFocusLocked = !!focusLock.buildingCode && now < focusLock.until;
      const centeredIndoorBuilding =
        findBuildingAtOrNearCoordinate(
          center,
          [...sgwBuildings, ...loyolaBuildings],
          FLOOR_SELECTOR_FOCUS_RADIUS_METERS,
        )?.code ??
        findBuildingAtCoordinate(center)?.code ??
        null;

      if (
        !isFocusLocked &&
        centeredIndoorBuilding &&
        (centeredIndoorBuilding === indoor.activeBuildingCode ||
          centeredIndoorBuilding === startIndoor.activeBuildingCode)
      ) {
        setFocusedIndoorBuildingCode(centeredIndoorBuilding);
      }

      if (region.latitudeDelta < INDOOR_ZOOM_THRESHOLD) {
        // Zoomed in — check if a building with indoor data is under the camera centre
        const meta = findBuildingAtCoordinate(center);
        if (
          meta &&
          !indoor.indoorRoute &&
          (!indoor.isIndoorActive || indoor.activeBuildingCode !== meta.code)
        ) {
          trackIndoorMapActivated(meta.code, 'zoom');
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
    [indoor, loyolaBuildings, sgwBuildings, startIndoor],
  );

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
  const [hasDismissedCalendarRequired, setHasDismissedCalendarRequired] = useState(false);
  const nextClassEvent = getNextEvent(calendarEvents);

  const handleLogoPress = useCallback(() => {
    trackCalendarModalOpened();
    setCalendarModalVisible(true);
    if (isCalendarConnected) {
      refreshEvents();
    }
  }, [isCalendarConnected, refreshEvents]);

  const handleCalendarDisconnect = useCallback(async () => {
    await calendarDisconnect();
  }, [calendarDisconnect]);

  const handleOpenCalendarFromCourseModal = useCallback(() => {
    setCalendarModalVisible(true);
  }, []);

  const resolveNextClassIndoorRoomRef = useCallback(
    (rawLocation: string, resolvedBuildingCode: string | null | undefined): string | null => {
      const explicitIndoorDestination = detectIndoorDestination(rawLocation);
      if (explicitIndoorDestination) {
        return explicitIndoorDestination.roomRef;
      }

      if (!resolvedBuildingCode || !hasIndoorMap(resolvedBuildingCode)) return null;

      const parsed = parseLocationString(rawLocation);
      const cleanedRoomQuery = parsed.room?.trim().replace(/[),.;:]+$/g, '');
      if (!cleanedRoomQuery) return null;

      const buildingData = loadBuilding(resolvedBuildingCode);
      if (!buildingData) return null;

      const resolvedRoom = resolveRoom(
        cleanedRoomQuery,
        buildingData.roomIndex,
        resolvedBuildingCode,
      );
      return resolvedRoom?.ref ?? null;
    },
    [],
  );

  const handleDirectionsToNextClass = useCallback(() => {
    trackNextClassDirectionsTapped();
    const effectiveNow = simulatedNow ?? new Date();
    const nextClassState = getNextClassForToday(calendarEvents, effectiveNow);
    if (nextClassState.status === 'no_classes_today') {
      console.log('[handleDirectionsToNextClass] No classes scheduled today.');
      setNextClassPreview(null);
      Alert.alert('No classes today', 'You have no classes scheduled for today.');
      return;
    }
    if (nextClassState.status === 'classes_over_today') {
      console.log('[handleDirectionsToNextClass] Classes are over today.');
      setNextClassPreview(null);
      Alert.alert('Classes are over today', 'You are done for today.');
      return;
    }

    const nextEvent = nextClassState.event;

    if (nextClassPreview?.event.id === nextEvent.id) {
      setNextClassPreview(null);
      return;
    }

    // Log event details
    const rawLocation = nextEvent.location ?? '';
    console.log(
      '[handleDirectionsToNextClass] Next class details:\n' +
        `  id:          ${nextEvent.id}\n` +
        `  summary:     ${nextEvent.summary}\n` +
        `  description: ${nextEvent.description ?? 'N/A'}\n` +
        `  location:    ${rawLocation || 'N/A'}\n` +
        `  start:       ${nextEvent.start.dateTime ?? nextEvent.start.date ?? 'N/A'}\n` +
        `  end:         ${nextEvent.end.dateTime ?? nextEvent.end.date ?? 'N/A'}\n` +
        `  htmlLink:    ${nextEvent.htmlLink ?? 'N/A'}`,
    );

    // Resolve location against polygon datasets
    const resolution = resolveEventLocation(rawLocation, sgwBuildings, loyolaBuildings);
    const { building: resolvedBuilding, campus: resolvedCampus, conflict } = resolution;

    // Log conflict / warning
    if (conflict) {
      console.warn(
        `[handleDirectionsToNextClass] Location conflict detected:\n  ${getConflictLabel(conflict)}`,
      );
    }

    //  Log resolved building + open navigation
    if (resolvedBuilding && resolvedCampus) {
      console.log(
        '[handleDirectionsToNextClass] Resolved building:\n' +
          `  id:          ${resolvedBuilding.id}\n` +
          `  code:        ${resolvedBuilding.code ?? '(none)'}\n` +
          `  name:        ${resolvedBuilding.name}\n` +
          `  campus:      ${resolvedCampus}`,
      );
    } else {
      console.log('[handleDirectionsToNextClass] Building could not be resolved to a map polygon.');
    }

    const indoorRoomRef = resolveNextClassIndoorRoomRef(rawLocation, resolvedBuilding?.code);
    if (indoorRoomRef) {
      console.log(`[handleDirectionsToNextClass] Resolved indoor room: ${indoorRoomRef}`);
    }

    let campusKey: Campus | null = null;
    if (resolvedCampus === 'SGW') {
      campusKey = 'sgw';
    } else if (resolvedCampus === 'Loyola') {
      campusKey = 'loyola';
    }

    setNextClassPreview({
      event: nextEvent,
      building: resolvedBuilding ?? null,
      campus: campusKey,
      rawLocation,
      indoorRoomRef,
      conflict: conflict ?? null,
    });
  }, [
    calendarEvents,
    simulatedNow,
    nextClassPreview,
    loyolaBuildings,
    sgwBuildings,
    resolveNextClassIndoorRoomRef,
  ]);

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
  const nextClassCardTop = menuTop + (Platform.OS === 'ios' ? 140 : 120);

  const isColorBlind = colourBlindMode;
  const brandRed = theme?.cred?.get?.() ?? '#b21b2c';
  const colourBlindAccent = theme?.colourBlind2?.get?.() ?? '#1F4E8C';
  const routeColor = isColorBlind ? colourBlindAccent : brandRed;
  const defaultColor = theme?.cred?.get?.() ?? POLYGON_STROKE;
  const { polygonFillBase, polygonStrokeBase, polygonFillSelected } = getPolygonThemeColors(
    theme,
    colourBlindMode,
    defaultColor,
  );
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

      trackIndoorRoomSearched(query);
      trackIndoorMapActivated(detected.buildingCode, 'search');

      // 1. Activate indoor map + compute indoor route
      indoor.activateBuilding(detected.buildingCode);
      navigateToIndoorRoom(detected.roomRef);
      setPendingDestinationRef(detected.roomRef);
      setPendingDestinationBuildingCode(detected.buildingCode);

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
      const meta = getBuildingMeta(detected.buildingCode);
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
    [indoor, buildings, handleSelectBuilding, openNavigationForBuilding, navigateToIndoorRoom],
  );

  const handleQuickPick = (pick: QuickPick) => {
    const hint = pick.hint ? normalizeLabel(pick.hint) : null;
    const match =
      buildings.find((building) => hint && normalizeLabel(building.name).includes(hint)) ??
      buildings.find((building) => building.code?.toUpperCase() === pick.code);
    if (!match) return;
    trackBuildingSelected(match.name, match.code, activeCampus, 'quick_pick');
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
    trackCampusSwitched(activeCampus, campus);
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
    (resolved: ResolvedCampusBuilding, coordinate: LatLng) => {
      if (resolved.campus !== activeCampus) {
        setPendingStartBuilding({
          campus: resolved.campus,
          building: resolved.building,
          coordinate,
        });
        handleSelectCampus(resolved.campus, mapRef);
        return;
      }
      setStartToCurrentLocationBuilding(resolved.building.name, resolved.building.code, coordinate);
    },
    [activeCampus, handleSelectCampus, setStartToCurrentLocationBuilding],
  );

  const resolveDirectionsStartFromCoordinate = useCallback(
    (coordinate: LatLng) => {
      const insideMatch = resolveInsideBuilding(coordinate);
      if (insideMatch) {
        if (insideMatch.building.code && hasIndoorMap(insideMatch.building.code)) {
          setIndoorStartCoordPending(coordinate);
          setIndoorStartBuildingPending(insideMatch);
          setShowFloorSelectModal(true);
          return;
        }

        setDirectionsStartToBuilding(insideMatch, coordinate);
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
          setDirectionsStartToBuilding(
            {
              building: nearBorderBuilding,
              campus: campusKey,
            },
            coordinate,
          );
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
      if (handleIndoorRoomSelect(field, name)) {
        markAccessibleRouteAttempt();
        return;
      }

      const normalizedName = normalizeLabel(name);
      const isCurrentLocationStart =
        field === 'start' &&
        (normalizedName === normalizeLabel('Your location') ||
          normalizedName === normalizeLabel('Current location'));
      if (!isCurrentLocationStart) {
        handleSearchSelect(field, name, code);
        return;
      }

      trackCurrentLocationUsed();
      void goToUserLocation({
        animateToUser: false,
        onResolved: resolveDirectionsStartFromCoordinate,
      });
    },
    [
      goToUserLocation,
      handleSearchSelect,
      resolveDirectionsStartFromCoordinate,
      handleIndoorRoomSelect,
      markAccessibleRouteAttempt,
    ],
  );

  const normalizedNavigationStart = normalizeLabel(navigationStart);
  const isCurrentLocationStart =
    normalizedNavigationStart === NORMALIZED_YOUR_LOCATION ||
    normalizedNavigationStart.startsWith(NORMALIZED_CURRENT_LOCATION);

  useEffect(() => {
    const isIndoorBuildingStart = normalizedNavigationStart.startsWith(NORMALIZED_CURRENT_LOCATION);
    if (!isNavigationOpen || isIndoorOnlyRoute || !isIndoorBuildingStart) {
      startIndoor.deactivate();
    }
  }, [isIndoorOnlyRoute, isNavigationOpen, normalizedNavigationStart, startIndoor]);

  useEffect(() => {
    if (!isNavigationOpen) return;
    if (!isCurrentLocationStart) return;
    if (navigationOrigin) return;
    if (isLocating) return;
    if (indoorStartCoordPending || showFloorSelectModal) return;
    void goToUserLocation({
      animateToUser: false,
      onResolved: resolveDirectionsStartFromCoordinate,
    });
  }, [
    goToUserLocation,
    isCurrentLocationStart,
    isLocating,
    isNavigationOpen,
    navigationOrigin,
    resolveDirectionsStartFromCoordinate,
    indoorStartCoordPending,
    showFloorSelectModal,
  ]);

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

  const formatEventTimeRange = useCallback((event: CalendarEvent): string => {
    const start = event.start.dateTime ?? event.start.date;
    const end = event.end.dateTime ?? event.end.date;
    if (!start) return '';
    const startTime = new Date(start).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    if (!end) return startTime;
    const endTime = new Date(end).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${startTime} - ${endTime}`;
  }, []);

  const handleNextClassGo = useCallback(() => {
    if (!nextClassPreview) return;
    const { building, campus } = nextClassPreview;
    trackNextClassGoTapped(building?.name ?? 'unknown', nextClassPreview.indoorRoomRef);
    if (building && campus) {
      const classEndRaw = nextClassPreview.event.end.dateTime ?? nextClassPreview.event.end.date;
      const classEnd = classEndRaw ? new Date(classEndRaw) : null;
      setArriveByClassEnd(classEnd && Number.isFinite(classEnd.getTime()) ? classEnd : null);

      const destinationBuildingCode = building.code?.toUpperCase() ?? null;
      if (
        nextClassPreview.indoorRoomRef &&
        destinationBuildingCode &&
        hasIndoorMap(destinationBuildingCode)
      ) {
        setPendingDestinationRef(nextClassPreview.indoorRoomRef);
        setPendingDestinationBuildingCode(destinationBuildingCode);
        navigateToIndoorRoom(nextClassPreview.indoorRoomRef);
      } else {
        setPendingDestinationRef(null);
        setPendingDestinationBuildingCode(null);
      }

      if (campus !== activeCampus) {
        handleSelectCampus(campus, mapRef);
      }
      openNavigationForResolvedDestination(building);
      setNextClassPreview(null);
      return;
    }
    console.warn(
      '[handleNextClassGo] Unable to resolve destination from calendar location:',
      nextClassPreview.rawLocation,
    );
    Alert.alert(
      'Unable to open directions',
      `Could not resolve the building from "${nextClassPreview.rawLocation}".`,
    );
  }, [
    activeCampus,
    handleSelectCampus,
    navigateToIndoorRoom,
    nextClassPreview,
    openNavigationForResolvedDestination,
  ]);

  const handleTransportModeChange = useCallback(
    (mode: 'driving' | 'walking' | 'shuttle') => {
      if (lateTransportModes.includes(mode)) {
        Alert.alert('Route arrives too late', "You'll arrive after class ends");
        return;
      }
      trackTransportModeSelected(mode, isShuttleRoute);
      setSelectedTransportMode(mode);
    },
    [lateTransportModes, setSelectedTransportMode, isShuttleRoute],
  );

  const handleDisabledTransportModePress = useCallback(() => {
    Alert.alert('Route arrives too late', "You'll arrive after class ends");
  }, []);

  useEffect(() => {
    if (!pendingMapBuilding) return;
    if (activeCampus !== pendingMapBuilding.campus) return;
    handleSelectBuilding(pendingMapBuilding.id);
    setPendingMapBuilding(null);
  }, [activeCampus, handleSelectBuilding, pendingMapBuilding]);

  useEffect(() => {
    if (!pendingStartBuilding) return;
    if (activeCampus !== pendingStartBuilding.campus) return;
    setStartToCurrentLocationBuilding(
      pendingStartBuilding.building.name,
      pendingStartBuilding.building.code,
      pendingStartBuilding.coordinate,
    );
    setPendingStartBuilding(null);
  }, [activeCampus, pendingStartBuilding, setStartToCurrentLocationBuilding]);

  /**
   * Combine outdoor navigation steps with indoor route steps for a seamless
   * step-by-step experience: "Walk to Hall Building → Enter building →
   * Take elevator to floor 8 → Walk to room H-840".
   */
  const combinedNavigationSteps = useMemo<AugmentedNavigationStep[]>(() => {
    const mapIndoorSteps = (
      route: IndoorRoute,
      buildingCode: string | null,
    ): AugmentedNavigationStep[] =>
      route.steps.map((step) => ({
        instruction: step.instruction,
        distanceText: step.distanceMeters === null ? '' : `${Math.round(step.distanceMeters)} m`,
        durationText: step.estimatedSeconds === null ? '' : formatIndoorTime(step.estimatedSeconds),
        maneuver: step.fromLevel === step.toLevel ? 'walk' : 'level-change',
        focusCoordinate:
          step.path.length > 0 ? step.path[Math.floor(step.path.length / 2)] : undefined,
        _indoorLevel: step.toLevel,
        _indoorBuildingCode: buildingCode ?? undefined,
      }));

    const startIndoorSteps = startIndoor.indoorRoute
      ? mapIndoorSteps(startIndoor.indoorRoute, startIndoor.activeBuildingCode)
      : [];
    const destinationIndoorSteps = indoor.indoorRoute
      ? mapIndoorSteps(indoor.indoorRoute, indoor.activeBuildingCode)
      : [];

    if (isIndoorOnlyRoute) {
      return destinationIndoorSteps;
    }

    const combinedSteps: AugmentedNavigationStep[] = [...navigationSteps];

    if (startIndoor.indoorRoute && startIndoor.destinationRoom?.ref === 'Exit') {
      combinedSteps.unshift({
        instruction: `Exit ${startIndoor.buildingMeta?.name ?? 'the building'}`,
        distanceText: '',
        durationText: '',
        maneuver: 'exit-building' as const,
        focusCoordinate: startIndoor.buildingMeta?.entrances?.[0],
        _indoorLevel: startIndoor.indoorRoute.endLevel,
        _indoorBuildingCode: startIndoor.activeBuildingCode ?? undefined,
      });
      combinedSteps.unshift(...startIndoorSteps);
    }

    if (indoor.indoorRoute && indoor.destinationRoom?.ref !== 'Exit') {
      const entrance = indoor.buildingMeta?.entrances?.[0];
      combinedSteps.push({
        instruction: `Enter ${indoor.buildingMeta?.name ?? 'the building'}`,
        distanceText: '',
        durationText: '',
        maneuver: 'enter-building' as const,
        focusCoordinate: entrance,
        _indoorLevel: indoor.indoorRoute.startLevel,
        _indoorBuildingCode: indoor.activeBuildingCode ?? undefined,
      });
      combinedSteps.push(...destinationIndoorSteps);
    }

    return combinedSteps;
  }, [
    navigationSteps,
    startIndoor.activeBuildingCode,
    startIndoor.buildingMeta,
    startIndoor.destinationRoom,
    startIndoor.indoorRoute,
    indoor.activeBuildingCode,
    indoor.indoorRoute,
    indoor.buildingMeta,
    indoor.destinationRoom,
    isIndoorOnlyRoute,
  ]);

  // -----------------------------------------------------------------------
  // Augment the Google route summary with indoor navigation time so the
  // displayed total reflects outdoor travel + indoor wayfinding.
  // -----------------------------------------------------------------------
  const indoorTimeSec =
    (startIndoor.indoorRoute?.totalEstimatedSeconds ?? 0) +
    (indoor.indoorRoute?.totalEstimatedSeconds ?? 0);

  const indoorOnlySummary = useMemo(() => {
    if (!isIndoorOnlyRoute || !indoor.indoorRoute) return null;
    const dist = indoor.indoorRoute.totalDistanceMeters;
    return {
      arrivalText: '',
      distanceText: dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`,
      durationText: formatIndoorTime(indoorTimeSec),
      viaText: 'indoor route',
    };
  }, [isIndoorOnlyRoute, indoor.indoorRoute, indoorTimeSec]);

  const augmentedRouteSummary = useMemo(() => {
    if (isIndoorOnlyRoute) return indoorOnlySummary;
    if (!routeSummary || indoorTimeSec <= 0) return routeSummary;
    return {
      ...routeSummary,
      durationText: addSecondsToLabel(routeSummary.durationText, indoorTimeSec),
    };
  }, [isIndoorOnlyRoute, indoorOnlySummary, routeSummary, indoorTimeSec]);

  const augmentedModeDurations = useMemo(() => {
    if (isIndoorOnlyRoute) {
      return { walking: formatIndoorTime(indoorTimeSec) };
    }
    if (!modeDurations || indoorTimeSec <= 0) return modeDurations;
    return {
      driving: modeDurations.driving
        ? addSecondsToLabel(modeDurations.driving, indoorTimeSec)
        : modeDurations.driving,
      walking: modeDurations.walking
        ? addSecondsToLabel(modeDurations.walking, indoorTimeSec)
        : modeDurations.walking,
    };
  }, [isIndoorOnlyRoute, indoorTimeSec, modeDurations]);

  const augmentedWalkingRouteComparison = useMemo(() => {
    if (!walkingRouteComparison || isIndoorOnlyRoute || indoorTimeSec <= 0) {
      return walkingRouteComparison;
    }

    return {
      ...walkingRouteComparison,
      outdoor: {
        ...walkingRouteComparison.outdoor,
        durationText: addSecondsToLabel(walkingRouteComparison.outdoor.durationText, indoorTimeSec),
      },
      tunnel: {
        ...walkingRouteComparison.tunnel,
        durationText: addSecondsToLabel(walkingRouteComparison.tunnel.durationText, indoorTimeSec),
      },
    };
  }, [indoorTimeSec, isIndoorOnlyRoute, walkingRouteComparison]);

  const indoorTravelTimeText = useMemo(() => {
    if (indoorTimeSec <= 0) return undefined;
    return `~${formatIndoorTime(indoorTimeSec)} indoor walk`;
  }, [indoorTimeSec]);

  const isStartIndoorFocused =
    !!focusedIndoorBuildingCode &&
    focusedIndoorBuildingCode === startIndoor.activeBuildingCode &&
    !!startIndoor.activeBuildingCode;
  const floorSelectorLevels = isStartIndoorFocused ? startIndoor.levels : indoor.levels;
  const floorSelectorActiveLevel = isStartIndoorFocused
    ? startIndoor.activeLevel
    : indoor.activeLevel;
  const floorSelectorRoute = isStartIndoorFocused ? startIndoor.indoorRoute : indoor.indoorRoute;

  const selectedRoomTimeText = useMemo(() => {
    if (!indoor.selectedRoom) return undefined;
    const secs = indoor.estimateTimeToRoom(indoor.selectedRoom);
    if (secs == null || secs <= 0) return undefined;
    return `~${formatIndoorTime(secs)} indoor walk`;
  }, [indoor.selectedRoom, indoor.estimateTimeToRoom]);

  const handleFloorSelect = useCallback(
    (level: string) => {
      const activeIndoorController = isStartIndoorFocused ? startIndoor : indoor;
      const focusedBuildingCode = isStartIndoorFocused
        ? startIndoor.activeBuildingCode
        : indoor.activeBuildingCode;
      if (focusedBuildingCode) {
        trackFloorChanged(focusedBuildingCode, level);
        setFocusedIndoorBuildingCode(focusedBuildingCode);
        floorSelectorFocusLockRef.current = {
          buildingCode: focusedBuildingCode,
          until: Date.now() + 1500,
        };
      }
      activeIndoorController.setActiveLevel(level);

      if (!floorSelectorRoute) return;

      const segmentsOnLevel = floorSelectorRoute.steps
        .filter((s) => s.fromLevel === level && s.toLevel === level)
        .flatMap((s) => s.path);

      if (segmentsOnLevel.length === 0) return;

      const lats = segmentsOnLevel.map((c) => c.latitude);
      const lngs = segmentsOnLevel.map((c) => c.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      mapRef.current?.animateToRegion(
        {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
          latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.0005),
          longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.0005),
        },
        450,
      );
    },
    [floorSelectorRoute, indoor, isStartIndoorFocused, startIndoor],
  );

  const handlePreviewStepChange = useCallback(
    (
      step: {
        focusCoordinate?: { latitude: number; longitude: number };
        focusRegion?: {
          latitude: number;
          longitude: number;
          latitudeDelta: number;
          longitudeDelta: number;
        };
        _indoorLevel?: string;
        _indoorBuildingCode?: string;
      },

      index: number,
    ) => {
      if (index < 0) return;
      if (step.focusRegion) {
        mapRef.current?.animateToRegion(step.focusRegion, 450);
        return;
      }
      const coordinate = step.focusCoordinate;
      if (!coordinate) return;

      // If this is an indoor step, auto-switch to the right floor and zoom close
      if (step._indoorLevel) {
        if (step._indoorBuildingCode) {
          setFocusedIndoorBuildingCode(step._indoorBuildingCode);
        }
        if (step._indoorBuildingCode === startIndoor.activeBuildingCode) {
          startIndoor.setActiveLevel(step._indoorLevel);
        } else {
          if (step._indoorBuildingCode && indoor.activeBuildingCode !== step._indoorBuildingCode) {
            indoor.activateBuilding(step._indoorBuildingCode);
          }
          indoor.setActiveLevel(step._indoorLevel);
        }
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
    [indoor, startIndoor],
  );

  const handleOpenRoutePreview = useCallback(() => {
    if (combinedNavigationSteps.length === 0) return;
    trackRoutePreviewOpened();
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

  const handleOpenDirectionsMode = useCallback(() => {
    if (combinedNavigationSteps.length === 0) return;
    trackDirectionsModeOpened();
    setIsDirectionsModeOpen(true);
  }, [combinedNavigationSteps]);

  const handleCloseDirectionsMode = useCallback(() => {
    setIsDirectionsModeOpen(false);
  }, []);

  const handleOffRoute = rerouteFromLocation;
  const handleDirectionsLocationUpdate = useCallback(
    (coordinate: { latitude: number; longitude: number }, _stepIndex: number) => {
      mapRef.current?.animateToRegion(
        {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        },
        400,
      );
    },
    [],
  );

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
      setArriveByClassEnd(null);
      setIsDirectionsModeOpen(false);

      // Only clear indoor state on the transition from open → closed,
      // not on every render where navigation happens to be closed
      // (otherwise zoom-auto-activation gets immediately undone).
      if (wasOpen) {
        indoor.deactivate();
        startIndoor.deactivate();
        lastIndoorAutoRef.current = null;
        setIndoorStartCoordPending(null);
        setIndoorStartBuildingPending(null);
        setShowFloorSelectModal(false);
        setPendingDestinationRef(null);
        setPendingDestinationBuildingCode(null);
        setFocusedIndoorBuildingCode(null);
      }
    }
  }, [isNavigationOpen, indoor, startIndoor]);

  const showCalendarRequired =
    !hasDismissedCalendarRequired && !isClassesCalendarValid(isCalendarConnected);
  const nextClassTime = nextClassPreview ? formatEventTimeRange(nextClassPreview.event) : '';
  const nextClassTitle = nextClassPreview?.event.summary ?? '';
  const nextClassLocationLabel =
    nextClassPreview?.building && nextClassPreview.indoorRoomRef
      ? `${nextClassPreview.building.name} - ${nextClassPreview.indoorRoomRef}`
      : (nextClassPreview?.building?.name ??
        nextClassPreview?.event.location ??
        'Location unavailable');

  const handleFloorSelected = useCallback(
    (floor: string) => {
      setShowFloorSelectModal(false);
      if (!indoorStartCoordPending || !indoorStartBuildingPending) return;

      const buildingCode = indoorStartBuildingPending.building.code;
      const buildingData = buildingCode ? loadBuilding(buildingCode) : null;

      const proceedWithStart = (startRef: string, startPos: LatLng, isHallway: boolean) => {
        const destRef = indoor.destinationRoom?.ref || pendingDestinationRef;
        const routeOptions = isAccessibleRouteEnabled
          ? { avoidStairs: true, avoidEscalators: true, preferElevator: true }
          : {};

        // If we are navigating indoor with an active indoor destination
        if (isIndoorOnlyRoute && destRef) {
          if (
            buildingCode &&
            (!indoor.isIndoorActive || indoor.activeBuildingCode !== buildingCode)
          ) {
            indoor.activateBuilding(buildingCode);
          }
          markAccessibleRouteAttempt();
          indoor.navigateToRoomAccessible(
            destRef,
            routeOptions,
            startPos,
            floor,
            buildingCode ?? undefined,
          );
          const startLabel = isHallway ? 'Hallway' : startRef;
          setStartToCurrentLocationBuilding(startLabel, buildingCode ?? '', startPos);
        } else {
          // Normal outdoor start, but user is indoors
          markAccessibleRouteAttempt();
          startIndoor.navigateToRoomAccessible(
            '__EXIT__',
            routeOptions,
            startPos,
            floor,
            buildingCode ?? undefined,
          );
          if (destRef && pendingDestinationBuildingCode) {
            indoor.navigateToRoomAccessible(
              destRef,
              routeOptions,
              undefined,
              undefined,
              pendingDestinationBuildingCode,
            );
          }
          const bMeta = buildingCode ? getBuildingMeta(buildingCode) : null;
          const exitCoord = bMeta?.entrances?.[0] || startPos;
          setDirectionsStartToBuilding(indoorStartBuildingPending, exitCoord);
        }
        setIndoorStartCoordPending(null);
        setIndoorStartBuildingPending(null);
      };

      if (!buildingData) {
        proceedWithStart(indoorStartBuildingPending.building.name, indoorStartCoordPending, false);
        return;
      }

      const matchedRoom = findRoomAtCoordinate(
        buildingData.features,
        indoorStartCoordPending,
        floor,
      );

      if (matchedRoom) {
        Alert.alert('Room Detected', `Are you currently in ${matchedRoom.ref}?`, [
          {
            text: 'No, just near here',
            style: 'cancel',
            onPress: () => proceedWithStart('Hallway', indoorStartCoordPending, true),
          },
          {
            text: 'Yes',
            onPress: () =>
              proceedWithStart(matchedRoom.ref ?? 'Unknown Room', matchedRoom.centroid, false),
          },
        ]);
      } else {
        proceedWithStart('Hallway', indoorStartCoordPending, true);
      }
    },
    [
      indoorStartCoordPending,
      indoorStartBuildingPending,
      isIndoorOnlyRoute,
      isAccessibleRouteEnabled,
      indoor,
      startIndoor,
      pendingDestinationBuildingCode,
      markAccessibleRouteAttempt,
      setStartToCurrentLocationBuilding,
      setDirectionsStartToBuilding,
    ],
  );

  return (
    <View style={styles.container} testID="map-screen">
      {showCalendarRequired ? (
        <ClassesCalendarRequired
          onConnectCalendar={() => setCalendarModalVisible(true)}
          onContinueAsGuest={() => setHasDismissedCalendarRequired(true)}
        />
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
        showsPointsOfInterest={!indoor.isIndoorActive && outdoorPOIResults.length === 0}
        customMapStyle={
          indoor.isIndoorActive || outdoorPOIResults.length > 0 ? HIDE_POIS_MAP_STYLE : []
        }
        onUserLocationChange={(e) => {
          const c = e.nativeEvent.coordinate;
          if (c) userPositionRef.current = { latitude: c.latitude, longitude: c.longitude };
        }}
        onRegionChangeComplete={handleRegionChange}
        onPoiClick={(e) => {
          const { placeId, name, coordinate } = e.nativeEvent;
          if (!coordinate || !name) return;
          handleCloseCard();
          selectPOIFromMap({
            id: placeId ?? `map-poi-${Date.now()}`,
            name,
            address: '',
            coordinate: { latitude: coordinate.latitude, longitude: coordinate.longitude },
            category: 'place',
          });
        }}
        onPress={(e) => {
          if (isSearchFocused) {
            Keyboard.dismiss();
            setIsSearchFocused(false);
          }

          if (!poiPressedRef.current) clearSelectedPOI();
          const coordinate = e.nativeEvent?.coordinate;
          if (coordinate?.latitude != null && coordinate?.longitude != null) {
            if (indoor.isIndoorActive) {
              if (!roomPressedRef.current) indoor.selectRoom(null);
              return;
            }
            if (!poiPressedRef.current) handleMapCoordinatePress(coordinate);
          }
        }}
      >
        {tapMarkerCoordinate && (
          <Marker coordinate={tapMarkerCoordinate} testID="map-tap-marker" pinColor={brandRed} />
        )}
        {routePolyline.length > 0 && selectedTransportMode === 'driving' && (
          <Polyline
            key="route-driving"
            testID="route-driving-polyline"
            coordinates={routePolyline}
            strokeColor="#4A89F3"
            strokeWidth={5}
          />
        )}
        {routePolyline.length > 0 && selectedTransportMode === 'walking' && (
          <Polyline
            key="route-walking"
            testID="route-walking-polyline"
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
        {(startIndoor.isIndoorActive || startIndoor.indoorRoute) &&
          startIndoor.activeBuildingCode !== indoor.activeBuildingCode && (
            <IndoorMapOverlay
              activeLevelFeatures={startIndoor.activeLevelFeatures}
              route={startIndoor.indoorRoute}
              activeLevel={startIndoor.activeLevel}
              destinationRoom={startIndoor.destinationRoom}
              routeColor={routeColor}
              isColorBlind={isColorBlind}
            />
          )}
        {(indoor.isIndoorActive || indoor.indoorRoute) && (
          <IndoorMapOverlay
            activeLevelFeatures={indoor.activeLevelFeatures}
            route={indoor.indoorRoute}
            activeLevel={indoor.activeLevel}
            destinationRoom={indoor.destinationRoom}
            selectedRoom={indoor.selectedRoom}
            onRoomPress={handleRoomMarkerPress}
            onPoiPress={handlePoiPress}
            routeColor={routeColor}
            visiblePoiAmenities={visiblePoiAmenities}
            categoryFilter={indoorCategoryFilter}
            isColorBlind={isColorBlind}
          />
        )}
        {outdoorPOIResults.map((poi) => (
          <Marker
            key={`outdoor-poi-${poi.id}`}
            coordinate={poi.coordinate}
            testID={`outdoor-poi-marker-${poi.id}`}
            zIndex={999}
            onPress={() => {
              poiPressedRef.current = true;
              requestAnimationFrame(() => {
                poiPressedRef.current = false;
              });
              trackOutdoorPoiSelected(poi.name, poi.category, 'marker');
              handleCloseCard();
              selectPOI(poi);
            }}
          >
            <View style={styles.poiMarkerPin}>
              <MaterialIcons
                name={POI_MARKER_ICONS[poi.category] ?? FALLBACK_POI_ICON}
                size={16}
                color="#fff"
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Category filter chips */}
      {indoor.isIndoorActive && !isNavigationOpen && !isMenuOpen && !isSearchFocused && (
        <View style={styles.indoorCategoryChips} pointerEvents="auto">
          <Pressable
            testID="indoor-chip-washrooms"
            style={[
              styles.categoryChip,
              indoorCategoryFilter === 'washrooms' && {
                backgroundColor: brandRed,
              },
            ]}
            onPress={() => handleCategoryChipPress('washrooms')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons
              name="wc"
              size={24}
              color={indoorCategoryFilter === 'washrooms' ? '#fff' : '#666'}
            />
          </Pressable>

          <Pressable
            testID="indoor-chip-elevators"
            style={[
              styles.categoryChip,
              indoorCategoryFilter === 'elevators' && {
                backgroundColor: brandRed,
              },
            ]}
            onPress={() => handleCategoryChipPress('elevators')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons
              name="elevator"
              size={24}
              color={indoorCategoryFilter === 'elevators' ? '#fff' : '#666'}
            />
          </Pressable>

          <Pressable
            testID="indoor-chip-water-fountains"
            style={[
              styles.categoryChip,
              indoorCategoryFilter === 'water_fountains' && {
                backgroundColor: brandRed,
              },
            ]}
            onPress={() => handleCategoryChipPress('water_fountains')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons
              name="water-drop"
              size={24}
              color={indoorCategoryFilter === 'water_fountains' ? '#fff' : '#666'}
            />
          </Pressable>
        </View>
      )}

      {/* Indoor floor selector pill — visible during navigation so users can switch floors */}
      {(indoor.isIndoorActive || startIndoor.isIndoorActive) &&
        !isRoutePreviewOpen &&
        !isDirectionsModeOpen &&
        !isMenuOpen &&
        !isSearchFocused && (
          <FloorSelector
            levels={floorSelectorLevels}
            activeLevel={floorSelectorActiveLevel}
            onSelectLevel={handleFloorSelect}
            accentColor={brandRed}
          />
        )}

      {/* Room info bubble — appears when a room is tapped or selected from search */}
      {indoor.isIndoorActive && indoor.selectedRoom && !isMenuOpen && !isSearchFocused && (
        <RoomInfoBubble
          room={indoor.selectedRoom}
          buildingName={indoor.buildingMeta?.name}
          onNavigate={handleRoomNavigate}
          onClose={() => indoor.selectRoom(null)}
          estimatedTimeText={selectedRoomTimeText}
          accentColor={brandRed}
          bottomOffset={isQuickPickOpen ? 320 : 160}
        />
      )}

      {/* POI info bubble — appears when a POI polygon is tapped */}
      {indoor.isIndoorActive && selectedPoi && !isMenuOpen && !isSearchFocused && (
        <PoiInfoBubble
          poiTitle={getPoiTitle(selectedPoi)}
          level={indoor.activeLevel}
          buildingName={indoor.buildingMeta?.name}
          onClose={() => setSelectedPoi(null)}
          accentColor={brandRed}
          bottomOffset={isQuickPickOpen ? 320 : 160}
        />
      )}

      {/* Top Controls: Search, Menu, Brand Badge */}
      {!isRoutePreviewOpen && !isDirectionsModeOpen && (
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
                if (isSupportedPOICategory(searchQuery)) {
                  if (mergedSearchResults.length > 0) {
                    handleSelectMergedResult(mergedSearchResults[0]);
                  }
                  return;
                }
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
            blurOnSubmit={!isSupportedPOICategory(searchQuery)}
            isLoading={isOutdoorPOILoading}
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

      {/* Building Info Card — hidden while the navigation sheet is open */}
      <BuildingInfoCard
        selectedBuilding={isNavigationOpen ? null : selectedBuilding}
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
          trackBuildingDirectionsTapped(selectedBuilding?.name ?? '');
          trackNavigationOpened(selectedBuilding?.name ?? '');
          setArriveByClassEnd(null);
          openNavigationForBuilding(selectedBuilding, remoteBuilding);
          handleCloseCard();
        }}
      />
      <OutdoorPOIInfoCard
        poi={isNavigationOpen ? null : selectedOutdoorPOI}
        onClose={clearSelectedPOI}
        isColorBlind={isColorBlind}
        onDirections={
          selectedOutdoorPOI
            ? () => {
                trackOutdoorPoiDirectionsTapped(
                  selectedOutdoorPOI.name,
                  selectedOutdoorPOI.category,
                );
                setArriveByClassEnd(null);
                openNavigationForCoordinate(selectedOutdoorPOI.name, selectedOutdoorPOI.coordinate);
                clearSelectedPOI();
              }
            : undefined
        }
      />
      <NavigationScreen
        visible={isNavigationOpen && !isRoutePreviewOpen && !isDirectionsModeOpen}
        startLabel={navigationStart}
        destinationLabel={navigationDestination}
        destinationLocked={isDestinationLocked}
        onClose={closeNavigation}
        onActiveFieldChange={setNavigationActiveField}
        onBuildingSelect={handleNavigationBuildingSelect}
        modeDurations={augmentedModeDurations}
        walkingRouteComparison={augmentedWalkingRouteComparison}
        tripSummary={augmentedRouteSummary}
        isLoading={isRouteLoading}
        directionsError={directionsError}
        isGetDirectionsDisabled={isGetDirectionsDisabled}
        selectedTransportMode={selectedTransportMode}
        onTransportModeChange={handleTransportModeChange}
        onWalkingRouteVariantChange={(variant) => {
          trackWalkingVariantSelected(variant);
          setSelectedWalkingRouteVariant(variant);
        }}
        disabledTransportModes={lateTransportModes}
        onDisabledTransportModePress={handleDisabledTransportModePress}
        navigationSteps={combinedNavigationSteps}
        isShuttleRoute={isShuttleRoute}
        isShuttleLoading={isShuttleLoading}
        shuttleInfo={shuttleInfo}
        isWeekend={isWeekend}
        isAccessibleRouteEnabled={isAccessibleRouteEnabled}
        onAccessibleRouteChange={(enabled: boolean) => {
          trackAccessibleRouteToggled(enabled);
          setIsAccessibleRouteEnabled(enabled);
        }}
        onOpenPreview={handleOpenRoutePreview}
        onOpenDirections={handleOpenDirectionsMode}
        indoorTravelTimeText={indoorTravelTimeText}
        isIndoorOnlyRoute={isIndoorOnlyRoute}
        indoorRoomOptions={indoorRoomOptions}
      />

      <RoutePreviewScreen
        visible={isRoutePreviewOpen}
        steps={combinedNavigationSteps}
        selectedStepIndex={previewStepIndex}
        onSelectStep={handleSelectPreviewStep}
        onClose={handleCloseRoutePreview}
        destinationLabel={navigationDestination}
      />
      <DirectionsModeScreen
        visible={isDirectionsModeOpen}
        steps={combinedNavigationSteps}
        routePolyline={routePolyline}
        onOffRoute={handleOffRoute}
        onRecenterToUser={goToUserLocation}
        isRerouting={isRouteLoading && isDirectionsModeOpen}
        onClose={handleCloseDirectionsMode}
        onLocationUpdate={handleDirectionsLocationUpdate}
      />

      {nextClassPreview && !isNavigationOpen && !isRoutePreviewOpen && !isDirectionsModeOpen ? (
        <View style={[styles.nextClassCard, { top: nextClassCardTop }]} testID="next-class-card">
          <Text style={styles.nextClassTitle}>Directions to my next class</Text>
          <Text style={styles.nextClassSubtitle}>Taken from Google Calendar</Text>
          <View style={styles.nextClassRow}>
            <View style={styles.nextClassRowLeft}>
              <MaterialIcons name="event" size={18} color="#6e6e6e" />
              <Text style={styles.nextClassName} numberOfLines={1}>
                {nextClassTitle}
              </Text>
            </View>
            <Text style={styles.nextClassTime}>{nextClassTime}</Text>
          </View>
          <Text style={styles.nextClassLocation} numberOfLines={1}>
            {nextClassLocationLabel}
          </Text>
          <Pressable style={styles.nextClassGoButton} onPress={handleNextClassGo}>
            <Text style={styles.nextClassGoText}>Go</Text>
          </Pressable>
        </View>
      ) : null}

      <NextClassPanel
        isVisible={!isMenuOpen && !isNavigationOpen}
        isCalendarConnected={isCalendarConnected}
        nextEvent={nextClassEvent}
        onOpenCalendarConnect={handleOpenCalendarFromCourseModal}
      >
        {(openNextClassPanel, showNextClassInfo) =>
          !isMenuOpen && !isNavigationOpen ? (
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
              onDirectionsToNextClassPress={handleDirectionsToNextClass}
              showNextClassInfo={showNextClassInfo}
              onNextClassInfoPress={openNextClassPanel}
            />
          ) : null
        }
      </NextClassPanel>

      {!isRoutePreviewOpen && !isDirectionsModeOpen && (
        <MapMenu
          visible={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          visiblePoiAmenities={visiblePoiAmenities}
          onVisiblePoiAmenitiesChange={setVisiblePoiAmenities}
        />
      )}

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

      <IndoorStartPromptModal
        visible={showFloorSelectModal}
        buildingCode={indoorStartBuildingPending?.building.code ?? ''}
        levels={
          indoorStartBuildingPending?.building.code
            ? (getBuildingMeta(indoorStartBuildingPending.building.code)?.levels ?? [])
            : []
        }
        onSelectLevel={handleFloorSelected}
        onCancel={() => {
          setShowFloorSelectModal(false);
          if (indoorStartBuildingPending && indoorStartCoordPending) {
            setDirectionsStartToBuilding(indoorStartBuildingPending, indoorStartCoordPending);
          }
          setIndoorStartCoordPending(null);
          setIndoorStartBuildingPending(null);
        }}
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
  nextClassCard: {
    position: 'absolute',
    left: 22,
    right: 22,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  nextClassTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2a2a2a',
  },
  nextClassSubtitle: {
    fontSize: 12,
    color: '#7a7a7a',
    marginTop: 2,
  },
  nextClassRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextClassRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 6,
    flex: 1,
    marginRight: 10,
  },
  nextClassName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f1f1f',
    flexShrink: 1,
  },
  nextClassTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4a4a4a',
  },
  nextClassLocation: {
    marginTop: 6,
    fontSize: 13,
    color: '#6a6a6a',
  },
  nextClassGoButton: {
    alignSelf: 'center',
    marginTop: 12,
    backgroundColor: '#8e2334',
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 16,
  },
  nextClassGoText: {
    color: '#fff',
    fontWeight: '700',
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
  poiInfoBubble: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignSelf: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  poiInfoContent: {
    flex: 1,
  },
  poiInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  poiInfoRef: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  poiInfoLevel: {
    fontSize: 12,
    color: '#999',
  },
  poiInfoCloseButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  poiInfoCloseButtonText: {
    fontSize: 18,
    color: '#999',
    fontWeight: '500',
  },
  indoorCategoryChips: {
    position: 'absolute',
    left: 16,
    top: '35%',
    flexDirection: 'column',
    gap: 10,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryChip: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  poiMarkerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#912338',
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
