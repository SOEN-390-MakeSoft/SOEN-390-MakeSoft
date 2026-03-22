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
type GeoJSONGeometry = GeoJSONPoint | GeoJSONLineString | GeoJSONPolygon;

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
function classify(props: Record<string, string | undefined>): IndoorFeatureType {
  // Elevator check first (highway=elevator)
  if (props.highway === 'elevator') return 'elevator';
  // Escalator: conveying + stairs
  if (props.conveying === 'yes' && props.stairs === 'yes') return 'escalator';
  // Conveying steps (escalators mapped as highway=steps with conveying)
  if (props.conveying === 'yes' && props.highway === 'steps') return 'escalator';
  // Stairs / steps
  if (props.highway === 'steps' || props.stairs === 'yes') return 'stairs';
  // Ref-based fallback — catch features named like escalators / stairs even
  // when explicit tags are missing (common in JOSM-exported indoor data).
  if (props.ref && /escalator/i.test(props.ref)) return 'escalator';
  if (props.ref && /stair/i.test(props.ref)) return 'stairs';
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
  // Amenity-tagged POI
  if (props.amenity) return 'poi';
  // Implicit room: has a ref and level but no other classification
  // (common in JOSM-exported indoor data where rooms lack an explicit "indoor" tag)
  if (props.ref && props.level) return 'room';

  return 'unknown';
}

function parseOneway(props: Record<string, string | undefined>): 'up' | 'down' | null {
  if (props.oneway === 'yes') return 'up';
  if (props.oneway === '-1') return 'down';
  return null;
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
export function parseIndoorGeoJSON(collection: GeoJSONFeatureCollection): IndoorFeature[] {
  const features: IndoorFeature[] = [];

  for (const f of collection.features) {
    const props = f.properties ?? {};
    const type = classify(props);
    const levels = parseLevels(props.level, props.repeat_on);
    const ref = props.ref ?? null;
    const geom = f.geometry;

    const base = { levels, ref, raw: props };

    switch (type) {
      case 'room': {
        if (geom.type === 'Polygon') {
          const poly = ringToLatLngs(geom.coordinates[0]);
          features.push({
            ...base,
            id: nextId('room'),
            type: 'room',
            polygon: poly,
            centroid: centroid(poly),
          } satisfies IndoorRoom);
        } else if (geom.type === 'Point') {
          // Some rooms are Point-only (e.g. H-840 in the dataset)
          const pos = toLatLng(geom.coordinates as GeoCoord);
          features.push({
            ...base,
            id: nextId('room'),
            type: 'room',
            polygon: [],
            centroid: pos,
          } satisfies IndoorRoom);
        }
        break;
      }

      case 'corridor': {
        if (geom.type === 'LineString') {
          features.push({
            ...base,
            id: nextId('corridor'),
            type: 'corridor',
            path: ringToLatLngs(geom.coordinates),
          } satisfies IndoorCorridor);
        }
        break;
      }

      case 'stairs': {
        const poly = geom.type === 'Polygon' ? ringToLatLngs(geom.coordinates[0]) : [];
        const path = geom.type === 'LineString' ? ringToLatLngs(geom.coordinates) : [];
        features.push({
          ...base,
          id: nextId('stairs'),
          type: 'stairs',
          polygon: poly,
          path,
          oneway: parseOneway(props),
        } satisfies IndoorStairs);
        break;
      }

      case 'elevator': {
        if (geom.type === 'Point') {
          features.push({
            ...base,
            id: nextId('elevator'),
            type: 'elevator',
            position: toLatLng(geom.coordinates as GeoCoord),
          } satisfies IndoorElevator);
        }
        // LineString elevator edges are handled as graph edges, not standalone features
        break;
      }

      case 'escalator': {
        const poly = geom.type === 'Polygon' ? ringToLatLngs(geom.coordinates[0]) : [];
        const path = geom.type === 'LineString' ? ringToLatLngs(geom.coordinates) : [];
        features.push({
          ...base,
          id: nextId('escalator'),
          type: 'escalator',
          polygon: poly,
          path,
          oneway: parseOneway(props),
        } satisfies IndoorEscalator);
        break;
      }

      case 'door': {
        if (geom.type === 'Point') {
          features.push({
            ...base,
            id: nextId('door'),
            type: 'door',
            position: toLatLng(geom.coordinates as GeoCoord),
            doorKind: props.door ?? null,
            isEntrance: props.entrance === 'yes' || props.entrance === 'staircase',
          } satisfies IndoorDoor);
        }
        break;
      }

      case 'poi': {
        if (geom.type === 'Point') {
          features.push({
            ...base,
            id: nextId('poi'),
            type: 'poi',
            position: toLatLng(geom.coordinates as GeoCoord),
            amenity: props.amenity ?? 'unknown',
            name: props.name ?? null,
          } satisfies IndoorPOI);
        }
        break;
      }

      case 'level_outline': {
        if (geom.type === 'Polygon') {
          features.push({
            ...base,
            id: nextId('level'),
            type: 'level_outline',
            polygon: ringToLatLngs(geom.coordinates[0]),
            name: props.name ?? null,
          } satisfies IndoorLevelOutline);
        }
        break;
      }

      case 'area': {
        if (geom.type === 'Polygon') {
          features.push({
            ...base,
            id: nextId('area'),
            type: 'area',
            polygon: ringToLatLngs(geom.coordinates[0]),
          } satisfies IndoorArea);
        }
        break;
      }

      default:
        // Unknown features can be extended later.
        // We intentionally skip them for now to keep the feature list clean.
        break;
    }
  }

  return features;
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
