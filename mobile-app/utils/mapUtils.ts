type LatLng = { latitude: number; longitude: number };

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
