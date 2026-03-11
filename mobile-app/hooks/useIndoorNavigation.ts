/**
 * React hook that orchestrates the indoor navigation system.
 *
 * It bridges the pure-logic engine (services/indoor/) with the React UI layer.
 *
 * ## Responsibilities
 * - Detects when a navigation destination is an indoor room
 * - Loads the correct building data on demand
 * - Computes the indoor route (pathfinder)
 * - Exposes floor-level features for the map overlay
 * - Manages the active floor selector state
 *
 * ## Integration with outdoor navigation
 * The hook exposes `isIndoorActive` and `indoorRoute`. The parent MapScreen
 * can check these to decide whether to show the outdoor Google-directions
 * polyline or the indoor route overlay.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ImageRequireSource } from 'react-native';
import {
  detectIndoorDestination,
  findPath,
  getBuildingMeta,
  getFloorPlanImage,
  groupByLevel,
  hasIndoorMap,
  loadBuilding,
  resolveRoom,
  searchRooms,
  findNearestPOI,
} from '../services/indoor';
import type {
  IndoorBuildingMeta,
  IndoorFeature,
  IndoorRoute,
  LatLng,
  OverlayBounds,
  PathfinderOptions,
  ResolvedRoom,
  POICategory,
  NearestPOIResult,
} from '../services/indoor';

// ---------------------------------------------------------------------------
// Hook state
// ---------------------------------------------------------------------------

export interface UseIndoorNavigationReturn {
  /** True when an indoor building is loaded and visible. */
  isIndoorActive: boolean;
  /** The building code currently loaded (e.g. "H"). */
  activeBuildingCode: string | null;
  /** Building metadata (bounds, entrance, etc.) — null when inactive. */
  buildingMeta: IndoorBuildingMeta | null;
  /** Available floor levels for the active building. */
  levels: string[];
  /** Currently displayed floor level. */
  activeLevel: string;
  /** Change the visible floor. */
  setActiveLevel: (level: string) => void;
  /** Features for the active level (for rendering). */
  activeLevelFeatures: IndoorFeature[];
  /** All features grouped by level. */
  featuresByLevel: Map<string, IndoorFeature[]>;
  /** The computed indoor route, if any. */
  indoorRoute: IndoorRoute | null;
  /** The resolved destination room details. */
  destinationRoom: ResolvedRoom | null;
  /** Currently selected room (tapped by user on the floor plan). */
  selectedRoom: ResolvedRoom | null;
  /** Set or clear the selected room. */
  selectRoom: (room: ResolvedRoom | null) => void;
  /** Floor plan image for the active level (null if no image). */
  floorPlanImage: ImageRequireSource | null;
  /** Image overlay bounds for the active building. */
  imageBounds: OverlayBounds | null;
  /** Bearing (clockwise degrees from north) for rotating the floor plan overlay. */
  overlayBearing: number;
  /** Compute a route to a room ref (e.g. "H-840"). */
  navigateToRoom: (roomQuery: string, fromPosition?: LatLng, fromLevel?: string) => void;
  /** Compute a route with accessibility preferences. */
  navigateToRoomAccessible: (
    roomQuery: string,
    options: PathfinderOptions,
    fromPosition?: LatLng,
    fromLevel?: string,
  ) => void;
  /** Search for rooms matching a partial query (autocomplete). */
  searchRooms: (query: string, limit?: number) => ResolvedRoom[];
  /** Find the nearest POI of a category. */
  findNearest: (
    category: POICategory,
    fromPosition: LatLng,
    fromLevel: string,
  ) => NearestPOIResult | null;
  /** Load and activate a building's indoor map. */
  activateBuilding: (buildingCode: string) => boolean;
  /** Close the indoor map view. */
  deactivate: () => void;
  /** Check whether a query targets an indoor destination. */
  detectIndoor: (query: string) => { buildingCode: string; roomRef: string } | null;
  /** Whether the building data is currently loading/parsing. */
  isLoading: boolean;
  /** Error message, if any. */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function useIndoorNavigation(): UseIndoorNavigationReturn {
  const [activeBuildingCode, setActiveBuildingCode] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState<string>('1');
  const [indoorRoute, setIndoorRoute] = useState<IndoorRoute | null>(null);
  const [destinationRoom, setDestinationRoom] = useState<ResolvedRoom | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<ResolvedRoom | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pending navigation request — when navigateToRoom is called before
  // buildingData is ready (race condition with activateBuilding), we store
  // the request here and a useEffect retries when buildingData becomes available.
  const pendingNavRef = useRef<{
    roomQuery: string;
    options: PathfinderOptions;
    fromPosition?: LatLng;
    fromLevel?: string;
  } | null>(null);

  // Building metadata (bounds, entrance, etc.)
  const buildingMeta = useMemo(
    () => (activeBuildingCode ? getBuildingMeta(activeBuildingCode) : null),
    [activeBuildingCode],
  );

  // Cached building data (features, graph, roomIndex, levels)
  const buildingData = useMemo(() => {
    if (!activeBuildingCode) return null;
    return loadBuilding(activeBuildingCode);
  }, [activeBuildingCode]);

  const levels = buildingData?.levels ?? [];
  const featuresByLevel = useMemo(
    () => (buildingData ? groupByLevel(buildingData.features) : new Map<string, IndoorFeature[]>()),
    [buildingData],
  );
  const activeLevelFeatures = useMemo(
    () => featuresByLevel.get(activeLevel) ?? [],
    [featuresByLevel, activeLevel],
  );

  // Floor plan image for the current level
  const floorPlanImage = useMemo<ImageRequireSource | null>(
    () =>
      activeBuildingCode
        ? (getFloorPlanImage(activeBuildingCode, activeLevel) as ImageRequireSource | null)
        : null,
    [activeBuildingCode, activeLevel],
  );

  // Image overlay bounds
  const imageBounds = buildingMeta?.imageBounds ?? null;

  // Reset level to first available when building changes
  useEffect(() => {
    if (levels.length > 0 && !levels.includes(activeLevel)) {
      setActiveLevel(levels[0]);
    }
  }, [levels, activeLevel]);

  // -------------------------------------------------------------------
  // Core route computation — pure function, no state dependency issues.
  // Called by both navigateToRoomAccessible and the retry effect.
  // -------------------------------------------------------------------

  const computeRoute = useCallback(
    (
      data: NonNullable<ReturnType<typeof loadBuilding>>,
      bCode: string,
      roomQuery: string,
      options: PathfinderOptions,
      fromPosition?: LatLng,
      fromLevel?: string,
    ) => {
      const room = resolveRoom(roomQuery, data.roomIndex, bCode);
      if (!room) {
        setError(`Room "${roomQuery}" not found in building ${bCode}`);
        setIndoorRoute(null);
        setDestinationRoom(null);
        return;
      }

      setDestinationRoom(room);
      setActiveLevel(room.level);

      // Find the destination graph node
      const destNode = data.graph.findClosestNode(room.position, room.level);
      if (!destNode) {
        setError('Could not find a route to the destination — no nearby corridor node');
        return;
      }

      // Determine start node — default to building entrance on level 1
      const meta = getBuildingMeta(bCode);
      const entrancePos = meta?.entrances?.[0];
      const startLevel = fromLevel ?? meta?.defaultLevel ?? '1';
      const startPos =
        fromPosition ?? entrancePos ?? data.graph.nodes.values().next().value?.position;
      if (!startPos) {
        setError('No start position available');
        return;
      }

      const startNode = data.graph.findClosestNode(startPos, startLevel);
      if (!startNode) {
        setError('Could not find a route — no corridor node near the start position');
        return;
      }

      const route = findPath(data.graph, startNode.id, destNode.id, options);
      if (!route) {
        setError('No indoor route found between the given points');
        setIndoorRoute(null);
        return;
      }

      setIndoorRoute(route);
      setError(null);
    },
    [],
  );

  // -------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------

  const activateBuilding = useCallback((buildingCode: string): boolean => {
    if (!hasIndoorMap(buildingCode)) {
      setError(`No indoor map available for building "${buildingCode}"`);
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      const code = buildingCode.toUpperCase();
      setActiveBuildingCode(code);
      // Reset to building's default level (or keep current if already active)
      const meta = getBuildingMeta(code);
      if (meta?.defaultLevel) {
        setActiveLevel(meta.defaultLevel);
      }
      setIndoorRoute(null);
      setDestinationRoom(null);
      setSelectedRoom(null);
      return true;
    } catch (e) {
      setError(String(e));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deactivate = useCallback(() => {
    setActiveBuildingCode(null);
    setIndoorRoute(null);
    setDestinationRoom(null);
    setSelectedRoom(null);
    setError(null);
    pendingNavRef.current = null;
  }, []);

  const navigateToRoom = useCallback(
    (roomQuery: string, fromPosition?: LatLng, fromLevel?: string) => {
      navigateToRoomAccessible(roomQuery, {}, fromPosition, fromLevel);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buildingData, activeBuildingCode],
  );

  const navigateToRoomAccessible = useCallback(
    (roomQuery: string, options: PathfinderOptions, fromPosition?: LatLng, fromLevel?: string) => {
      if (!buildingData || !activeBuildingCode) {
        // Building data not yet available (React state hasn't settled).
        // Store a pending request and auto-detect + activate the building.
        pendingNavRef.current = { roomQuery, options, fromPosition, fromLevel };

        const detected = detectIndoorDestination(roomQuery);
        if (detected) {
          activateBuilding(detected.buildingCode);
        }
        // The useEffect below will retry once buildingData becomes available.
        return;
      }

      // Data is available — compute the route directly.
      pendingNavRef.current = null;
      computeRoute(buildingData, activeBuildingCode, roomQuery, options, fromPosition, fromLevel);
    },
    [buildingData, activeBuildingCode, activateBuilding, computeRoute],
  );

  // -------------------------------------------------------------------
  // Retry pending navigation once buildingData becomes available.
  // This solves the race condition when activateBuilding() + navigateToRoom()
  // are called in the same event handler — setState is async, so buildingData
  // is still null when navigateToRoom runs. On the next render, buildingData
  // is populated and this effect picks up the queued request.
  // -------------------------------------------------------------------
  useEffect(() => {
    const pending = pendingNavRef.current;
    if (!pending || !buildingData || !activeBuildingCode) return;

    // Clear the pending request before computing to avoid infinite loops
    pendingNavRef.current = null;
    computeRoute(
      buildingData,
      activeBuildingCode,
      pending.roomQuery,
      pending.options,
      pending.fromPosition,
      pending.fromLevel,
    );
  }, [buildingData, activeBuildingCode, computeRoute]);

  const searchRoomsCallback = useCallback(
    (query: string, limit?: number): ResolvedRoom[] => {
      if (!buildingData) return [];
      return searchRooms(query, buildingData.roomIndex, activeBuildingCode ?? undefined, limit);
    },
    [buildingData, activeBuildingCode],
  );

  const findNearest = useCallback(
    (category: POICategory, fromPosition: LatLng, fromLevel: string): NearestPOIResult | null => {
      if (!buildingData) return null;
      return findNearestPOI(buildingData.features, fromPosition, fromLevel, category);
    },
    [buildingData],
  );

  const detectIndoor = useCallback((query: string) => detectIndoorDestination(query), []);

  // -------------------------------------------------------------------
  // Return value
  // -------------------------------------------------------------------

  return {
    isIndoorActive: activeBuildingCode !== null,
    activeBuildingCode,
    buildingMeta,
    levels,
    activeLevel,
    setActiveLevel,
    activeLevelFeatures,
    featuresByLevel,
    indoorRoute,
    destinationRoom,
    selectedRoom,
    selectRoom: setSelectedRoom,
    floorPlanImage,
    imageBounds,
    overlayBearing: buildingMeta?.overlayBearing ?? 0,
    navigateToRoom,
    navigateToRoomAccessible,
    searchRooms: searchRoomsCallback,
    findNearest,
    activateBuilding,
    deactivate,
    detectIndoor,
    isLoading,
    error,
  };
}
