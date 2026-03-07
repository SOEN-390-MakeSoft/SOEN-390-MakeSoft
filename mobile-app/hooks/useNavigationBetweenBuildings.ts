import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { BUILDING_POLYGONS } from '../data/buildingPolygons';
import { LOYOLA_BUILDING_POLYGONS } from '../data/buildingPolygonsLoyola';
import { getNextShuttles } from '../services/api';
import {
  coordsEqual,
  findBuildingAtOrNearCoordinate,
  polygonCentroid,
  type LatLng,
} from '../utils/mapUtils';
import { extractCodeFromName, normalizeLabel } from '../utils/stringUtils';

const MAX_TAP_DISTANCE_METERS = 80;

/** Decode a Google-encoded polyline string into an array of LatLng. */
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = (encoded.codePointAt(index++) ?? 0) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = (encoded.codePointAt(index++) ?? 0) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

function calculateBounds(coords: LatLng[]) {
  let minLat = coords[0].latitude;
  let maxLat = coords[0].latitude;
  let minLng = coords[0].longitude;
  let maxLng = coords[0].longitude;
  for (const c of coords) {
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
    if (c.longitude < minLng) minLng = c.longitude;
    if (c.longitude > maxLng) maxLng = c.longitude;
  }
  return { minLat, maxLat, minLng, maxLng };
}

