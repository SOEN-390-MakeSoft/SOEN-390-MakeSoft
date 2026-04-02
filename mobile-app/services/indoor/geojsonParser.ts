/**
 * Parses an OSM-indoor-style GeoJSON FeatureCollection into strongly-typed
 * IndoorFeature objects that the rest of the indoor navigation system consumes.
 *
 * The parser is intentionally **pure** (no side-effects, no React) so it can
 * run once at load time and the result can be cached.
 */

import type {
  GeoCoord,
  IndoorArea,
  IndoorCorridor,
  IndoorDoor,
  IndoorElevator,
  IndoorEscalator,
  IndoorFeature,
  IndoorFeatureType,
  IndoorLevelOutline,
  IndoorPOI,
  IndoorRoom,
  IndoorStairs,
  LatLng,
} from './types';

// ---------------------------------------------------------------------------
// GeoJSON minimal typings (just what we need – avoids heavy dependency)
// ---------------------------------------------------------------------------

interface GeoJSONPoint {
  type: 'Point';
  coordinates: GeoCoord;
}
interface GeoJSONLineString {
  type: 'LineString';
  coordinates: GeoCoord[];
}
interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: GeoCoord[][];
}
interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: GeoCoord[][][];
}
type GeoJSONGeometry = GeoJSONPoint | GeoJSONLineString | GeoJSONPolygon | GeoJSONMultiPolygon;

interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, string | undefined>;
  geometry: GeoJSONGeometry;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a GeoJSON [lng, lat] pair to our LatLng type. */
function toLatLng(coord: GeoCoord): LatLng {
  return { latitude: coord[1], longitude: coord[0] };
}

/** Convert a coordinate ring to LatLng[]. */
function ringToLatLngs(ring: GeoCoord[]): LatLng[] {
  return ring.map(toLatLng);
}

/** Parse the "level" property which can be semicolon-separated.
 *  Optionally merge extra levels from the `repeat_on` tag. */
function parseLevels(raw: string | undefined, repeatOn?: string): string[] {
  const base = raw
    ? raw
        .split(';')
        .map((l) => l.trim())
        .filter(Boolean)
    : [];
  if (repeatOn) {
    const extra = repeatOn
      .split(';')
      .map((l) => l.trim())
      .filter(Boolean);
    for (const l of extra) {
      if (!base.includes(l)) base.push(l);
    }
  }
  return base;
}

/** Simple centroid of a polygon ring. */
function centroid(ring: LatLng[]): LatLng {
  if (ring.length === 0) return { latitude: 0, longitude: 0 };
  const sum = ring.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 },
  );
  return { latitude: sum.latitude / ring.length, longitude: sum.longitude / ring.length };
}

/** Classify a GeoJSON feature into our indoor type system. */
/** Check if properties match escalator pattern by ref tag */
function isEscalatorByRef(ref: string | undefined): boolean {
  return ref !== undefined && /escalator/i.test(ref);
}

/** Check if properties match stairs pattern by ref tag */
function isStairsByRef(ref: string | undefined): boolean {
  return ref !== undefined && /stair/i.test(ref);
}

/** Check if properties match implicit room (ref + level) */
function isImplicitRoom(props: Record<string, string | undefined>): boolean {
  return Boolean(props.ref && props.level);
}

function classify(props: Record<string, string | undefined>): IndoorFeatureType {
  // Elevator check first (highway=elevator)
  if (props.highway === 'elevator') return 'elevator';
  // Escalator: conveying + stairs
  if (props.conveying === 'yes' && props.stairs === 'yes') return 'escalator';
  // Conveying steps (escalators mapped as highway=steps with conveying)
  if (props.conveying === 'yes' && props.highway === 'steps') return 'escalator';
  // Stairs / steps
  if (props.highway === 'steps' || props.stairs === 'yes') return 'stairs';
  // Ref-based fallback — catch features named like escalators / stairs
  if (isEscalatorByRef(props.ref)) return 'escalator';
  if (isStairsByRef(props.ref)) return 'stairs';
  // Amenity-tagged POI (check before indoor room so bathrooms/cafes get their icons properly)
  if (props.amenity) return 'poi';
  // Explicit indoor room
  if (props.indoor === 'room') return 'room';
  // Building-level outline
  if (props.indoor === 'level') return 'level_outline';
  // Open area
  if (props.indoor === 'area') return 'area';
  // Walkable corridor
  if (props.indoor === 'corridor' || props.highway === 'footway') return 'corridor';
  // Door / entrance
  if (props.door || props.entrance) return 'door';
  // Implicit room: has a ref and level but no other classification
  if (isImplicitRoom(props)) return 'room';

  return 'unknown';
}

