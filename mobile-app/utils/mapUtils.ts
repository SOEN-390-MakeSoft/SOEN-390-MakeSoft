export type LatLng = { latitude: number; longitude: number };
export type CampusName = "SGW" | "Loyola";
export type CampusBounds = {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
};

const DEFAULT_REGION = {
    latitude: 45.4973,
    longitude: -73.5789,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
};

/**
 * Calculates the centroid (center point) of a polygon
 * @param points Array of coordinate points
 * @returns Center coordinate of the polygon
 */
export function polygonCentroid(points: readonly LatLng[]): LatLng {
    if (!points || points.length === 0) return DEFAULT_REGION;

    const validPoints = points.filter(
        (p) => p && p.latitude != null && p.longitude != null
    );
    if (validPoints.length === 0) return DEFAULT_REGION;

    const sum = validPoints.reduce(
        (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
        { latitude: 0, longitude: 0 }
    );
    return { latitude: sum.latitude / validPoints.length, longitude: sum.longitude / validPoints.length };
}

/**
 * Formats address from building record into readable string
 * @param record Building record with address components
 * @returns Formatted address string or null
 */
export function formatAddress(record: { housenumber?: string | number; street?: string }): string | null {
    const parts = [
        record.housenumber != null ? String(record.housenumber) : null,
        record.street,
    ].filter(Boolean);
    return parts.length ? parts.join(" ") : null;
}

/**
 * Ray-casting point-in-polygon test.
 * @param point Coordinate to test
 * @param polygon Polygon vertices (closed or open)
 * @returns true if point is inside the polygon
 */
export function pointInPolygon(point: LatLng, polygon: readonly LatLng[]): boolean {
    if (!point || point.latitude == null || point.longitude == null) return false;
    if (!polygon || polygon.length === 0) return false;

    const { latitude: y, longitude: x } = point;
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const pi = polygon[i];
        const pj = polygon[j];
        if (!pi || !pj || pi.latitude == null || pi.longitude == null || pj.latitude == null || pj.longitude == null) {
            continue;
        }
        const xi = pi.longitude;
        const yi = pi.latitude;
        const xj = pj.longitude;
        const yj = pj.latitude;
        const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

/** Tolerance in degrees for comparing coordinates (≈10 m at equator). */
const COORD_EPSILON = 0.0001;

/**
 * Returns true if two coordinates are effectively the same (within COORD_EPSILON).
 */
export function coordsEqual(a: LatLng, b: LatLng): boolean {
    return (
        Math.abs(a.latitude - b.latitude) < COORD_EPSILON &&
        Math.abs(a.longitude - b.longitude) < COORD_EPSILON
    );
}

/**
 * Approximate distance in meters between two coordinates (Haversine).
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const x =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    return R * c;
}

export type BuildingWithPolygon = {
    id: string;
    name: string;
    code: string | null;
    polygon: readonly LatLng[];
};

/**
 * Finds a campus building at or near the given coordinate.
 * First checks if the point is inside any building polygon; if not, returns the closest building
 * within maxDistanceMeters (by distance to polygon centroid).
 * @param point Tap coordinate
 * @param buildings List of campus buildings
 * @param maxDistanceMeters Max distance in meters to consider "closest" when not inside any polygon
 * @returns The building if found, null otherwise
 */
export function findBuildingAtOrNearCoordinate(
    point: LatLng,
    buildings: readonly BuildingWithPolygon[],
    maxDistanceMeters: number
): BuildingWithPolygon | null {
    if (!point || point.latitude == null || point.longitude == null) return null;
    if (!buildings || buildings.length === 0) return null;

    // Filter buildings with valid polygons
    const validBuildings = buildings.filter(
        (b) => b.polygon && b.polygon.length > 0 && b.polygon.every(
            (p) => p && p.latitude != null && p.longitude != null
        )
    );

    const inside = validBuildings.find((b) => pointInPolygon(point, b.polygon));
    if (inside) return inside;

    let closest: BuildingWithPolygon | null = null;
    let minDist = maxDistanceMeters;
    for (const building of validBuildings) {
        const centroid = polygonCentroid(building.polygon);
        const d = distanceMeters(point, centroid);
        if (d < minDist) {
            minDist = d;
            closest = building;
        }
    }
    return closest;
}

// Bounding boxes for each Concordia campus.
// SGW minLat includes the southern SGW outlier building used in our dataset.
export const SGW_BOUNDS: CampusBounds = { minLat: 45.492, maxLat: 45.500, minLng: -73.582, maxLng: -73.571 };
export const LOYOLA_BOUNDS: CampusBounds = { minLat: 45.454, maxLat: 45.464, minLng: -73.647, maxLng: -73.633 };

function inBounds(point: LatLng, bounds: CampusBounds): boolean {
    return (
        point.latitude >= bounds.minLat &&
        point.latitude <= bounds.maxLat &&
        point.longitude >= bounds.minLng &&
        point.longitude <= bounds.maxLng
    );
}

/**
 * Returns the shortest distance in meters from a point to a campus rectangle border.
 * - If the point is inside: minimum distance to one of the 4 edges.
 * - If outside: distance to the nearest clamped point on the rectangle.
 */
export function distanceToCampusBorderMeters(point: LatLng, bounds: CampusBounds): number {
    if (!point || point.latitude == null || point.longitude == null) {
        return Number.POSITIVE_INFINITY;
    }

    const clampedLat = Math.min(Math.max(point.latitude, bounds.minLat), bounds.maxLat);
    const clampedLng = Math.min(Math.max(point.longitude, bounds.minLng), bounds.maxLng);
    const isInside = inBounds(point, bounds);

    if (!isInside) {
        return distanceMeters(point, { latitude: clampedLat, longitude: clampedLng });
    }

    const northEdge = distanceMeters(point, { latitude: bounds.maxLat, longitude: point.longitude });
    const southEdge = distanceMeters(point, { latitude: bounds.minLat, longitude: point.longitude });
    const eastEdge = distanceMeters(point, { latitude: point.latitude, longitude: bounds.maxLng });
    const westEdge = distanceMeters(point, { latitude: point.latitude, longitude: bounds.minLng });

    return Math.min(northEdge, southEdge, eastEdge, westEdge);
}

/**
 * Returns the campus whose border is closest to the given point.
 */
export function getClosestCampusBorder(point: LatLng): { campus: CampusName; distanceMeters: number } {
    const sgwDistance = distanceToCampusBorderMeters(point, SGW_BOUNDS);
    const loyolaDistance = distanceToCampusBorderMeters(point, LOYOLA_BOUNDS);
    if (sgwDistance <= loyolaDistance) {
        return { campus: "SGW", distanceMeters: sgwDistance };
    }
    return { campus: "Loyola", distanceMeters: loyolaDistance };
}

/**
 * Resolves to the closest campus when the border distance is within threshold.
 */
export function getClosestCampusWithinBorderThreshold(
    point: LatLng,
    thresholdMeters: number
): CampusName | null {
    const closest = getClosestCampusBorder(point);
    return closest.distanceMeters <= thresholdMeters ? closest.campus : null;
}

/**
 * Returns true when origin and destination are on different Concordia campuses
 * (one is at SGW and the other is at Loyola).
 */
export function isCrossCampusRoute(origin: LatLng, destination: LatLng): boolean {
    const originCampus = getCampusFromCoordinate(origin);
    const destinationCampus = getCampusFromCoordinate(destination);
    return (
        (originCampus === "SGW" && destinationCampus === "Loyola") ||
        (originCampus === "Loyola" && destinationCampus === "SGW")
    );
}

/**
 * Resolves a coordinate to SGW/Loyola campus bounds.
 */
export function getCampusFromCoordinate(point: LatLng): CampusName | null {
    if (inBounds(point, SGW_BOUNDS)) return "SGW";
    if (inBounds(point, LOYOLA_BOUNDS)) return "Loyola";
    return null;
}

/**
 * Returns the vertex of a polygon that is closest to the given reference point.
 * Useful for snapping a navigation destination to the building edge (near the
 * street) instead of routing all the way to the interior centroid.
 */
export function nearestPolygonVertex(
    reference: LatLng,
    polygon: readonly LatLng[]
): LatLng {
    if (!polygon || polygon.length === 0) return reference;
    let nearest = polygon[0];
    let minDist = distanceMeters(reference, polygon[0]);
    for (const vertex of polygon) {
        const d = distanceMeters(reference, vertex);
        if (d < minDist) {
            minDist = d;
            nearest = vertex;
        }
    }
    return nearest;
}
