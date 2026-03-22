/**
 * Registry of buildings that have indoor map data.
 *
 * Adding a new building is a one-line addition to INDOOR_BUILDINGS plus
 * dropping the GeoJSON file into assets/geo/.
 *
 * The registry lazily loads and caches parsed data so only the buildings
 * that the user actually navigates into consume memory.
 */

import type { IndoorBuildingMeta, IndoorFeature, LatLng } from './types';
import type { GeoJSONFeatureCollection } from './geojsonParser';
import { parseIndoorGeoJSON, extractLevels, resetIdCounter } from './geojsonParser';
import { IndoorGraph } from './IndoorGraph';
import { buildRoomIndex, type ResolvedRoom } from './roomResolver';

// ---------------------------------------------------------------------------
// Building catalogue — add new indoor maps here
// ---------------------------------------------------------------------------

export const INDOOR_BUILDINGS: IndoorBuildingMeta[] = [
  {
    code: 'H',
    name: 'Henry F. Hall Building',
    levels: ['-2', '-1', '0', '1', '2', '3', '5', '7', '8', '9'],
    entrances: [
      { latitude: 45.49704433962407, longitude: -73.5786497963592 }, // main De Maisonneuve entrance
    ],
    tunnelEntrances: [
      {
        ref: 'entry-H-b1-north',
        position: { latitude: 45.49703, longitude: -73.57862 },
        level: '-1',
      },
      {
        ref: 'entry-H-b1-metro',
        position: { latitude: 45.49684, longitude: -73.57881 },
        level: '-1',
      },
    ],
    geojsonAsset: 'Hall_Building',
    defaultLevel: '1',
    imageBounds: {
      // Axis-aligned un-rotated bounds; the Overlay rotates by overlayBearing.
      // Derived from 4 corners: TL(45.49717,-73.57954) TR(45.49771,-73.57903)
      //                         BL(45.49683,-73.57885) BR(45.49737,-73.57834)
      sw: { latitude: 45.49695914, longitude: -73.57939344 },
      ne: { latitude: 45.4975805, longitude: -73.57843948 },
    },
    overlayBearing: 304,
  },
  // -----------------------------------------------------------------------
  // To add a new building:
  // 1. Place <Building>.geojson in assets/geo/
  // 2. Add an entry here with code, levels, entrances, etc.
  // That's it — the rest of the system picks it up automatically.
  // -----------------------------------------------------------------------
];

// Build a quick lookup map: building code → meta
const META_BY_CODE = new Map<string, IndoorBuildingMeta>(
  INDOOR_BUILDINGS.map((b) => [b.code.toUpperCase(), b]),
);

// ---------------------------------------------------------------------------
// Cached parsed data per building
// ---------------------------------------------------------------------------

interface CachedBuildingData {
  features: IndoorFeature[];
  graph: IndoorGraph;
  roomIndex: Map<string, ResolvedRoom>;
  levels: string[];
}

const cache = new Map<string, CachedBuildingData>();
const graphCache = new Map<string, { features: IndoorFeature[]; graph: IndoorGraph }>();
const featureCache = new Map<string, IndoorFeature[]>();

// GeoJSON asset loaders — maps asset key to the raw JSON.
// In a React Native / Expo context, these are resolved via `require()` or
// `fetch()` at runtime. We use a loader map so the registry stays decoupled
// from the bundler.
const ASSET_LOADERS: Record<string, () => GeoJSONFeatureCollection> = {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Hall_Building: () =>
    require('../../assets/geo/Hall_Building.geojson') as GeoJSONFeatureCollection,
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SGW_Tunnel_Network: () =>
    require('../../assets/geo/SGW_Tunnel_Network.geojson') as GeoJSONFeatureCollection,
};

// ---------------------------------------------------------------------------
// Floor plan images — keyed by "<BuildingCode>:<level>"
// Returns an image source (require()). Not every floor has a custom image;
// callers should check `getFloorPlanImage()` and show nothing if null.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-var-requires */
const FLOOR_PLAN_IMAGES: Record<string, ReturnType<typeof require>> = {
  'H:8': require('../../assets/floorplans/H/Hall_8th.png'),
};
/* eslint-enable @typescript-eslint/no-var-requires */

/**
 * Get the floor plan image source for a building/level, or null if none exists.
 */