function parseOneway(props: Record<string, string | undefined>): 'up' | 'down' | null {
  if (props.oneway === 'yes') return 'up';
  if (props.oneway === '-1') return 'down';
  return null;
}

function parseRoomFeature(
  base: { levels: string[]; ref: string | null; raw: Record<string, string | undefined> },
  geom: GeoJSONGeometry,
): IndoorRoom[] {
  if (geom.type === 'Polygon') {
    const poly = ringToLatLngs(geom.coordinates[0]);
    const holes = geom.coordinates.slice(1).map(ringToLatLngs);
    return [
      {
        ...base,
        id: nextId('room'),
        type: 'room',
        polygon: poly,
        holes: holes.length > 0 ? holes : undefined,
        centroid: centroid(poly),
      } satisfies IndoorRoom,
    ];
  }
  if (geom.type === 'LineString') {
    const poly = ringToLatLngs(geom.coordinates);
    return [
      {
        ...base,
        id: nextId('room'),
        type: 'room',
        polygon: poly,
        centroid: centroid(poly),
      } satisfies IndoorRoom,
    ];
  }
  if (geom.type === 'MultiPolygon') {
    const mainPoly = geom.coordinates[0];
    const poly = ringToLatLngs(mainPoly[0]);
    const holes = mainPoly.slice(1).map(ringToLatLngs);
    return [
      {
        ...base,
        id: nextId('room'),
        type: 'room',
        polygon: poly,
        holes: holes.length > 0 ? holes : undefined,
        centroid: centroid(poly),
      } satisfies IndoorRoom,
    ];
  }
  if (geom.type === 'Point') {
    const pos = toLatLng(geom.coordinates);
    return [
      {
        ...base,
        id: nextId('room'),
        type: 'room',
        polygon: [],
        centroid: pos,
      } satisfies IndoorRoom,
    ];
  }
  return [];
}

function parseCorridorFeature(
  base: { levels: string[]; ref: string | null; raw: Record<string, string | undefined> },
  geom: GeoJSONGeometry,
): IndoorCorridor[] {
  if (geom.type !== 'LineString') return [];
  return [
    {
      ...base,
      id: nextId('corridor'),
      type: 'corridor',
      path: ringToLatLngs(geom.coordinates),
    } satisfies IndoorCorridor,
  ];
}

function parseStairsFeature(
  base: { levels: string[]; ref: string | null; raw: Record<string, string | undefined> },
  geom: GeoJSONGeometry,
  props: Record<string, string | undefined>,
): IndoorStairs[] {
  const poly = geom.type === 'Polygon' ? ringToLatLngs(geom.coordinates[0]) : [];
  const path = geom.type === 'LineString' ? ringToLatLngs(geom.coordinates) : [];
  return [
    {
      ...base,
      id: nextId('stairs'),
      type: 'stairs',
      polygon: poly,
      path,
      oneway: parseOneway(props),
    } satisfies IndoorStairs,
  ];
}

function parseElevatorFeature(
  base: { levels: string[]; ref: string | null; raw: Record<string, string | undefined> },
  geom: GeoJSONGeometry,
): (IndoorElevator | IndoorEscalator)[] {
  if (geom.type === 'Point') {
    return [
      {
        ...base,
        id: nextId('elevator'),
        type: 'elevator',
        position: toLatLng(geom.coordinates),
      } satisfies IndoorElevator,
    ];
  }
  if (geom.type === 'LineString') {
    const path = ringToLatLngs(geom.coordinates);
    return [
      {
        ...base,
        id: nextId('elevator_line'),
        type: 'escalator',
        isElevator: true,
        polygon: [],
        path,
        oneway: null,
      } satisfies IndoorEscalator,
    ];
  }
  return [];
}

