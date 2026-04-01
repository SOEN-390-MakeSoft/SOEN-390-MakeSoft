import type {
  IndoorArea,
  IndoorEscalator,
  IndoorElevator,
  IndoorFeature,
  IndoorLevelOutline,
  IndoorPOI,
  IndoorRoom,
  IndoorRoute,
  IndoorStairs,
  LatLng,
} from '../services/indoor/types';
import { categorizeIndoorFeatures } from '../components/indoor/renderers/featureBuckets';
import {
  computeLevelCentroid,
  getFilteredRooms,
  getRouteSegmentsOnLevel,
  toNormalizedLevelKey,
} from '../components/indoor/renderers/renderingRules';

function makeSquare(center: LatLng, delta = 0.0001): LatLng[] {
  return [
    { latitude: center.latitude + delta, longitude: center.longitude - delta },
    { latitude: center.latitude + delta, longitude: center.longitude + delta },
    { latitude: center.latitude - delta, longitude: center.longitude + delta },
    { latitude: center.latitude - delta, longitude: center.longitude - delta },
  ];
}

function makeRoom(id: string, ref: string | null, center: LatLng): IndoorRoom {
  return {
    id,
    type: 'room',
    levels: ['1'],
    ref,
    raw: {},
    polygon: makeSquare(center),
    centroid: center,
  };
}

describe('indoor overlay rendering rules', () => {
  it('categorizes mixed indoor features into type buckets', () => {
    const outline: IndoorLevelOutline = {
      id: 'outline-1',
      type: 'level_outline',
      levels: ['1'],
      ref: null,
      raw: {},
      polygon: makeSquare({ latitude: 45.5, longitude: -73.57 }),
      name: null,
    };

    const area: IndoorArea = {
      id: 'area-1',
      type: 'area',
      levels: ['1'],
      ref: null,
      raw: {},
      polygon: makeSquare({ latitude: 45.5002, longitude: -73.5702 }),
    };

    const room = makeRoom('room-1', 'H-840', { latitude: 45.5004, longitude: -73.5704 });

    const stairs: IndoorStairs = {
      id: 'stairs-1',
      type: 'stairs',
      levels: ['1', '2'],
      ref: 'stairs-a',
      raw: {},
      polygon: makeSquare({ latitude: 45.5006, longitude: -73.5706 }),
      path: [
        { latitude: 45.5006, longitude: -73.5706 },
        { latitude: 45.5007, longitude: -73.5707 },
      ],
      oneway: null,
    };

    const escalator: IndoorEscalator = {
      id: 'esc-1',
      type: 'escalator',
      levels: ['1', '2'],
      ref: 'escalator-a',
      raw: {},
      polygon: makeSquare({ latitude: 45.5008, longitude: -73.5708 }),
      path: [
        { latitude: 45.5008, longitude: -73.5708 },
        { latitude: 45.5009, longitude: -73.5709 },
      ],
      oneway: null,
    };

    const elevator: IndoorElevator = {
      id: 'elev-1',
      type: 'elevator',
      levels: ['1', '2'],
      ref: 'H-ELEVATOR-A',
      raw: {},
      position: { latitude: 45.501, longitude: -73.571 },
    };

    const poi: IndoorPOI = {
      id: 'poi-1',
      type: 'poi',
      levels: ['1'],
      ref: null,
      raw: {},
      amenity: 'toilets',
      name: 'Washroom',
      position: { latitude: 45.5012, longitude: -73.5712 },
    };

    const buckets = categorizeIndoorFeatures([
      outline,
      area,
      room,
      stairs,
      escalator,
      elevator,
      poi,
    ] as IndoorFeature[]);

    expect(buckets.outlines).toHaveLength(1);
    expect(buckets.areas).toHaveLength(1);
    expect(buckets.rooms).toHaveLength(1);
    expect(buckets.stairs).toHaveLength(1);
    expect(buckets.escalators).toHaveLength(1);
    expect(buckets.elevators).toHaveLength(1);
    expect(buckets.pois).toHaveLength(1);
  });

  it('keeps only the closest duplicated elevator room on the same level centroid', () => {
    const nearElevator = makeRoom('r1', 'elevator-a', { latitude: 45.5, longitude: -73.57 });
    const farElevator = makeRoom('r2', 'elevator-a', { latitude: 45.51, longitude: -73.58 });
    const normalRoom = makeRoom('r3', 'H-840', { latitude: 45.5005, longitude: -73.5705 });

    const filtered = getFilteredRooms([nearElevator, farElevator, normalRoom], {
      latitude: 45.5001,
      longitude: -73.5701,
    });

    expect(filtered.map((room) => room.id)).toEqual(expect.arrayContaining(['r1', 'r3']));
    expect(filtered.map((room) => room.id)).not.toContain('r2');
  });

  it('returns only route segments that stay on the active level', () => {
    const route: IndoorRoute = {
      totalDistanceMeters: 30,
      totalEstimatedSeconds: 45,
      nodeIds: ['a', 'b', 'c', 'd'],
      polyline: [],
      steps: [
        {
          instruction: 'Walk on level 1',
          fromLevel: '1',
          toLevel: '1',
          path: [
            { latitude: 45.5, longitude: -73.57 },
            { latitude: 45.5001, longitude: -73.5701 },
          ],
          distanceMeters: 10,
          estimatedSeconds: 15,
          edgeType: 'walk',
        },
        {
          instruction: 'Take stairs to level 2',
          fromLevel: '1',
          toLevel: '2',
          path: [
            { latitude: 45.5001, longitude: -73.5701 },
            { latitude: 45.5002, longitude: -73.5702 },
          ],
          distanceMeters: 5,
          estimatedSeconds: 8,
          edgeType: 'stairs',
        },
        {
          instruction: 'Walk on level 2',
          fromLevel: '2',
          toLevel: '2',
          path: [
            { latitude: 45.5002, longitude: -73.5702 },
            { latitude: 45.5003, longitude: -73.5703 },
          ],
          distanceMeters: 15,
          estimatedSeconds: 22,
          edgeType: 'walk',
        },
      ],
      startLevel: '1',
      endLevel: '2',
    };

    const levelOnePath = getRouteSegmentsOnLevel(route, '1');
    const levelTwoPath = getRouteSegmentsOnLevel(route, '2');

    expect(levelOnePath).toEqual([
      { latitude: 45.5, longitude: -73.57 },
      { latitude: 45.5001, longitude: -73.5701 },
    ]);

    expect(levelTwoPath).toEqual([
      { latitude: 45.5002, longitude: -73.5702 },
      { latitude: 45.5003, longitude: -73.5703 },
    ]);
  });

  it('computes level centroid and handles empty room lists', () => {
    const centroid = computeLevelCentroid([
      makeRoom('r1', 'H-840', { latitude: 45.5, longitude: -73.57 }),
      makeRoom('r2', 'H-841', { latitude: 45.501, longitude: -73.571 }),
    ]);

    expect(centroid).toEqual({
      latitude: 45.5005,
      longitude: -73.5705,
    });

    expect(computeLevelCentroid([])).toBeNull();
  });

  it('normalizes level sets so order does not affect equality', () => {
    expect(toNormalizedLevelKey(['2', '1', 'B1', '2'])).toBe(
      toNormalizedLevelKey(['B1', '1', '2']),
    );
    expect(toNormalizedLevelKey(['1', '2'])).toBe('1|2');
  });
});
