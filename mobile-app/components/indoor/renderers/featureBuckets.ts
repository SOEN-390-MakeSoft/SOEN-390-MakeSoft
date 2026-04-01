import type {
  IndoorArea,
  IndoorEscalator,
  IndoorElevator,
  IndoorFeature,
  IndoorLevelOutline,
  IndoorPOI,
  IndoorRoom,
  IndoorStairs,
} from '../../../services/indoor/types';

export type IndoorFeatureBuckets = {
  outlines: IndoorLevelOutline[];
  areas: IndoorArea[];
  rooms: IndoorRoom[];
  stairs: IndoorStairs[];
  escalators: IndoorEscalator[];
  elevators: IndoorElevator[];
  pois: IndoorPOI[];
};

export function categorizeIndoorFeatures(features: IndoorFeature[]): IndoorFeatureBuckets {
  const buckets: IndoorFeatureBuckets = {
    outlines: [],
    areas: [],
    rooms: [],
    stairs: [],
    escalators: [],
    elevators: [],
    pois: [],
  };

  for (const feature of features) {
    switch (feature.type) {
      case 'level_outline':
        buckets.outlines.push(feature);
        break;
      case 'area':
        buckets.areas.push(feature);
        break;
      case 'room':
        buckets.rooms.push(feature);
        break;
      case 'stairs':
        buckets.stairs.push(feature);
        break;
      case 'escalator':
        buckets.escalators.push(feature);
        break;
      case 'elevator':
        buckets.elevators.push(feature);
        break;
      case 'poi':
        buckets.pois.push(feature);
        break;
      default:
        break;
    }
  }

  return buckets;
}