function parseEscalatorFeature(
  base: { levels: string[]; ref: string | null; raw: Record<string, string | undefined> },
  geom: GeoJSONGeometry,
  props: Record<string, string | undefined>,
): IndoorEscalator[] {
  const poly = geom.type === 'Polygon' ? ringToLatLngs(geom.coordinates[0]) : [];
  const path = geom.type === 'LineString' ? ringToLatLngs(geom.coordinates) : [];
  return [
    {
      ...base,
      id: nextId('escalator'),
      type: 'escalator',
      polygon: poly,
      path,
      oneway: parseOneway(props),
    } satisfies IndoorEscalator,
  ];
}

function parseDoorFeature(
  base: { levels: string[]; ref: string | null; raw: Record<string, string | undefined> },
  geom: GeoJSONGeometry,
  props: Record<string, string | undefined>,
): IndoorDoor[] {
  if (geom.type !== 'Point') return [];
  return [
    {
      ...base,
      id: nextId('door'),
      type: 'door',
      position: toLatLng(geom.coordinates),
      doorKind: props.door ?? null,
      isEntrance: props.entrance === 'yes' || props.entrance === 'staircase',
    } satisfies IndoorDoor,
  ];
}

function parsePoiFeature(
  base: { levels: string[]; ref: string | null; raw: Record<string, string | undefined> },
  geom: GeoJSONGeometry,
  props: Record<string, string | undefined>,
): IndoorPOI[] {
  if (geom.type === 'Point') {
    return [
      {
        ...base,
        id: nextId('poi'),
        type: 'poi',
        position: toLatLng(geom.coordinates),
        amenity: props.amenity ?? 'unknown',
        name: props.name ?? null,
        male: props.male === 'yes',
        female: props.female === 'yes',
      } satisfies IndoorPOI,
    ];
  }
  if (geom.type === 'Polygon') {
    const poly = ringToLatLngs(geom.coordinates[0]);
    const cent = centroid(poly);
    return [
      {
        ...base,
        id: nextId('poi'),
        type: 'poi',
        polygon: poly,
        centroid: cent,
        amenity: props.amenity ?? 'unknown',
        name: props.name ?? null,
        male: props.male === 'yes',
        female: props.female === 'yes',
      } satisfies IndoorPOI,
    ];
  }
  return [];
}

function parseLevelOutlineFeature(
  base: { levels: string[]; ref: string | null; raw: Record<string, string | undefined> },
  geom: GeoJSONGeometry,
  props: Record<string, string | undefined>,
): IndoorLevelOutline[] {
  if (geom.type === 'Polygon') {
    return [
      {
        ...base,
        id: nextId('level'),
        type: 'level_outline',
        polygon: ringToLatLngs(geom.coordinates[0]),
        name: props.name ?? null,
      } satisfies IndoorLevelOutline,
    ];
  }
  if (geom.type === 'LineString') {
    return [
      {
        ...base,
        id: nextId('level'),
        type: 'level_outline',
        polygon: ringToLatLngs(geom.coordinates),
        name: props.name ?? null,
      } satisfies IndoorLevelOutline,
    ];
  }
  return [];
}

