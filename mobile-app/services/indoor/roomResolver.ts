/**
 * Resolves human-readable room references (e.g. "H-840") into geographic
 * coordinates and level information.
 *
 * Also supports nearest-POI queries ("nearest washroom", "nearest café", etc.)
 * which are built on top of the same parsed feature set.
 */

import type { IndoorFeature, IndoorPOI, IndoorRoom, LatLng } from './types';

// ---------------------------------------------------------------------------
// Room resolver
// ---------------------------------------------------------------------------

export interface ResolvedRoom {
  featureId: string;
  ref: string;
  level: string;
  position: LatLng;
  /** The room polygon, empty for point-only rooms. */
  polygon: LatLng[];
}

/**
 * Build an index of room references for fast lookup.
 * Call once per building after parsing.
 */
export function buildRoomIndex(features: IndoorFeature[]): Map<string, ResolvedRoom> {
  const index = new Map<string, ResolvedRoom>();

  for (const f of features) {
    if (f.type !== 'room') continue;
    const room = f as IndoorRoom;
    if (!room.ref) continue;

    // Index by exact ref and also by a normalized version (uppercase, trimmed)
    const key = normalizeRef(room.ref);

    // Prefer the polygon version when both a Polygon and a Point exist for
    // the same ref — the polygon carries the outline needed for highlighting.
    const existing = index.get(key);
    if (existing && existing.polygon.length >= 3 && room.polygon.length < 3) continue;

    index.set(key, {
      featureId: room.id,
      ref: room.ref,
      level: room.levels[0] ?? '0',
      position: room.centroid,
      polygon: room.polygon,
    });
  }

  return index;
}

/**
 * Resolve a room reference to its location.
 *
 * Accepts relaxed input like "H840", "h-840", "H 840", "840" and tries
 * to match against the index.
 */
export function resolveRoom(
  query: string,
  roomIndex: Map<string, ResolvedRoom>,
  buildingCode?: string,
): ResolvedRoom | null {
  const normalized = normalizeRef(query);

  // 1. Exact match
  if (roomIndex.has(normalized)) return roomIndex.get(normalized)!;

  // 2. Try prepending the building code (e.g. "840" → "H-840")
  if (buildingCode) {
    const withCode = normalizeRef(`${buildingCode}-${query}`);
    if (roomIndex.has(withCode)) return roomIndex.get(withCode)!;
  }

  // 3. Fuzzy: strip all non-alphanumeric and try substring match
  const stripped = normalized.replace(/[^A-Z0-9]/g, '');
  for (const [key, value] of roomIndex) {
    const keyStripped = key.replace(/[^A-Z0-9]/g, '');
    if (keyStripped === stripped) return value;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Nearest-POI search
// ---------------------------------------------------------------------------

export type POICategory = 'washroom' | 'cafe' | 'elevator' | 'stairs' | 'any';

/** Map user-facing POI category names to indoor feature tags. */
const POI_TAG_MAP: Record<POICategory, (f: IndoorFeature) => boolean> = {
  washroom: (f) => f.type === 'room' && /bath|wash|wc|toilet|restroom/i.test(f.ref ?? ''),
  cafe: (f) => f.type === 'poi' && (f as IndoorPOI).amenity === 'cafe',
  elevator: (f) => f.type === 'elevator',
  stairs: (f) => f.type === 'stairs',
  any: (f) => f.type === 'poi',
};

export interface NearestPOIResult {
  feature: IndoorFeature;
  distanceMeters: number;
  level: string;
}

/**
 * Find the nearest POI of a given category from a position on a level.
 *
 * If `sameLevel` is true, only considers POIs on the same level.
 */
export function findNearestPOI(
  features: IndoorFeature[],
  from: LatLng,
  fromLevel: string,
  category: POICategory,
  sameLevel = false,
): NearestPOIResult | null {
  const filter = POI_TAG_MAP[category] ?? POI_TAG_MAP.any;
  let best: NearestPOIResult | null = null;

  for (const f of features) {
    if (!filter(f)) continue;
    if (sameLevel && !f.levels.includes(fromLevel)) continue;

    const pos = getFeaturePosition(f);
    if (!pos) continue;

    const dist = haversine(from, pos);
    const level = f.levels[0] ?? '__none__';

    if (!best || dist < best.distanceMeters) {
      best = { feature: f, distanceMeters: dist, level };
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Room search / autocomplete
// ---------------------------------------------------------------------------

/**
 * Search the room index for rooms whose ref partially matches the query.
 *
 * Returns up to `limit` results sorted by best match (exact prefix first,
 * then substring). Useful for autocomplete dropdowns.
 */
export function searchRooms(
  query: string,
  roomIndex: Map<string, ResolvedRoom>,
  buildingCode?: string,
  limit = 10,
): ResolvedRoom[] {
  if (!query.trim()) return [];

  const normalized = normalizeRef(query);
  const stripped = normalized.replace(/[^A-Z0-9]/g, '');

  // Also try with building-code prefix (e.g. "840" → "H-840")
  const withCode = buildingCode ? normalizeRef(`${buildingCode}-${query}`) : null;
  const strippedWithCode = withCode?.replace(/[^A-Z0-9]/g, '') ?? null;

  const prefixMatches: ResolvedRoom[] = [];
  const substringMatches: ResolvedRoom[] = [];

  for (const [key, room] of roomIndex) {
    const keyStripped = key.replace(/[^A-Z0-9]/g, '');

    // Exact prefix match (best)
    if (
      keyStripped.startsWith(stripped) ||
      (strippedWithCode && keyStripped.startsWith(strippedWithCode))
    ) {
      prefixMatches.push(room);
    }
    // Substring match (weaker)
    else if (
      keyStripped.includes(stripped) ||
      (strippedWithCode && keyStripped.includes(strippedWithCode))
    ) {
      substringMatches.push(room);
    }
  }

  return [...prefixMatches, ...substringMatches].slice(0, limit);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeRef(ref: string): string {
  return ref.trim().toUpperCase().replace(/\s+/g, '-');
}

function getFeaturePosition(f: IndoorFeature): LatLng | null {
  switch (f.type) {
    case 'room':
      return (f as IndoorRoom).centroid;
    case 'door':
    case 'elevator':
    case 'poi':
      return (f as { position: LatLng }).position;
    case 'corridor':
      return (f as { path: LatLng[] }).path[0] ?? null;
    case 'stairs':
    case 'escalator':
    case 'area':
    case 'level_outline': {
      const poly = (f as { polygon: LatLng[] }).polygon;
      if (poly.length === 0) return null;
      const sum = poly.reduce(
        (a, p) => ({ latitude: a.latitude + p.latitude, longitude: a.longitude + p.longitude }),
        { latitude: 0, longitude: 0 },
      );
      return { latitude: sum.latitude / poly.length, longitude: sum.longitude / poly.length };
    }
    default:
      return null;
  }
}

function haversine(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
