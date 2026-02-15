export type LatLng = { latitude: number; longitude: number };

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
    if (points.length === 0) return DEFAULT_REGION;
    const sum = points.reduce(
        (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
        { latitude: 0, longitude: 0 }
    );
    return { latitude: sum.latitude / points.length, longitude: sum.longitude / points.length };
}

/**
 * Formats address from building record into readable string
 * @param record Building record with address components
 * @returns Formatted address string or null
 */
export function formatAddress(record: { housenumber?: string; street?: string }): string | null {
    const parts = [record.housenumber, record.street].filter(Boolean);
    return parts.length ? parts.join(" ") : null;
}

/**
 * Ray-casting point-in-polygon test.
 * @param point Coordinate to test
 * @param polygon Polygon vertices (closed or open)
 * @returns true if point is inside the polygon
 */
export function pointInPolygon(point: LatLng, polygon: readonly LatLng[]): boolean {
    const { latitude: y, longitude: x } = point;
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i].longitude;
        const yi = polygon[i].latitude;
        const xj = polygon[j].longitude;
        const yj = polygon[j].latitude;
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
    const inside = buildings.find((b) => pointInPolygon(point, b.polygon));
    if (inside) return inside;

    let closest: BuildingWithPolygon | null = null;
    let minDist = maxDistanceMeters;
    for (const building of buildings) {
        const centroid = polygonCentroid(building.polygon);
        const d = distanceMeters(point, centroid);
        if (d < minDist) {
            minDist = d;
            closest = building;
        }
    }
    return closest;
}
