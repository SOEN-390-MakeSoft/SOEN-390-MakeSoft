import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { BUILDING_POLYGONS } from '../data/buildingPolygons';
import { LOYOLA_BUILDING_POLYGONS } from '../data/buildingPolygonsLoyola';
import { getNextShuttles } from '../services/api';
import { getBuildingMeta } from '../services/indoor';
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function midpointOrFallback(polyline: LatLng[], fallback: LatLng): LatLng {
  if (polyline.length === 0) return fallback;
  return polyline[Math.floor(polyline.length / 2)];
}

function minutesBetween(startMs: number, endMs: number): number {
  if (endMs <= startMs) return 0;
  return Math.round((endMs - startMs) / 60_000);
}

function formatHoursMinutes(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours} h ${minutes} min`;
  if (hours > 0) return `${hours} h`;
  return `${minutes} min`;
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
  focusRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
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

/** Returns true if date is a weekend (Saturday or Sunday). */
function isWeekend(referenceDate: Date = new Date()): boolean {
  const day = referenceDate.getDay();
  return day === 0 || day === 6;
}

function toLocalDateTimeParam(date: Date): string {
  const pad2 = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
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
  /** Estimated walk duration to the departure hub (minutes). */
  walkToHubDurationMin?: number;
  /** Estimated walk duration from arrival hub to destination (minutes). */
  walkFromHubDurationMin?: number;
  /** Coordinate of the departure shuttle hub. */
  departureHubCoordinate?: LatLng;
  /** Coordinate of the destination shuttle hub. */
  arrivalHubCoordinate?: LatLng;
  /** Waiting time at the departure hub before shuttle departure (minutes). */
  waitDurationMin?: number | null;
  /** Whether shuttle directions should be shown (false when wait is too long). */
  hasDirections?: boolean;
};

/** Build the three shuttle leg steps when directions are allowed. */
function buildShuttleNavigationSteps(
  shuttleInfo: ShuttleInfo,
  ctx: {
    directionsAllowed: boolean;
    departureHubLabel: string;
    arrivalHubLabel: string;
    walkToHubDurationText: string;
    walkToHubArrivalMs: number;
    shuttleArrivalMs: number;
    finalArrivalMs: number;
    departureHub: LatLng | undefined;
    arrivalHub: LatLng | undefined;
    destinationFocus: LatLng | null;
    walkFromHubMin: number;
  },
): NavigationStep[] {
  if (!ctx.directionsAllowed) return [];
  return [
    {
      instruction: `Walk to ${ctx.departureHubLabel}`,
      distanceText: `Arrive at ${formatTime(new Date(ctx.walkToHubArrivalMs))}`,
      durationText: ctx.walkToHubDurationText,
      focusCoordinate: ctx.departureHub
        ? midpointOrFallback(shuttleInfo.walkToHubPolyline, ctx.departureHub)
        : undefined,
    },
    {
      instruction: `Take shuttle to ${ctx.arrivalHubLabel}`,
      distanceText: `Arrive at ${formatTime(new Date(ctx.shuttleArrivalMs))}`,
      durationText: `~${shuttleInfo.tripDurationMin} min ride`,
      focusCoordinate: ctx.arrivalHub
        ? midpointOrFallback(shuttleInfo.shuttleSegmentPolyline, ctx.arrivalHub)
        : undefined,
      focusRegion:
        shuttleInfo.shuttleSegmentPolyline.length > 0
          ? boundsToRegion(calculateBounds(shuttleInfo.shuttleSegmentPolyline))
          : undefined,
    },
    {
      instruction: 'Walk to your destination',
      distanceText: `Arrive at ${formatTime(new Date(ctx.finalArrivalMs))}`,
      durationText: ctx.walkFromHubMin > 0 ? `~${ctx.walkFromHubMin} min walk` : '',
      focusCoordinate: ctx.destinationFocus
        ? midpointOrFallback(shuttleInfo.walkFromHubPolyline, ctx.destinationFocus)
        : undefined,
    },
  ];
}

/** Pure helper: compute route region and navigation steps for shuttle mode. */
function computeShuttleDisplayState(
  shuttleInfo: ShuttleInfo,
  baseNowMs: number,
  destinationCoord: LatLng | null,
): { routeRegion: MapRegion | null; navigationSteps: NavigationStep[] } {
  const allPoints = [
    ...shuttleInfo.walkToHubPolyline,
    ...shuttleInfo.shuttleSegmentPolyline,
    ...shuttleInfo.walkFromHubPolyline,
  ];
  const routeRegion = allPoints.length > 0 ? boundsToRegion(calculateBounds(allPoints)) : null;

  const walkToHubMin = shuttleInfo.walkToHubDurationMin ?? 0;
  const walkFromHubMin = shuttleInfo.walkFromHubDurationMin ?? 0;
  const walkToHubArrivalMs = baseNowMs + walkToHubMin * 60_000;
  const firstDepartureIso = shuttleInfo.departureTimes.find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  const parsedDepartureMs = firstDepartureIso ? new Date(firstDepartureIso).getTime() : Number.NaN;
  const hasDeparture = Number.isFinite(parsedDepartureMs);
  const waitDurationMin =
    hasDeparture && parsedDepartureMs > walkToHubArrivalMs
      ? minutesBetween(walkToHubArrivalMs, parsedDepartureMs)
      : 0;
  const directionsAllowed =
    shuttleInfo.hasDirections !== false && waitDurationMin <= 120 && hasDeparture;

  const shuttleDepartureMs = hasDeparture
    ? Math.max(parsedDepartureMs, walkToHubArrivalMs)
    : walkToHubArrivalMs;
  const shuttleArrivalMs = shuttleDepartureMs + shuttleInfo.tripDurationMin * 60_000;
  const finalArrivalMs = shuttleArrivalMs + walkFromHubMin * 60_000;

  const departureHub = shuttleInfo.departureHubCoordinate;
  const arrivalHub = shuttleInfo.arrivalHubCoordinate;
  const destinationFocus = destinationCoord ?? arrivalHub ?? departureHub ?? null;
  const departureHubLabel =
    shuttleInfo.departureCampus === 'SGW' ? 'Hall Building (SGW)' : 'Vanier Library (Loyola)';
  const arrivalHubLabel =
    shuttleInfo.departureCampus === 'SGW' ? 'Vanier Library (Loyola)' : 'Hall Building (SGW)';
  const walkToHubDurationText = [
    walkToHubMin > 0 ? `~${walkToHubMin} min walk` : '',
    directionsAllowed && waitDurationMin > 0 ? `wait ${formatHoursMinutes(waitDurationMin)}` : '',
  ]
    .filter((text) => text.length > 0)
    .join(' + ');

  const navigationSteps = buildShuttleNavigationSteps(shuttleInfo, {
    directionsAllowed,
    departureHubLabel,
    arrivalHubLabel,
    walkToHubDurationText,
    walkToHubArrivalMs,
    shuttleArrivalMs,
    finalArrivalMs,
    departureHub,
    arrivalHub,
    destinationFocus,
    walkFromHubMin,
  });

  return { routeRegion, navigationSteps };
}

/** Pure helper: compute route summary and steps for driving/walking mode. */
function computeModeRouteDisplayState(
  route: ModeRoute,
  baseNowMs: number,
): { routeSummary: RouteSummary; navigationSteps: NavigationStep[] } {
  const arrival = new Date(baseNowMs + route.durationSec * 1000);
  const arrivalText = arrival.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  return {
    routeSummary: {
      arrivalText,
      distanceText: route.distanceText,
      durationText: route.durationText,
      viaText: route.viaText || 'Suggested route',
    },
    navigationSteps: route.steps,
  };
}

/** Returns shuttle final arrival time in ms, or null if not computable. */
function getShuttleFinalArrivalMs(shuttleInfo: ShuttleInfo | null, nowMs: number): number | null {
  if (!shuttleInfo) return null;
  const firstDepartureIso = shuttleInfo.departureTimes.find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  if (!firstDepartureIso) return null;
  const departureMs = new Date(firstDepartureIso).getTime();
  if (!Number.isFinite(departureMs)) return null;
  const walkToHubMin = shuttleInfo.walkToHubDurationMin ?? 0;
  const walkFromHubMin = shuttleInfo.walkFromHubDurationMin ?? 0;
  const walkToHubArrivalMs = nowMs + walkToHubMin * 60_000;
  const shuttleDepartureMs = Math.max(departureMs, walkToHubArrivalMs);
  const shuttleArrivalMs = shuttleDepartureMs + shuttleInfo.tripDurationMin * 60_000;
  return shuttleArrivalMs + walkFromHubMin * 60_000;
}

/** Pure helper: which transport modes would arrive after the deadline. */
function computeLateTransportModes(
  arriveByMs: number,
  nowMs: number,
  allModeRoutes: AllModeRoutes,
  shuttleInfo: ShuttleInfo | null,
): TransportMode[] {
  const late: TransportMode[] = [];
  if (allModeRoutes.driving?.durationSec != null) {
    const drivingArrivalMs = nowMs + allModeRoutes.driving.durationSec * 1000;
    if (drivingArrivalMs > arriveByMs) late.push('driving');
  }
  if (allModeRoutes.walking?.durationSec != null) {
    const walkingArrivalMs = nowMs + allModeRoutes.walking.durationSec * 1000;
    if (walkingArrivalMs > arriveByMs) late.push('walking');
  }
  const shuttleFinalMs = getShuttleFinalArrivalMs(shuttleInfo, nowMs);
  if (shuttleFinalMs != null && shuttleFinalMs > arriveByMs) {
    late.push('shuttle');
  }
  return late;
}

interface UseNavigationBetweenBuildingsParams {
  buildings: Building[];
  onSelectBuilding: (buildingId: string) => void;
  /** Called when user taps the map and the tap is far from any campus building */
  onBuildingNotFound?: () => void;
  /** Optional simulated current date/time used for route timing calculations. */
  currentTime?: Date | null;
  /** Optional class end deadline; modes arriving after this time are flagged as late. */
  arriveBy?: Date | null;
}

export function useNavigationBetweenBuildings({
  buildings,
  onSelectBuilding,
  onBuildingNotFound,
  currentTime = null,
  arriveBy = null,
}: UseNavigationBetweenBuildingsParams) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isIndoorOnlyRoute, setIsIndoorOnlyRoute] = useState(false);
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
    const baseNowMs = currentTime?.getTime() ?? Date.now();

    const fetchDirections = async (mode: 'driving' | 'walking'): Promise<ModeRoute | null> => {
      const origin = `${navigationOrigin.latitude},${navigationOrigin.longitude}`;
      const destination = `${navigationDestinationCoord.latitude},${navigationDestinationCoord.longitude}`;
      const trafficParam =
        mode === 'driving'
          ? currentTime
            ? `&departure_time=${Math.floor(baseNowMs / 1000)}`
            : '&departure_time=now'
          : '';
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

      // Prefer duration_in_traffic for driving (requires departure_time)
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
          const arrival = new Date(baseNowMs + primary.durationSec * 1000);
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
    currentTime,
  ]); // --- Shuttle route fetch ---
  // Runs whenever origin/destination change and it is a cross-campus route on a weekday.
  useEffect(() => {
    if (!isNavigationOpen) return;
    if (!navigationOrigin || !navigationDestinationCoord) return;
    if (sameOriginDestination || missingCoordinates) return;
    const crossCampus = isCrossCampusRoute(navigationOrigin, navigationDestinationCoord);
    setIsShuttleRoute(crossCampus);
    const effectivelyWeekend = isWeekend(currentTime ?? undefined);

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
    ): Promise<{ polyline: LatLng[]; durationSec: number }> => {
      if (!key) return { polyline: [], durationSec: 0 };
      const o = `${origin.latitude},${origin.longitude}`;
      const d = `${destination.latitude},${destination.longitude}`;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${o}&destination=${d}&mode=${mode}&key=${key}`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== 'OK' || !data.routes?.length) return { polyline: [], durationSec: 0 };
        const leg = data.routes[0].legs?.[0];
        const points = data.routes[0].overview_polyline?.points;
        return {
          polyline: points ? decodePolyline(points) : [],
          durationSec: leg?.duration?.value ?? 0,
        };
      } catch {
        return { polyline: [], durationSec: 0 };
      }
    };
    const loadShuttle = async () => {
      try {
        const departureCampus = getDepartureCampus(navigationOrigin);
        const arrivalHub = departureCampus === 'SGW' ? SHUTTLE_HUB_LOY : SHUTTLE_HUB_SGW;
        const departureHub = departureCampus === 'SGW' ? SHUTTLE_HUB_SGW : SHUTTLE_HUB_LOY;
        const shuttleDateTime = currentTime ? toLocalDateTimeParam(currentTime) : undefined;
        const requestNowMs = currentTime?.getTime() ?? Date.now();

        const walkToHub = await fetchShuttleSegment(navigationOrigin, departureHub, 'walking');
        const offMinutes = walkToHub.durationSec > 0 ? Math.ceil(walkToHub.durationSec / 60) : 10;

        const [shuttleResp, shuttleSegment, walkFromHub] = await Promise.all([
          getNextShuttles(departureCampus, offMinutes, shuttleDateTime),
          fetchShuttleSegment(departureHub, arrivalHub, 'driving'),
          fetchShuttleSegment(arrivalHub, navigationDestinationCoord),
        ]);

        if (cancelled) return;

        const walkToHubArrivalMs = requestNowMs + walkToHub.durationSec * 1000;
        const firstCatchableDeparture =
          shuttleResp.threeNextShuttles.find((departure) => {
            if (!departure) return false;
            const departureMs = new Date(departure).getTime();
            return Number.isFinite(departureMs) && departureMs >= walkToHubArrivalMs;
          }) ?? null;
        const firstCatchableDepartureMs = firstCatchableDeparture
          ? new Date(firstCatchableDeparture).getTime()
          : Number.NaN;
        const waitDurationMin = Number.isFinite(firstCatchableDepartureMs)
          ? minutesBetween(walkToHubArrivalMs, firstCatchableDepartureMs)
          : null;
        const hasDirections =
          waitDurationMin !== null && waitDurationMin >= 0 && waitDurationMin <= 120;

        setShuttleInfo({
          departureTimes: [firstCatchableDeparture],
          tripDurationMin: shuttleResp.tripDuration,
          departureCampus,
          walkToHubPolyline: walkToHub.polyline,
          shuttleSegmentPolyline: shuttleSegment.polyline,
          walkFromHubPolyline: walkFromHub.polyline,
          walkToHubDurationMin: Math.max(0, Math.round(walkToHub.durationSec / 60)),
          walkFromHubDurationMin: Math.max(0, Math.round(walkFromHub.durationSec / 60)),
          departureHubCoordinate: departureHub,
          arrivalHubCoordinate: arrivalHub,
          waitDurationMin,
          hasDirections,
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
    currentTime,
  ]); // When the user switches transport mode, update the displayed polyline
  useEffect(() => {
    const baseNowMs = currentTime?.getTime() ?? Date.now();
    if (!isNavigationOpen) {
      setRoutePolyline([]);
      setRouteRegion(null);
      return;
    }
    if (selectedTransportMode === 'shuttle') {
      if (shuttleInfo) {
        const { routeRegion: shuttleRegion, navigationSteps: shuttleSteps } =
          computeShuttleDisplayState(shuttleInfo, baseNowMs, navigationDestinationCoord);
        if (shuttleRegion) setRouteRegion(shuttleRegion);
        setRoutePolyline([]);
        setNavigationSteps(shuttleSteps);
      } else {
        setNavigationSteps([]);
      }
      return;
    }
    const route =
      selectedTransportMode === 'driving' ? allModeRoutes.driving : allModeRoutes.walking;
    if (route?.polyline && route.polyline.length > 0) {
      const { routeSummary: summary, navigationSteps: steps } = computeModeRouteDisplayState(
        route,
        baseNowMs,
      );
      setRoutePolyline(route.polyline);
      setRouteRegion(boundsToRegion(calculateBounds(route.polyline)));
      setRouteSummary(summary);
      setNavigationSteps(steps);
    } else if (allModeRoutes.driving || allModeRoutes.walking) {
      setRoutePolyline([]);
      setRouteRegion(null);
      setNavigationSteps([]);
    }
  }, [
    selectedTransportMode,
    allModeRoutes,
    isNavigationOpen,
    currentTime,
    shuttleInfo,
    navigationDestinationCoord,
  ]);

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

  /**
   * Re-fetch directions from a new origin (called when the user drifts off route).
   * Updates the origin coordinate without touching the displayed start label so
   * the navigation panel looks unchanged.
   */
  const rerouteFromLocation = useCallback(
    (newOrigin: LatLng) => {
      setNavigationOrigin(newOrigin);
      resetRouteState();
    },
    [resetRouteState],
  );

  const clearTapMarker = useCallback(() => {
    setTapMarkerCoordinate(null);
  }, []);

  const openNavigationForBuilding = useCallback(
    (selectedBuilding: Building | null, remoteBuilding: RemoteBuilding) => {
      const destinationName = remoteBuilding?.name ?? selectedBuilding?.name ?? 'Destination';
      const destinationCode = remoteBuilding?.code ?? selectedBuilding?.code ?? null;
      setIsDestinationLocked(false);
      setIsIndoorOnlyRoute(false);
      setNavigationStart('Your location');
      setNavigationOrigin(null);
      setNavigationDestination(formatBuildingLabel(destinationName, destinationCode));
      setActiveMode('driving');
      if (selectedBuilding) {
        const meta = selectedBuilding.code ? getBuildingMeta(selectedBuilding.code) : null;
        const destCentroid = meta?.entrances?.[0] ?? polygonCentroid(selectedBuilding.polygon);
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
      const meta = destinationBuilding.code ? getBuildingMeta(destinationBuilding.code) : null;
      const destCentroid = meta?.entrances?.[0] ?? polygonCentroid(destinationBuilding.polygon);
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

  const openIndoorOnlyNavigation = useCallback(
    (destinationLabel: string, startLabel?: string) => {
      setIsIndoorOnlyRoute(true);
      setNavigationDestination(destinationLabel);
      setNavigationStart(startLabel ?? 'Building entrance');
      setNavigationOrigin(null);
      setNavigationDestinationCoord(null);
      setNavigationActiveFieldState(null);
      setIsDestinationLocked(false);
      setTapMarkerCoordinate(null);
      resetRouteState();
      setIsNavigationOpen(true);
    },
    [resetRouteState],
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
      const resolvedCode = code ?? extractCodeFromName(name);
      const label = formatBuildingLabel(name, resolvedCode);
      const normalizedName = normalizeLabel(name);
      // Search across ALL campus buildings so cross-campus selections
      // always resolve coordinates correctly.
      const building = allBuildings.find((b) => {
        if (resolvedCode && b.code?.toUpperCase() === resolvedCode.toUpperCase()) return true;
        const normalizedBuilding = normalizeLabel(b.name);
        return (
          normalizedBuilding.includes(normalizedName) || normalizedName.includes(normalizedBuilding)
        );
      });

      if (field === 'start') {
        setNavigationStart(label);
        if (name === 'Your location') {
          setNavigationOrigin(null);
        } else if (building) {
          const meta = building.code ? getBuildingMeta(building.code) : null;
          setNavigationOrigin(meta?.entrances?.[0] ?? polygonCentroid(building.polygon));
        }
      } else {
        setIsDestinationLocked(false);
        setNavigationDestination(label);
        if (building) {
          const meta = building.code ? getBuildingMeta(building.code) : null;
          const destCentroid = meta?.entrances?.[0] ?? polygonCentroid(building.polygon);
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
    setIsIndoorOnlyRoute(false);
    setNavigationStart('Your location');
    setNavigationOrigin(null);
    setNavigationDestination('');
    setNavigationDestinationCoord(null);
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

  const lateTransportModes = useMemo<TransportMode[]>(() => {
    if (!arriveBy) return [];
    const arriveByMs = arriveBy.getTime();
    if (!Number.isFinite(arriveByMs)) return [];
    const nowMs = currentTime?.getTime() ?? Date.now();
    return computeLateTransportModes(arriveByMs, nowMs, allModeRoutes, shuttleInfo);
  }, [arriveBy, currentTime, allModeRoutes, shuttleInfo]);

  return {
    isNavigationOpen,
    navigationStart,
    navigationDestination,
    navigationOrigin,
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
    openIndoorOnlyNavigation,
    isIndoorOnlyRoute,
    handleMapBuildingPress,
    handleMapCoordinatePress,
    handleSearchSelect,
    setStartToCurrentLocation,
    setStartToCurrentLocationBuilding,
    closeNavigation,
    clearTapMarker,
    rerouteFromLocation,
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
    isWeekend: isWeekend(currentTime ?? undefined),
    lateTransportModes,
    routeSegments:
      shuttleInfo && shuttleInfo.hasDirections !== false
        ? [
            { kind: 'walking' as const, polyline: shuttleInfo.walkToHubPolyline },
            { kind: 'shuttle' as const, polyline: shuttleInfo.shuttleSegmentPolyline },
            { kind: 'walking' as const, polyline: shuttleInfo.walkFromHubPolyline },
          ]
        : [],
  };
}