function boundsToRegion(bounds: ReturnType<typeof calculateBounds>): MapRegion {
  const PADDING = 1.4;
  const latDelta = (bounds.maxLat - bounds.minLat) * PADDING || 0.005;
  const lngDelta = (bounds.maxLng - bounds.minLng) * PADDING || 0.005;
  return {
    latitude: (bounds.minLat + bounds.maxLat) / 2,
    longitude: (bounds.minLng + bounds.maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

type Building = {
  id: string;
  name: string;
  code: string | null;
  polygon: readonly LatLng[];
};

type RemoteBuilding = {
  name?: string | null;
  code?: string | null;
} | null;

type RouteSummary = {
  arrivalText: string;
  distanceText: string;
  durationText: string;
  viaText: string;
};

type RouteMode = 'driving' | 'transit' | 'walking';

type ModeDurations = {
  driving?: string;
  walking?: string;
};

type TransportMode = 'driving' | 'walking' | 'shuttle';

export type NavigationStep = {
  instruction: string;
  distanceText: string;
  durationText: string;
  maneuver?: string;
  focusCoordinate?: LatLng;
};

type ModeRoute = {
  durationText: string;
  durationSec: number;
  distanceText: string;
  viaText: string;
  polyline: LatLng[];
  steps: NavigationStep[];
};

type AllModeRoutes = {
  driving?: ModeRoute | null;
  walking?: ModeRoute | null;
};

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

// SGW shuttle hub: Hall Building (1455 De Maisonneuve Blvd W)
const SHUTTLE_HUB_SGW: LatLng = { latitude: 45.4972, longitude: -73.5789 };
// Loyola shuttle hub: Vanier Library area (7141 Sherbrooke St W)
const SHUTTLE_HUB_LOY: LatLng = { latitude: 45.4584, longitude: -73.6387 };

/** Returns true when the origin is on SGW campus and the destination is on Loyola campus (or vice versa). */
function isCrossCampusRoute(origin: LatLng | null, destination: LatLng | null): boolean {
  if (!origin || !destination) return false;
  const SGW_BOUNDS = { minLat: 45.491, maxLat: 45.502, minLng: -73.582, maxLng: -73.57 };
  const LOY_BOUNDS = { minLat: 45.455, maxLat: 45.462, minLng: -73.648, maxLng: -73.633 };
  const inSgw = (p: LatLng) =>
    p.latitude >= SGW_BOUNDS.minLat &&
    p.latitude <= SGW_BOUNDS.maxLat &&
    p.longitude >= SGW_BOUNDS.minLng &&
    p.longitude <= SGW_BOUNDS.maxLng;
  const inLoy = (p: LatLng) =>
    p.latitude >= LOY_BOUNDS.minLat &&
    p.latitude <= LOY_BOUNDS.maxLat &&
    p.longitude >= LOY_BOUNDS.minLng &&
    p.longitude <= LOY_BOUNDS.maxLng;
  return (inSgw(origin) && inLoy(destination)) || (inLoy(origin) && inSgw(destination));
}

/** Returns the departure campus key ('SGW' | 'LOY') based on which campus the origin is on. */
function getDepartureCampus(origin: LatLng): 'SGW' | 'LOY' {
  const SGW_BOUNDS = { minLat: 45.491, maxLat: 45.502, minLng: -73.582, maxLng: -73.57 };
  const inSgw =
    origin.latitude >= SGW_BOUNDS.minLat &&
    origin.latitude <= SGW_BOUNDS.maxLat &&
    origin.longitude >= SGW_BOUNDS.minLng &&
    origin.longitude <= SGW_BOUNDS.maxLng;
  return inSgw ? 'SGW' : 'LOY';
}

/** Returns true if today is a weekend (Saturday or Sunday). */
function isWeekend(): boolean {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

export type ShuttleInfo = {
  /** ISO strings for the next (up to 3) departure times; null entries mean no departure. */
  departureTimes: (string | null)[];
  /** Fixed shuttle trip duration in minutes (from backend). */
  tripDurationMin: number;
  /** Campus the shuttle departs from. */
  departureCampus: 'SGW' | 'LOY';
  /** Polyline from current location to the departure hub (walk). */
  walkToHubPolyline: LatLng[];
  /** Road-following polyline for the shuttle segment between the two hubs (driving route). */
  shuttleSegmentPolyline: LatLng[];
  /** Polyline from the arrival hub to the final destination (walk). */
  walkFromHubPolyline: LatLng[];
};

interface UseNavigationBetweenBuildingsParams {
  buildings: Building[];
  onSelectBuilding: (buildingId: string) => void;
  /** Called when user taps the map and the tap is far from any campus building */
  onBuildingNotFound?: () => void;
}

export function useNavigationBetweenBuildings({
  buildings,
  onSelectBuilding,
  onBuildingNotFound,
}: UseNavigationBetweenBuildingsParams) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [navigationStart, setNavigationStart] = useState<string>('Your location');
  const [navigationDestination, setNavigationDestination] = useState<string>('');
  const [navigationOrigin, setNavigationOrigin] = useState<LatLng | null>(null);
  const [navigationDestinationCoord, setNavigationDestinationCoord] = useState<LatLng | null>(null);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [modeDurations, setModeDurations] = useState<ModeDurations>({});
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<RouteMode>('driving');
  const [navigationActiveField, setNavigationActiveFieldState] = useState<
    'start' | 'destination' | null
  >(null);
  const [isDestinationLocked, setIsDestinationLocked] = useState(false);
  const [tapMarkerCoordinate, setTapMarkerCoordinate] = useState<LatLng | null>(null);
  const [allModeRoutes, setAllModeRoutes] = useState<AllModeRoutes>({});
  const [selectedTransportMode, setSelectedTransportMode] = useState<TransportMode>('driving');
  const [routePolyline, setRoutePolyline] = useState<LatLng[]>([]);
  const [routeRegion, setRouteRegion] = useState<MapRegion | null>(null);
  const [navigationSteps, setNavigationSteps] = useState<NavigationStep[]>([]);

  // --- Shuttle state ---
  const [isShuttleRoute, setIsShuttleRoute] = useState(false);
  const [shuttleInfo, setShuttleInfo] = useState<ShuttleInfo | null>(null);
  const [isShuttleLoading, setIsShuttleLoading] = useState(false);

  // Combined building list across both campuses for search/coordinate resolution
  const allBuildings = useMemo<Building[]>(() => {
    const fromPolygons = (polygons: Record<string, { name: string; polygon: readonly LatLng[] }>) =>
      Object.entries(polygons)
        .filter(([, r]) => r.polygon.length > 0)
        .map(([id, r]) => ({
          id,
          name: r.name,
          code: extractCodeFromName(r.name),
          polygon: r.polygon,
        }));
    return [
      ...fromPolygons(
        BUILDING_POLYGONS as Record<string, { name: string; polygon: readonly LatLng[] }>,
      ),
      ...fromPolygons(
        LOYOLA_BUILDING_POLYGONS as Record<string, { name: string; polygon: readonly LatLng[] }>,
      ),
    ];
  }, []);

  const hasOrigin = navigationOrigin !== null;
  const hasDestinationLabel = navigationDestination.trim() !== '';
  const hasDestinationCoord = navigationDestinationCoord !== null;
  const sameOriginDestination =
    hasOrigin &&
    hasDestinationCoord &&
    navigationOrigin !== null &&
    navigationDestinationCoord !== null &&
    coordsEqual(navigationOrigin, navigationDestinationCoord);
  const missingCoordinates = hasDestinationLabel && !hasDestinationCoord;

  let directionsError: 'same_origin_destination' | 'missing_coordinates' | null = null;
  if (sameOriginDestination) directionsError = 'same_origin_destination';
  else if (missingCoordinates) directionsError = 'missing_coordinates';
  const isGetDirectionsDisabled =
    !hasOrigin || !hasDestinationLabel || sameOriginDestination || missingCoordinates;

  const formatBuildingLabel = useCallback((name: string, code: string | null) => {
    if (!code) return name;
    return name.includes(`(${code})`) ? name : `${name} (${code})`;
  }, []);

  const setNavigationActiveField = useCallback(
    (field: 'start' | 'destination' | null) => {
      if (isDestinationLocked && field === 'destination') return;
      setNavigationActiveFieldState(field);
    },
    [isDestinationLocked],
  );

  const getDirectionsKey = () => {
    if (Platform.OS === 'ios') {
      return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS;
    }
    return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;
  };

  useEffect(() => {
    if (!isNavigationOpen) return;
    if (navigationStart !== 'Your location') return;
    if (navigationOrigin) return;

    let cancelled = false;
    const resolveLocation = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') return;
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setNavigationOrigin({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch {
        // Ignore location errors for now.
      }
    };
    void resolveLocation();
    return () => {
      cancelled = true;
    };
  }, [isNavigationOpen, navigationStart, navigationOrigin]);

  useEffect(() => {
    if (!isNavigationOpen) return;
    if (!navigationOrigin || !navigationDestinationCoord) {
      setIsRouteLoading(false);
      return;
    }
    if (sameOriginDestination || missingCoordinates) {
      setIsRouteLoading(false);
      return;
    }

    const key = getDirectionsKey();
    if (!key) {
      setIsRouteLoading(false);
      return;
    }

    let cancelled = false;

    const fetchDirections = async (mode: 'driving' | 'walking'): Promise<ModeRoute | null> => {
      const origin = `${navigationOrigin.latitude},${navigationOrigin.longitude}`;
      const destination = `${navigationDestinationCoord.latitude},${navigationDestinationCoord.longitude}`;
      const trafficParam = mode === 'driving' ? '&departure_time=now' : '';
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${mode}${trafficParam}&key=${key}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status !== 'OK' || !data.routes?.length) return null;
      const route = data.routes[0];
      const leg = route.legs?.[0];
      if (!leg) return null;

      const polyline: LatLng[] = route.overview_polyline?.points
        ? decodePolyline(route.overview_polyline.points)
        : [];

      // Prefer duration_in_traffic for driving (requires departure_time=now)
      const duration = leg.duration_in_traffic ?? leg.duration;

      const steps: NavigationStep[] = (leg.steps ?? []).map(
        (s: {
          html_instructions?: string;
          distance?: { text?: string };
          duration?: { text?: string };
          maneuver?: string;
          start_location?: { lat?: number; lng?: number };
          end_location?: { lat?: number; lng?: number };
        }) => {
          let focusCoordinate: LatLng | undefined;
          if (s.end_location?.lat != null && s.end_location?.lng != null) {
            focusCoordinate = {
              latitude: s.end_location.lat,
              longitude: s.end_location.lng,
            };
          } else if (s.start_location?.lat != null && s.start_location?.lng != null) {
            focusCoordinate = {
              latitude: s.start_location.lat,
              longitude: s.start_location.lng,
            };
          }

          return {
            instruction: (s.html_instructions ?? '').replaceAll(/<[^>]*>/g, ''),
            distanceText: s.distance?.text ?? '',
            durationText: s.duration?.text ?? '',
            maneuver: s.maneuver,
            focusCoordinate,
          };
        },
      );

      return {
        durationText: duration?.text ?? '',
        durationSec: duration?.value ?? 0,
        distanceText: leg.distance?.text ?? '',
        viaText: route.summary || '',
        polyline,
        steps,
      };
    };

    const load = async () => {
      setIsRouteLoading(true);
      setModeDurations({});
      try {
        const [driving, walking] = await Promise.all([
          fetchDirections('driving'),
          fetchDirections('walking'),
        ]);
        if (cancelled) return;

        setAllModeRoutes({ driving, walking });

        // Show polyline + steps for the currently selected mode
        const active = selectedTransportMode === 'driving' ? driving : walking;
        if (active?.polyline && active.polyline.length > 0) {
          setRoutePolyline(active.polyline);
          setRouteRegion(boundsToRegion(calculateBounds(active.polyline)));
        }
        setNavigationSteps(active?.steps ?? []);

        const primary = driving ?? walking;
        if (primary) {
          const arrival = new Date(Date.now() + primary.durationSec * 1000);
          const arrivalText = arrival.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          });
          setRouteSummary({
            arrivalText,
            distanceText: primary.distanceText,
            durationText: primary.durationText,
            viaText: primary.viaText || 'Suggested route',
          });
        }
        setModeDurations({
          driving: driving?.durationText,
          walking: walking?.durationText,
        });
      } finally {
        if (!cancelled) setIsRouteLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    isNavigationOpen,
    navigationOrigin,
    navigationDestinationCoord,
    sameOriginDestination,
    missingCoordinates,
  ]); // --- Shuttle route fetch ---
  // Runs whenever origin/destination change and it is a cross-campus route on a weekday.
  useEffect(() => {
    if (!isNavigationOpen) return;
    if (!navigationOrigin || !navigationDestinationCoord) return;
    if (sameOriginDestination || missingCoordinates) return;
    const crossCampus = isCrossCampusRoute(navigationOrigin, navigationDestinationCoord);
    setIsShuttleRoute(crossCampus); // Use real current date for weekend check
    const effectivelyWeekend = isWeekend();

    if (!crossCampus || effectivelyWeekend) {
      setShuttleInfo(null);
      setIsShuttleLoading(false);
      return;
    }

    const key = getDirectionsKey();
    let cancelled = false;
    setIsShuttleLoading(true);

    const fetchShuttleSegment = async (
      origin: LatLng,
      destination: LatLng,
      mode: 'walking' | 'driving' = 'walking',
    ): Promise<LatLng[]> => {
      if (!key) return [];
      const o = `${origin.latitude},${origin.longitude}`;
      const d = `${destination.latitude},${destination.longitude}`;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${o}&destination=${d}&mode=${mode}&key=${key}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== 'OK' || !data.routes?.length) return [];
        const points = data.routes[0].overview_polyline?.points;
        return points ? decodePolyline(points) : [];
      } catch {
        return [];
      }
    };
    const loadShuttle = async () => {
      try {
        const departureCampus = getDepartureCampus(navigationOrigin);
        const arrivalHub = departureCampus === 'SGW' ? SHUTTLE_HUB_LOY : SHUTTLE_HUB_SGW;
        const departureHub = departureCampus === 'SGW' ? SHUTTLE_HUB_SGW : SHUTTLE_HUB_LOY;

        // Walking time to the departure hub (to compute offMinutes)
        let offMinutes = 10; // sensible default
        if (key) {
          const o = `${navigationOrigin.latitude},${navigationOrigin.longitude}`;
          const d = `${departureHub.latitude},${departureHub.longitude}`;
          const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${o}&destination=${d}&mode=walking&key=${key}`;
          try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'OK' && data.routes?.[0]?.legs?.[0]?.duration?.value) {
              offMinutes = Math.round(data.routes[0].legs[0].duration.value / 60);
            }
          } catch {
            /* use default */
          }
        }

        const [shuttleResp, walkToHub, shuttleSegment, walkFromHub] = await Promise.all([
          getNextShuttles(departureCampus, offMinutes),
          fetchShuttleSegment(navigationOrigin, departureHub),
          fetchShuttleSegment(departureHub, arrivalHub, 'driving'),
          fetchShuttleSegment(arrivalHub, navigationDestinationCoord),
        ]);

        if (cancelled) return;

        setShuttleInfo({
          departureTimes: shuttleResp.threeNextShuttles,
          tripDurationMin: shuttleResp.tripDuration,
          departureCampus,
          walkToHubPolyline: walkToHub,
          shuttleSegmentPolyline: shuttleSegment,
          walkFromHubPolyline: walkFromHub,
        });
      } catch {
        if (!cancelled) setShuttleInfo(null);
      } finally {
        if (!cancelled) setIsShuttleLoading(false);
      }
    };

    void loadShuttle();
    return () => {
      cancelled = true;
    };
  }, [
    isNavigationOpen,
    navigationOrigin,
    navigationDestinationCoord,
    sameOriginDestination,
    missingCoordinates,
  ]); // When the user switches transport mode, update the displayed polyline
  useEffect(() => {
    if (!isNavigationOpen) {
      setRoutePolyline([]);
      setRouteRegion(null);
      return;
    } // Shuttle mode: show walk-to-hub + walk-from-hub polylines; the shuttle
    // segment itself is rendered separately as a red solid line on the map.
    if (selectedTransportMode === 'shuttle') {
      if (shuttleInfo) {
        const allPoints = [
          ...shuttleInfo.walkToHubPolyline,
          ...shuttleInfo.shuttleSegmentPolyline,
          ...shuttleInfo.walkFromHubPolyline,
        ];
        if (allPoints.length > 0) {
          setRouteRegion(boundsToRegion(calculateBounds(allPoints)));
        }
        setRoutePolyline([]); // individual segments handled by the map
      }
      setNavigationSteps([
        {
          instruction: 'Walk to the Shuttle Hub',
          distanceText: '',
          durationText: '',
        },
        {
          instruction: 'Take the Shuttle from Hall Building',
          distanceText: '',
          durationText: shuttleInfo ? `~${shuttleInfo.tripDurationMin} min ride` : '',
        },
        {
          instruction: 'Walk to your destination',
          distanceText: '',
          durationText: '',
        },
      ]);
      return;
    }

    const route =
      selectedTransportMode === 'driving' ? allModeRoutes.driving : allModeRoutes.walking;
    if (route?.polyline && route.polyline.length > 0) {
      setRoutePolyline(route.polyline);
      setRouteRegion(boundsToRegion(calculateBounds(route.polyline)));

      // Update trip summary + steps to match the selected mode
      const arrival = new Date(Date.now() + route.durationSec * 1000);
      const arrivalText = arrival.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
      setRouteSummary({
        arrivalText,
        distanceText: route.distanceText,
        durationText: route.durationText,
        viaText: route.viaText || 'Suggested route',
      });
      setNavigationSteps(route.steps);
    } else if (allModeRoutes.driving || allModeRoutes.walking) {
      // Only clear when we genuinely have route data but the selected
      // mode is unavailable.  When allModeRoutes is empty (a new fetch
      // is in-flight after an endpoint change) we keep the previous
      // polyline visible as a placeholder.
      setRoutePolyline([]);
      setRouteRegion(null);
      setNavigationSteps([]);
    }
  }, [selectedTransportMode, allModeRoutes, isNavigationOpen]);

  /** Clear stale trip text and invalidate cached routes so the next fetch
   *  overwrites everything.  We set isRouteLoading immediately so the UI
   *  shows "Loading route..." instead of "Select start and destination".
   *  Old polyline, region, steps and modeDurations stay visible as
   *  placeholders while the new route loads. */
  const resetRouteState = useCallback(() => {
    setRouteSummary(null);
    setAllModeRoutes({});
    setIsRouteLoading(true);
    setShuttleInfo(null);
    setIsShuttleLoading(false);
    setIsShuttleRoute(false);
  }, []);

  const clearTapMarker = useCallback(() => {
    setTapMarkerCoordinate(null);
  }, []);

  const openNavigationForBuilding = useCallback(
    (selectedBuilding: Building | null, remoteBuilding: RemoteBuilding) => {
      const destinationName = remoteBuilding?.name ?? selectedBuilding?.name ?? 'Destination';
      const destinationCode = remoteBuilding?.code ?? selectedBuilding?.code ?? null;
      setIsDestinationLocked(false);
      setNavigationDestination(formatBuildingLabel(destinationName, destinationCode));
      setActiveMode('driving');
      if (selectedBuilding) {
        const destCentroid = polygonCentroid(selectedBuilding.polygon);
        setNavigationDestinationCoord(destCentroid);
        setTapMarkerCoordinate(destCentroid);
      }
      resetRouteState();
      setIsNavigationOpen(true);
    },
    [formatBuildingLabel, resetRouteState],
  );

  const openNavigationForResolvedDestination = useCallback(
    (destinationBuilding: Building) => {
      const destinationLabel = formatBuildingLabel(
        destinationBuilding.name,
        destinationBuilding.code,
      );
      const destCentroid = polygonCentroid(destinationBuilding.polygon);
      setNavigationStart('Your location');
      setNavigationOrigin(null);
      setNavigationDestination(destinationLabel);
      setNavigationDestinationCoord(destCentroid);
      setTapMarkerCoordinate(destCentroid);
      setNavigationActiveFieldState(null);
      setActiveMode('driving');
      setIsDestinationLocked(true);
      resetRouteState();
      setIsNavigationOpen(true);
    },
    [formatBuildingLabel, resetRouteState],
  );

  const handleMapBuildingPress = useCallback(
    (buildingId: string) => {
      const building = buildings.find((b) => b.id === buildingId);
      if (!building) return;
      const centroid = polygonCentroid(building.polygon);
      if (!isNavigationOpen) {
        setTapMarkerCoordinate(centroid);
        onSelectBuilding(buildingId);
        return;
      }
      const label = formatBuildingLabel(building.name, building.code);
      if (navigationActiveField === 'start') {
        setNavigationStart(label);
        setNavigationOrigin(centroid);
        resetRouteState();
        return;
      }
      if (navigationActiveField === 'destination') {
        if (isDestinationLocked) return;
        setIsDestinationLocked(false);
        setNavigationDestination(label);
        setNavigationDestinationCoord(centroid);
        setTapMarkerCoordinate(centroid);
        resetRouteState();
        return;
      }
      // Default: if destination is already set, assign start; otherwise assign destination
      if (navigationDestination.trim() === '' && !isDestinationLocked) {
        setIsDestinationLocked(false);
        setNavigationDestination(label);
        setNavigationDestinationCoord(centroid);
        setTapMarkerCoordinate(centroid);
      } else {
        setNavigationStart(label);
        setNavigationOrigin(centroid);
      }
      resetRouteState();
    },
    [
      buildings,
      formatBuildingLabel,
      isNavigationOpen,
      isDestinationLocked,
      navigationActiveField,
      navigationDestination,
      onSelectBuilding,
      resetRouteState,
    ],
  );

  const handleMapCoordinatePress = useCallback(
    (coordinate: LatLng) => {
      const building = findBuildingAtOrNearCoordinate(
        coordinate,
        buildings,
        MAX_TAP_DISTANCE_METERS,
      );
      if (building) {
        handleMapBuildingPress(building.id);
      } else {
        setTapMarkerCoordinate(null);
        onBuildingNotFound?.();
      }
    },
    [buildings, handleMapBuildingPress, onBuildingNotFound],
  );

  const handleSearchSelect = useCallback(
    (field: 'start' | 'destination', name: string, code: string | null) => {
      if (field === 'destination' && isDestinationLocked) return;
      const label = formatBuildingLabel(name, code);
      // Search across ALL campus buildings so cross-campus selections
      // always resolve coordinates correctly.
      const building = allBuildings.find((b) => {
        if (code && b.code?.toUpperCase() === code.toUpperCase()) return true;
        return normalizeLabel(b.name).includes(normalizeLabel(name));
      });

      if (field === 'start') {
        setNavigationStart(label);
        if (name === 'Your location') {
          setNavigationOrigin(null);
        } else if (building) {
          setNavigationOrigin(polygonCentroid(building.polygon));
        }
      } else {
        setIsDestinationLocked(false);
        setNavigationDestination(label);
        if (building) {
          const destCentroid = polygonCentroid(building.polygon);
          setNavigationDestinationCoord(destCentroid);
          setTapMarkerCoordinate(destCentroid);
        }
      }
      resetRouteState();
    },
    [allBuildings, formatBuildingLabel, isDestinationLocked, resetRouteState],
  );

  const setStartToCurrentLocation = useCallback(
    (coordinate: LatLng) => {
      setNavigationStart('Your location');
      setNavigationOrigin(coordinate);
      resetRouteState();
    },
    [resetRouteState],
  );

  const setStartToCurrentLocationBuilding = useCallback(
    (name: string, code: string | null, coordinate: LatLng) => {
      const label = formatBuildingLabel(name, code);
      setNavigationStart(`Current location - ${label}`);
      setNavigationOrigin(coordinate);
      resetRouteState();
    },
    [formatBuildingLabel, resetRouteState],
  );

  const closeNavigation = useCallback(() => {
    setIsNavigationOpen(false);
    setNavigationActiveFieldState(null);
    setTapMarkerCoordinate(null);
    setRouteSummary(null);
    setAllModeRoutes({});
    setModeDurations({});
    setIsRouteLoading(false);
    setRoutePolyline([]);
    setRouteRegion(null);
    setNavigationSteps([]);
    setShuttleInfo(null);
    setIsShuttleLoading(false);
    setIsShuttleRoute(false);
    setIsDestinationLocked(false);
  }, []);
  return {
    isNavigationOpen,
    navigationStart,
    navigationDestination,
    routeSummary,
    activeMode,
    modeDurations,
    isRouteLoading,
    directionsError,
    isGetDirectionsDisabled,
    setNavigationActiveField,
    setActiveMode,
    openNavigationForBuilding,
    openNavigationForResolvedDestination,
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
    isDestinationLocked,
    // Shuttle
    isShuttleRoute,
    isShuttleLoading,
    shuttleInfo,
    isWeekend: isWeekend(),
    routeSegments: shuttleInfo
      ? [
          { kind: 'walking' as const, polyline: shuttleInfo.walkToHubPolyline },
          { kind: 'shuttle' as const, polyline: shuttleInfo.shuttleSegmentPolyline },
          { kind: 'walking' as const, polyline: shuttleInfo.walkFromHubPolyline },
        ]
      : [],
  };
}