export function getFloorPlanImage(
  buildingCode: string,
  level: string,
): ReturnType<typeof require> | null {
  return FLOOR_PLAN_IMAGES[`${buildingCode.toUpperCase()}:${level}`] ?? null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether a building code has an indoor map available.
 */
export function hasIndoorMap(buildingCode: string): boolean {
  return META_BY_CODE.has(buildingCode.toUpperCase());
}

/**
 * Get the building metadata without loading the full dataset.
 */
export function getBuildingMeta(buildingCode: string): IndoorBuildingMeta | null {
  return META_BY_CODE.get(buildingCode.toUpperCase()) ?? null;
}

/**
 * Load (or return cached) the full indoor dataset for a building.
 * This triggers GeoJSON parsing + graph construction on first call.
 */
export function loadBuilding(buildingCode: string): CachedBuildingData | null {
  const code = buildingCode.toUpperCase();
  if (cache.has(code)) return cache.get(code)!;

  const graphData = loadBuildingGraphData(code);
  if (!graphData) return null;

  const { features, graph } = graphData;
  const roomIndex = buildRoomIndex(features);
  const levels = extractLevels(features);

  const data: CachedBuildingData = { features, graph, roomIndex, levels };
  cache.set(code, data);
  return data;
}

/**
 * Load (or return cached) only the navigation graph for a building.
 * This is cheaper than `loadBuilding()` because it skips room indexing.
 */
export function loadBuildingGraph(buildingCode: string): IndoorGraph | null {
  const code = buildingCode.toUpperCase();
  return loadBuildingGraphData(code)?.graph ?? null;
}

/**
 * Determine which indoor building (if any) a coordinate is near.
 * Uses a simple closest-entrance heuristic within a 100 m radius.
 */
export function findBuildingAtCoordinate(point: LatLng): IndoorBuildingMeta | null {
  let closest: IndoorBuildingMeta | null = null;
  let closestDist = 100; // max 100 m from an entrance

  for (const meta of INDOOR_BUILDINGS) {
    const entrances = [
      ...meta.entrances,
      ...(meta.tunnelEntrances ?? []).map((entrance) => entrance.position),
    ];
    for (const entrance of entrances) {
      const d = haversine(point, entrance);
      if (d < closestDist) {
        closestDist = d;
        closest = meta;
      }
    }
  }

  return closest;
}

/**
 * Detect whether a search query refers to an indoor room.
 *
 * Returns the building code and room reference if matched, null otherwise.
 * Patterns recognised: "H-840", "H 840", "H840", "Hall H-840", etc.
 */
export function detectIndoorDestination(
  query: string,
): { buildingCode: string; roomRef: string } | null {
  // Pattern: optional building name, then building-code + optional separator + room number
  const match = query.match(/\b([A-Z]{1,3})[\s\-]?(\d{1,4}(?:\.\d+)?)\b/i);
  if (!match) return null;

  const code = match[1].toUpperCase();
  if (!META_BY_CODE.has(code)) return null;

  const roomRef = `${code}-${match[2]}`;
  return { buildingCode: code, roomRef };
}

/**
 * Clear the cache (useful for testing or memory management).
 */
export function clearCache(): void {
  cache.clear();
  graphCache.clear();
  featureCache.clear();
}

function loadBuildingGraphData(
  buildingCode: string,
): { features: IndoorFeature[]; graph: IndoorGraph } | null {
  const code = buildingCode.toUpperCase();
  if (graphCache.has(code)) return graphCache.get(code)!;

  const meta = META_BY_CODE.get(code);
  if (!meta) return null;

  const features = loadBuildingFeatures(meta);
  if (!features) return null;

  const data = {
    features,
    graph: IndoorGraph.build(features),
  };
  graphCache.set(code, data);
  return data;
}

function loadBuildingFeatures(meta: IndoorBuildingMeta): IndoorFeature[] | null {
  const code = meta.code.toUpperCase();
  if (featureCache.has(code)) return featureCache.get(code)!;

  const loader = ASSET_LOADERS[meta.geojsonAsset];
  if (!loader) {
    console.warn(`[indoor] No asset loader found for "${meta.geojsonAsset}"`);
    return null;
  }

  resetIdCounter();
  const geojson = loader();
  const baseFeatures = parseIndoorGeoJSON(geojson);
  const features = [...baseFeatures];

  if ((meta.tunnelEntrances?.length ?? 0) > 0) {
    const baseGraph = IndoorGraph.build(baseFeatures);
    const tunnelConnectorFeatures = buildTunnelConnectorFeatures(meta, baseGraph);
    const tunnelFeatures = parseIndoorGeoJSON(ASSET_LOADERS.SGW_Tunnel_Network());
    features.push(...tunnelConnectorFeatures, ...tunnelFeatures);
  }

  featureCache.set(code, features);
  return features;
}

// ---------------------------------------------------------------------------
// Haversine
// ---------------------------------------------------------------------------

function haversine(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const TUNNEL_CONNECT_MAX_METERS = 80;

function buildTunnelConnectorFeatures(
  meta: IndoorBuildingMeta,
  baseGraph: IndoorGraph,
): IndoorFeature[] {
  const connectorCollection: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features: [],
  };

  for (const entrance of meta.tunnelEntrances ?? []) {
    const nearestNode = baseGraph.findClosestNode(entrance.position, entrance.level);
    if (!nearestNode) continue;
    if (haversine(entrance.position, nearestNode.position) > TUNNEL_CONNECT_MAX_METERS) continue;

    connectorCollection.features.push({
      type: 'Feature',
      properties: {
        ref: entrance.ref
          ? `connector-${meta.code}-${entrance.ref}`
          : `connector-${meta.code}-${entrance.level}`,
        level: entrance.level,
        indoor: 'corridor',
        highway: 'footway',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [entrance.position.longitude, entrance.position.latitude],
          [nearestNode.position.longitude, nearestNode.position.latitude],
        ],
      },
    });
  }

  return parseIndoorGeoJSON(connectorCollection);
}