function parseAreaFeature(
  base: { levels: string[]; ref: string | null; raw: Record<string, string | undefined> },
  geom: GeoJSONGeometry,
): IndoorArea[] {
  if (geom.type === 'Polygon') {
    return [
      {
        ...base,
        id: nextId('area'),
        type: 'area',
        polygon: ringToLatLngs(geom.coordinates[0]),
      } satisfies IndoorArea,
    ];
  }
  if (geom.type === 'LineString') {
    return [
      {
        ...base,
        id: nextId('area'),
        type: 'area',
        polygon: ringToLatLngs(geom.coordinates),
      } satisfies IndoorArea,
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

let _nextId = 0;
function nextId(prefix: string): string {
  return `${prefix}-${_nextId++}`;
}

/** Reset the id counter (useful for deterministic tests). */
export function resetIdCounter(): void {
  _nextId = 0;
}

/**
 * Parse a GeoJSON FeatureCollection into an array of typed IndoorFeature objects.
 *
 * Features whose type cannot be determined are still included as `unknown` so
 * that callers can decide whether to render them or ignore them.
 */
function parseFeature(f: GeoJSONFeature): IndoorFeature[] {
  const props = f.properties ?? {};
  const type = classify(props);
  const levels = parseLevels(props.level, props.repeat_on);
  const ref = props.ref ?? null;
  const geom = f.geometry;

  const base = { levels, ref, raw: props };

  switch (type) {
    case 'room': {
      return parseRoomFeature(base, geom);
    }

    case 'corridor': {
      return parseCorridorFeature(base, geom);
    }

    case 'stairs': {
      return parseStairsFeature(base, geom, props);
    }

    case 'elevator': {
      return parseElevatorFeature(base, geom);
    }

    case 'escalator': {
      return parseEscalatorFeature(base, geom, props);
    }

    case 'door': {
      return parseDoorFeature(base, geom, props);
    }

    case 'poi': {
      return parsePoiFeature(base, geom, props);
    }

    case 'level_outline': {
      return parseLevelOutlineFeature(base, geom, props);
    }

    case 'area': {
      return parseAreaFeature(base, geom);
    }

    default:
      // Unknown features can be extended later.
      // We intentionally skip them for now to keep the feature list clean.
      return [];
  }
}

export function parseIndoorGeoJSON(collection: GeoJSONFeatureCollection): IndoorFeature[] {
  const features: IndoorFeature[] = [];

  for (const f of collection.features) {
    features.push(...parseFeature(f));
  }

  return mergePointRooms(features);
}

type RoomIndexEntry = {
  room: IndoorRoom;
  levels: Set<string>;
};

function buildPolygonRoomIndex(features: IndoorFeature[]): Map<string, RoomIndexEntry[]> {
  const index = new Map<string, RoomIndexEntry[]>();
  for (const f of features) {
    if (f.type !== 'room') continue;
    if (f.polygon.length === 0) continue;
    if (!f.ref) continue;

    const list = index.get(f.ref) ?? [];
    list.push({ room: f, levels: new Set(f.levels) });
    index.set(f.ref, list);
  }
  return index;
}

function hasLevelOverlap(levels: Set<string>, candidateLevels: string[]): boolean {
  for (const level of candidateLevels) {
    if (levels.has(level)) return true;
  }
  return false;
}

function mergePointRoomCentroids(
  features: IndoorFeature[],
  index: Map<string, RoomIndexEntry[]>,
): Set<string> {
  const mergedPointIds = new Set<string>();
  for (const f of features) {
    if (f.type !== 'room') continue;
    if (f.polygon.length > 0) continue;
    if (!f.ref) continue;

    const candidates = index.get(f.ref);
    if (!candidates) continue;

    let matched = false;
    for (const candidate of candidates) {
      if (!hasLevelOverlap(candidate.levels, f.levels)) continue;
      candidate.room.centroid = f.centroid;
      matched = true;
    }

    if (matched) {
      mergedPointIds.add(f.id);
    }
  }
  return mergedPointIds;
}

function mergePointRooms(features: IndoorFeature[]): IndoorFeature[] {
  // Post-processing: Merge Point rooms into Polygon rooms when they share the same ref and level.
  // This ensures room labels appear exactly at the explicit GeoJSON node rather than the calculated geometric center.
  const index = buildPolygonRoomIndex(features);
  const mergedPointIds = mergePointRoomCentroids(features, index);

  return features.filter((f) => !mergedPointIds.has(f.id));
}

/**
 * Group features by level. Features spanning multiple levels appear in each.
 */
export function groupByLevel(features: IndoorFeature[]): Map<string, IndoorFeature[]> {
  const map = new Map<string, IndoorFeature[]>();
  for (const f of features) {
    for (const level of f.levels) {
      const arr = map.get(level) ?? [];
      arr.push(f);
      map.set(level, arr);
    }
    // Features with no level go into a special '__none__' bucket
    if (f.levels.length === 0) {
      const arr = map.get('__none__') ?? [];
      arr.push(f);
      map.set('__none__', arr);
    }
  }
  return map;
}

/**
 * Extract all unique, sorted level strings from a feature collection.
 */
export function extractLevels(features: IndoorFeature[]): string[] {
  const set = new Set<string>();
  for (const f of features) {
    for (const l of f.levels) set.add(l);
  }
  return [...set].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}
