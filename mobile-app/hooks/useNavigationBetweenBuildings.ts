import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { BUILDING_POLYGONS } from '../data/buildingPolygons';
import { LOYOLA_BUILDING_POLYGONS } from '../data/buildingPolygonsLoyola';
import { getBuildingMeta } from '../services/indoor';
import {
  coordsEqual,
  findBuildingAtOrNearCoordinate,
  polygonCentroid,
  type LatLng,
} from '../utils/mapUtils';
import { extractCodeFromName, normalizeLabel } from '../utils/stringUtils';
import { RoutePlanner } from '../services/navigation/RoutePlanner';
import { DrivingRouteStrategy } from '../services/navigation/strategies/DrivingRouteStrategy';
import { OutdoorWalkingRouteStrategy } from '../services/navigation/strategies/OutdoorWalkingRouteStrategy';
import { TunnelWalkingRouteStrategy } from '../services/navigation/strategies/TunnelWalkingRouteStrategy';
import { DefaultShuttleRouteStrategy } from '../services/navigation/strategies/ShuttleRouteStrategy';
import {
  calculateBounds,
  boundsToRegion,
  midpointOrFallback,
  minutesBetween,
} from '../services/navigation/routeUtils';
import type {
  Building,
  RouteSummary,
  RouteMode,
  ModeDurations,
  TransportMode,
  WalkingRouteVariant,
  NavigationStep,
  ModeRoute,
  WalkingModeRoutes,
  AllModeRoutes,
  WalkingRouteComparison,
  MapRegion,
  ShuttleInfo,
} from '../services/navigation/types';

export type {
  WalkingRouteVariant,
  NavigationStep,
  WalkingRouteComparison,
  ShuttleInfo,
} from '../services/navigation/types';

const MAX_TAP_DISTANCE_METERS = 0;

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatHoursMinutes(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours > 0 && minutes > 0) return `${hours} h ${minutes} min`;
  if (hours > 0) return `${hours} h`;
  return `${minutes} min`;
}

type RemoteBuilding = {
  name?: string | null;
  code?: string | null;
} | null;

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

/** Returns true if date is a weekend (Saturday or Sunday). */
function isWeekend(referenceDate: Date = new Date()): boolean {
  const day = referenceDate.getDay();
  return day === 0 || day === 6;
}

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

function getFastestWalkingRouteVariant(
  routes: WalkingModeRoutes | null | undefined,
): WalkingRouteVariant | null {
  const outdoor = routes?.outdoor;
  const tunnel = routes?.tunnel;
  if (outdoor && tunnel) {
    return tunnel.durationSec <= outdoor.durationSec ? 'tunnel' : 'outdoor';
  }
  if (tunnel) return 'tunnel';
  if (outdoor) return 'outdoor';
  return null;
}

function getWalkingRoute(
  routes: WalkingModeRoutes | null | undefined,
  preferredVariant: WalkingRouteVariant | null | undefined,
): ModeRoute | null | undefined {
  if (!routes) return null;
  if (preferredVariant === 'tunnel' && routes.tunnel) return routes.tunnel;
  if (preferredVariant === 'outdoor' && routes.outdoor) return routes.outdoor;

  const fastestVariant = getFastestWalkingRouteVariant(routes);
  if (fastestVariant === 'tunnel') return routes.tunnel;
  if (fastestVariant === 'outdoor') return routes.outdoor;
  return null;
}

function buildWalkingRouteComparison(
  originLabel: string,
  destinationLabel: string,
  routes: WalkingModeRoutes | null | undefined,
  activeVariant: WalkingRouteVariant,
): WalkingRouteComparison | null {
  const outdoor = routes?.outdoor;
  const tunnel = routes?.tunnel;
  if (!outdoor || !tunnel) return null;

  return {
    originLabel,
    destinationLabel,
    activeVariant,
    fastestVariant: getFastestWalkingRouteVariant(routes) ?? 'outdoor',
    outdoor: {
      durationText: outdoor.durationText,
      distanceText: outdoor.distanceText,
    },
    tunnel: {
      durationText: tunnel.durationText,
      distanceText: tunnel.distanceText,
    },
  };
}

