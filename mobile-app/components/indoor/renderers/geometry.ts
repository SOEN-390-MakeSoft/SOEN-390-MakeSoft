import type { LatLng } from '../../../services/indoor/types';

export function calculatePolygonCentroid(polygon: LatLng[]): LatLng {
  const sum = polygon.reduce(
    (accumulator, point) => ({
      latitude: accumulator.latitude + point.latitude,
      longitude: accumulator.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: sum.latitude / polygon.length,
    longitude: sum.longitude / polygon.length,
  };
}
