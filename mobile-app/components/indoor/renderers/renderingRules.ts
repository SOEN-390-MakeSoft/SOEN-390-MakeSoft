import { pointInPolygon } from '../../../utils/mapUtils';
import type {
  IndoorElevator,
  IndoorRoom,
  IndoorRoute,
  LatLng,
} from '../../../services/indoor/types';

function compareLevelTokens(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function toNormalizedLevelKey(levels: readonly string[]): string {
  return [...new Set(levels)].sort(compareLevelTokens).join('|');
}

function squaredDistance(a: LatLng, b: LatLng): number {
  return Math.pow(a.latitude - b.latitude, 2) + Math.pow(a.longitude - b.longitude, 2);
}

function groupElevators(elevators: IndoorElevator[]): IndoorElevator[][] {
  const groupedElevators: IndoorElevator[][] = [];

  for (const elevator of elevators) {
    let foundGroup = false;
    for (const group of groupedElevators) {
      const leader = group[0];
      const sameRef = elevator.ref && leader.ref && elevator.ref === leader.ref;
      const sameLevels =
        toNormalizedLevelKey(elevator.levels) === toNormalizedLevelKey(leader.levels);
      const isClose = squaredDistance(elevator.position, leader.position) < 0.0000005;

      if (sameRef || (sameLevels && isClose)) {
        group.push(elevator);
        foundGroup = true;
        break;
      }
    }

    if (!foundGroup) groupedElevators.push([elevator]);
  }

  return groupedElevators;
}

export function getDisplayedElevators({
  elevators,
  rooms,
  filteredRooms,
  levelCentroid,
}: {
  elevators: IndoorElevator[];
  rooms: IndoorRoom[];
  filteredRooms: IndoorRoom[];
  levelCentroid: LatLng | null;
}): IndoorElevator[] {
  const isHallBuilding =
    elevators.some((elevator) => elevator.ref?.startsWith('H-')) ||
    rooms.some((room) => room.ref?.startsWith('H-'));

  const bestElevators = isHallBuilding
    ? elevators
    : groupElevators(elevators).map((group) => {
        if (group.length === 1 || !levelCentroid) return group[0];

        return group.reduce(
          (best, candidate) =>
            squaredDistance(candidate.position, levelCentroid) <
            squaredDistance(best.position, levelCentroid)
              ? candidate
              : best,
          group[0],
        );
      });

  const elevatorPolygons = filteredRooms.filter((room) => /elevator/i.test(room.ref || ''));
  if (elevatorPolygons.length === 0) return bestElevators;

  return bestElevators.filter((elevator) =>
    elevatorPolygons.some((room) => pointInPolygon(elevator.position, room.polygon)),
  );
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