function selectActiveModeRoute(
  selectedTransportMode: TransportMode,
  routes: AllModeRoutes,
  selectedWalkingRouteVariant: WalkingRouteVariant,
): { route: ModeRoute | null | undefined; shouldAutoSelectWalking: boolean } {
  const activeWalkingRoute = getWalkingRoute(routes.walking, selectedWalkingRouteVariant);
  const shouldAutoSelectWalking = selectedTransportMode === 'driving' && !!routes.walking?.tunnel;

  if (shouldAutoSelectWalking) {
    return { route: activeWalkingRoute, shouldAutoSelectWalking: true };
  }

  if (selectedTransportMode === 'driving') {
    return { route: routes.driving, shouldAutoSelectWalking: false };
  }

  return { route: activeWalkingRoute, shouldAutoSelectWalking: false };
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
  selectedWalkingRouteVariant: WalkingRouteVariant,
  shuttleInfo: ShuttleInfo | null,
): TransportMode[] {
  const late: TransportMode[] = [];
  if (allModeRoutes.driving?.durationSec != null) {
    const drivingArrivalMs = nowMs + allModeRoutes.driving.durationSec * 1000;
    if (drivingArrivalMs > arriveByMs) late.push('driving');
  }
  const activeWalkingRoute = getWalkingRoute(allModeRoutes.walking, selectedWalkingRouteVariant);
  if (activeWalkingRoute?.durationSec != null) {
    const walkingArrivalMs = nowMs + activeWalkingRoute.durationSec * 1000;
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
  const [selectedWalkingRouteVariant, setSelectedWalkingRouteVariant] =
    useState<WalkingRouteVariant>('outdoor');
  const [routePolyline, setRoutePolyline] = useState<LatLng[]>([]);
  const [routeRegion, setRouteRegion] = useState<MapRegion | null>(null);
  const [navigationSteps, setNavigationSteps] = useState<NavigationStep[]>([]);
  const selectedTransportModeRef = useRef<TransportMode>('driving');
  const routePlanner = useMemo(
    () =>
      new RoutePlanner([
        new DrivingRouteStrategy(),
        new OutdoorWalkingRouteStrategy(),
        new TunnelWalkingRouteStrategy(),
      ]),
    [],
  );
  const shuttleStrategy = useMemo(() => new DefaultShuttleRouteStrategy(), []);

  // --- Shuttle state ---
  const [isShuttleRoute, setIsShuttleRoute] = useState(false);
  const [shuttleInfo, setShuttleInfo] = useState<ShuttleInfo | null>(null);
  const [isShuttleLoading, setIsShuttleLoading] = useState(false);

  useEffect(() => {
    selectedTransportModeRef.current = selectedTransportMode;
  }, [selectedTransportMode]);

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

    let cancelled = false;
    const baseNowMs = currentTime?.getTime() ?? Date.now();
    const key = getDirectionsKey();

    const load = async () => {
      setIsRouteLoading(true);
      try {
        const plannedRoutes = await routePlanner.plan({
          origin: navigationOrigin,
          destination: navigationDestinationCoord,
          currentTime,
          buildings: allBuildings,
          googleMapsApiKey: key,
          fetchImpl: fetch,
        });

        const driving = plannedRoutes.driving;
        const outdoorWalking = plannedRoutes.outdoorWalking;
        const tunnelWalkingRoute = plannedRoutes.tunnelWalking;

        if (cancelled) return;

        const walkingRoutes: WalkingModeRoutes = {
          outdoor: outdoorWalking,
          tunnel: tunnelWalkingRoute,
        };
        const preferredWalkingVariant = plannedRoutes.preferredWalkingVariant;
        setSelectedWalkingRouteVariant(preferredWalkingVariant);
        setAllModeRoutes({ driving, walking: walkingRoutes });
        setModeDurations({
          driving: driving?.durationText,
          walking: getWalkingRoute(walkingRoutes, preferredWalkingVariant)?.durationText,
        });

        // Show polyline + steps for the currently selected mode
        const { route: active, shouldAutoSelectWalking } = selectActiveModeRoute(
          selectedTransportModeRef.current,
          { driving, walking: walkingRoutes },
          preferredWalkingVariant,
        );
        if (active?.polyline && active.polyline.length > 0) {
          setRoutePolyline(active.polyline);
          setRouteRegion(boundsToRegion(calculateBounds(active.polyline)));
        }
        setNavigationSteps(active?.steps ?? []);
        if (shouldAutoSelectWalking) {
          setSelectedTransportMode('walking');
        }

        const primary = shouldAutoSelectWalking
          ? getWalkingRoute(walkingRoutes, preferredWalkingVariant)
          : (driving ?? getWalkingRoute(walkingRoutes, preferredWalkingVariant));
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
    allBuildings,
    routePlanner,
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

    const loadShuttle = async () => {
      try {
        const nextShuttleInfo = await shuttleStrategy.execute({
          origin: navigationOrigin,
          destination: navigationDestinationCoord,
          currentTime,
          googleMapsApiKey: key,
          fetchImpl: fetch,
        });

        if (cancelled) return;

        setShuttleInfo(nextShuttleInfo);
      } catch (error) {
        console.error('Failed to load shuttle information', error);
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
    shuttleStrategy,
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
      selectedTransportMode === 'driving'
        ? allModeRoutes.driving
        : getWalkingRoute(allModeRoutes.walking, selectedWalkingRouteVariant);
    if (route?.polyline && route.polyline.length > 0) {
      const { routeSummary: summary, navigationSteps: steps } = computeModeRouteDisplayState(
        route,
        baseNowMs,
      );
      setRoutePolyline(route.polyline);
      setRouteRegion(boundsToRegion(calculateBounds(route.polyline)));
      setRouteSummary(summary);
      setNavigationSteps(steps);
    } else if (
      allModeRoutes.driving ||
      allModeRoutes.walking?.outdoor ||
      allModeRoutes.walking?.tunnel
    ) {
      setRoutePolyline([]);
      setRouteRegion(null);
      setNavigationSteps([]);
    }
  }, [
    selectedTransportMode,
    selectedWalkingRouteVariant,
    allModeRoutes,
    isNavigationOpen,
    currentTime,
    shuttleInfo,
    navigationDestinationCoord,
  ]);

  useEffect(() => {
    const activeWalkingRoute = getWalkingRoute(allModeRoutes.walking, selectedWalkingRouteVariant);
    if (!allModeRoutes.driving && !activeWalkingRoute) return;

    setModeDurations((current) => ({
      driving: allModeRoutes.driving?.durationText ?? current.driving,
      walking: activeWalkingRoute?.durationText ?? current.walking,
    }));
  }, [allModeRoutes, selectedWalkingRouteVariant]);

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
    setSelectedWalkingRouteVariant('outdoor');
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

  const openNavigationForCoordinate = useCallback(
    (label: string, coordinate: LatLng) => {
      setIsDestinationLocked(false);
      setIsIndoorOnlyRoute(false);
      setNavigationStart('Your location');
      setNavigationOrigin(null);
      setNavigationDestination(label);
      setNavigationDestinationCoord(coordinate);
      setTapMarkerCoordinate(coordinate);
      setActiveMode('driving');
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
    setSelectedWalkingRouteVariant('outdoor');
  }, []);

  const lateTransportModes = useMemo<TransportMode[]>(() => {
    if (!arriveBy) return [];
    const arriveByMs = arriveBy.getTime();
    if (!Number.isFinite(arriveByMs)) return [];
    const nowMs = currentTime?.getTime() ?? Date.now();
    return computeLateTransportModes(
      arriveByMs,
      nowMs,
      allModeRoutes,
      selectedWalkingRouteVariant,
      shuttleInfo,
    );
  }, [arriveBy, currentTime, allModeRoutes, selectedWalkingRouteVariant, shuttleInfo]);

  const walkingRouteComparison = useMemo(() => {
    const activeVariant =
      getWalkingRoute(allModeRoutes.walking, selectedWalkingRouteVariant) ===
      allModeRoutes.walking?.tunnel
        ? 'tunnel'
        : 'outdoor';
    return buildWalkingRouteComparison(
      navigationStart,
      navigationDestination,
      allModeRoutes.walking,
      activeVariant,
    );
  }, [allModeRoutes.walking, navigationDestination, navigationStart, selectedWalkingRouteVariant]);

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
    openNavigationForCoordinate,
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
    selectedWalkingRouteVariant,
    setSelectedWalkingRouteVariant,
    walkingRouteComparison,
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
