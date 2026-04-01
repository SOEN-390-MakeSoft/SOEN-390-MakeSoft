import type { IndoorRoom, IndoorRoute, LatLng } from '../../../services/indoor/types';

function compareLevelTokens(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function toNormalizedLevelKey(levels: readonly string[]): string {
  return [...new Set(levels)].sort(compareLevelTokens).join('|');
}

export function getRouteSegmentsOnLevel(route: IndoorRoute | null, activeLevel: string): LatLng[] {
  if (!route) return [];

  return route.steps
    .filter((step) => step.fromLevel === activeLevel && step.toLevel === activeLevel)
    .flatMap((step) => step.path);
}

export function computeLevelCentroid(rooms: IndoorRoom[]): LatLng | null {
  let latitudeSum = 0;
  let longitudeSum = 0;
  let count = 0;

  for (const room of rooms) {
    latitudeSum += room.centroid.latitude;
    longitudeSum += room.centroid.longitude;
    count += 1;
  }

  return count > 0
    ? {
        latitude: latitudeSum / count,
        longitude: longitudeSum / count,
      }
    : null;
}

export function getFilteredRooms(rooms: IndoorRoom[], levelCentroid: LatLng | null): IndoorRoom[] {
  return rooms.filter((room) => {
    if (!room.ref || !levelCentroid) return true;

    if (/elevator/i.test(room.ref)) {
      const siblings = rooms.filter((candidate) => candidate.ref === room.ref);
      if (siblings.length > 1) {
        const bestSibling = siblings.reduce((best, candidate) => {
          const bestDistanceSquared =
            Math.pow(best.centroid.latitude - levelCentroid.latitude, 2) +
            Math.pow(best.centroid.longitude - levelCentroid.longitude, 2);
          const candidateDistanceSquared =
            Math.pow(candidate.centroid.latitude - levelCentroid.latitude, 2) +
            Math.pow(candidate.centroid.longitude - levelCentroid.longitude, 2);

          return candidateDistanceSquared < bestDistanceSquared ? candidate : best;
        }, siblings[0]);

        return room.id === bestSibling.id;
      }
    }

    return true;
  });
}
