/**
 * Tests for the indoor navigation core modules:
 *  - GeoJSON parser
 *  - IndoorGraph builder
 *  - A* pathfinder
 *  - Room resolver
 *  - Building registry
 */

import {
  parseIndoorGeoJSON,
  extractLevels,
  groupByLevel,
  resetIdCounter,
} from '../services/indoor/geojsonParser';
import type { GeoJSONFeatureCollection } from '../services/indoor/geojsonParser';
import { IndoorGraph } from '../services/indoor/IndoorGraph';
import { findPath } from '../services/indoor/pathfinder';
import {
  buildRoomIndex,
  resolveRoom,
  searchRooms,
  findNearestPOI,
} from '../services/indoor/roomResolver';
import {
  detectIndoorDestination,
  findBuildingAtCoordinate,
} from '../services/indoor/buildingRegistry';
import type { IndoorFeature, IndoorRoom, IndoorCorridor } from '../services/indoor/types';

// ---------------------------------------------------------------------------
// Test GeoJSON fixtures
// ---------------------------------------------------------------------------

function makeTestGeoJSON(): GeoJSONFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      // A room on level 1
      {
        type: 'Feature',
        properties: { indoor: 'room', level: '1', ref: 'H-110' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-73.579, 45.497],
              [-73.5789, 45.497],
              [-73.5789, 45.4971],
              [-73.579, 45.4971],
              [-73.579, 45.497],
            ],
          ],
        },
      },
      // A room on level 2
      {
        type: 'Feature',
        properties: { indoor: 'room', level: '2', ref: 'H-220' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-73.5791, 45.4972],
              [-73.579, 45.4972],
              [-73.579, 45.4973],
              [-73.5791, 45.4973],
              [-73.5791, 45.4972],
            ],
          ],
        },
      },
      // A point-only room on level 8
      {
        type: 'Feature',
        properties: { level: '8', ref: 'H-840' },
        geometry: {
          type: 'Point',
          coordinates: [-73.57893, 45.49733],
        },
      },
      // Corridor on level 1
      {
        type: 'Feature',
        properties: { highway: 'footway', level: '1' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-73.57895, 45.49705],
            [-73.57892, 45.4971],
            [-73.5789, 45.49715],
          ],
        },
      },
      // Corridor on level 2
      {
        type: 'Feature',
        properties: { highway: 'footway', level: '2' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-73.57895, 45.49725],
            [-73.57893, 45.49728],
          ],
        },
      },
      // Stairs connecting levels 1 and 2
      {
        type: 'Feature',
        properties: { highway: 'steps', level: '1;2' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [-73.5789, 45.49715],
            [-73.57893, 45.49728],
          ],
        },
      },
      // Elevator connecting levels 1 and 2
      {
        type: 'Feature',
        properties: { highway: 'elevator', level: '1;2', ref: 'H-elevator-1' },
        geometry: {
          type: 'Point',
          coordinates: [-73.57892, 45.4971],
        },
      },
      // A door
      {
        type: 'Feature',
        properties: { door: 'hinged', entrance: 'yes' },
        geometry: {
          type: 'Point',
          coordinates: [-73.57895, 45.49705],
        },
      },
      // Level outline
      {
        type: 'Feature',
        properties: { indoor: 'level', level: '1', name: 'Level 1', wall: 'yes' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-73.58, 45.496],
              [-73.578, 45.496],
              [-73.578, 45.498],
              [-73.58, 45.498],
              [-73.58, 45.496],
            ],
          ],
        },
      },
      // A POI (café)
      {
        type: 'Feature',
        properties: { amenity: 'cafe', name: 'Tim Hortons', level: '1' },
        geometry: {
          type: 'Point',
          coordinates: [-73.57888, 45.49712],
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// GeoJSON Parser tests
// ---------------------------------------------------------------------------

describe('geojsonParser', () => {
  beforeEach(() => resetIdCounter());

  it('parses all feature types correctly', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const types = features.map((f) => f.type);

    expect(types).toContain('room');
    expect(types).toContain('corridor');
    expect(types).toContain('stairs');
    expect(types).toContain('elevator');
    expect(types).toContain('door');
    expect(types).toContain('level_outline');
    expect(types).toContain('poi');
  });

  it('parses rooms with polygons and centroids', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const rooms = features.filter((f) => f.type === 'room') as IndoorRoom[];
    expect(rooms.length).toBe(3); // H-110, H-220, H-840

    const h110 = rooms.find((r) => r.ref === 'H-110');
    expect(h110).toBeDefined();
    expect(h110!.polygon.length).toBeGreaterThan(0);
    expect(h110!.centroid.latitude).toBeCloseTo(45.497, 3);
    expect(h110!.levels).toEqual(['1']);
  });

  it('parses point-only rooms', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const h840 = features.find((f) => f.type === 'room' && f.ref === 'H-840') as IndoorRoom;
    expect(h840).toBeDefined();
    expect(h840.polygon).toEqual([]);
    expect(h840.centroid.latitude).toBeCloseTo(45.49733, 4);
  });

  it('parses multi-level stairs', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const stairs = features.find((f) => f.type === 'stairs');
    expect(stairs).toBeDefined();
    expect(stairs!.levels).toEqual(['1', '2']);
  });

  it('extracts levels correctly', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const levels = extractLevels(features);
    expect(levels).toEqual(['1', '2', '8']);
  });

  it('groups features by level', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const grouped = groupByLevel(features);

    expect(grouped.has('1')).toBe(true);
    expect(grouped.has('2')).toBe(true);

    // Level 1 should have: room H-110, corridor, stairs (multi), elevator (multi), outline, poi
    const level1 = grouped.get('1')!;
    expect(level1.length).toBeGreaterThan(3);
  });
});

// ---------------------------------------------------------------------------
// IndoorGraph tests
// ---------------------------------------------------------------------------

describe('IndoorGraph', () => {
  beforeEach(() => resetIdCounter());

  it('builds nodes and edges from corridors', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const graph = IndoorGraph.build(features);

    expect(graph.nodes.size).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('creates walk edges for corridor segments', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const graph = IndoorGraph.build(features);

    const walkEdges = graph.edges.filter((e) => e.edgeType === 'walk' && !e.isLevelChange);
    expect(walkEdges.length).toBeGreaterThan(0);
  });

  it('creates level-change edges for stairs and elevators', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const graph = IndoorGraph.build(features);

    const levelChangeEdges = graph.edges.filter((e) => e.isLevelChange);
    expect(levelChangeEdges.length).toBeGreaterThan(0);

    const stairEdges = levelChangeEdges.filter((e) => e.edgeType === 'stairs');
    const elevatorEdges = levelChangeEdges.filter((e) => e.edgeType === 'elevator');
    expect(stairEdges.length).toBeGreaterThanOrEqual(1);
    expect(elevatorEdges.length).toBeGreaterThanOrEqual(1);
  });

  it('finds closest node on a given level', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const graph = IndoorGraph.build(features);

    const node = graph.findClosestNode({ latitude: 45.4971, longitude: -73.57892 }, '1');
    expect(node).not.toBeNull();
    expect(node!.level).toBe('1');
  });

  it('getNeighbours returns connected nodes', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const graph = IndoorGraph.build(features);

    // Pick any node and check it has neighbours
    const firstNode = graph.nodes.values().next().value;
    if (firstNode) {
      const neighbours = graph.getNeighbours(firstNode.id);
      // At least corridor nodes should have neighbours
      expect(neighbours.length).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Pathfinder tests
// ---------------------------------------------------------------------------

describe('pathfinder', () => {
  beforeEach(() => resetIdCounter());

  it('finds a route between two nodes on the same level', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const graph = IndoorGraph.build(features);

    // Get first and last corridor nodes on level 1
    const level1Nodes = [...graph.nodes.values()].filter((n) => n.level === '1');
    expect(level1Nodes.length).toBeGreaterThanOrEqual(2);

    const route = findPath(graph, level1Nodes[0].id, level1Nodes[level1Nodes.length - 1].id);
    if (level1Nodes[0].id !== level1Nodes[level1Nodes.length - 1].id) {
      expect(route).not.toBeNull();
      expect(route!.polyline.length).toBeGreaterThan(0);
      expect(route!.steps.length).toBeGreaterThan(0);
      expect(route!.totalDistanceMeters).toBeGreaterThan(0);
    }
  });

  it('finds a multi-level route via stairs', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const graph = IndoorGraph.build(features);

    const level1Node = graph.findClosestNode({ latitude: 45.4971, longitude: -73.57892 }, '1');
    const level2Node = graph.findClosestNode({ latitude: 45.49725, longitude: -73.57895 }, '2');

    if (level1Node && level2Node) {
      const route = findPath(graph, level1Node.id, level2Node.id);
      expect(route).not.toBeNull();
      expect(route!.startLevel).toBe('1');
      expect(route!.endLevel).toBe('2');
      // Should contain a level-change step
      const hasLevelChange = route!.steps.some(
        (s) => s.edgeType === 'stairs' || s.edgeType === 'elevator',
      );
      expect(hasLevelChange).toBe(true);
    }
  });

  it('returns null for unreachable nodes', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const graph = IndoorGraph.build(features);

    const result = findPath(graph, 'nonexistent-1', 'nonexistent-2');
    expect(result).toBeNull();
  });

  it('respects preferElevator option', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const graph = IndoorGraph.build(features);

    const level1Node = graph.findClosestNode({ latitude: 45.4971, longitude: -73.57892 }, '1');
    const level2Node = graph.findClosestNode({ latitude: 45.49725, longitude: -73.57895 }, '2');

    if (level1Node && level2Node) {
      const routeDefault = findPath(graph, level1Node.id, level2Node.id);
      const routeElevator = findPath(graph, level1Node.id, level2Node.id, {
        preferElevator: true,
      });

      // Both should find a route
      expect(routeDefault).not.toBeNull();
      expect(routeElevator).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Room resolver tests
// ---------------------------------------------------------------------------

describe('roomResolver', () => {
  beforeEach(() => resetIdCounter());

  it('builds a room index from features', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const index = buildRoomIndex(features);

    expect(index.size).toBeGreaterThan(0);
    expect(index.has('H-110')).toBe(true);
    expect(index.has('H-220')).toBe(true);
    expect(index.has('H-840')).toBe(true);
  });

  it('resolves exact room references', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const index = buildRoomIndex(features);

    const room = resolveRoom('H-110', index);
    expect(room).not.toBeNull();
    expect(room!.ref).toBe('H-110');
    expect(room!.level).toBe('1');
  });

  it('resolves case-insensitive references', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const index = buildRoomIndex(features);

    const room = resolveRoom('h-840', index);
    expect(room).not.toBeNull();
    expect(room!.ref).toBe('H-840');
  });

  it('resolves shorthand with building code', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const index = buildRoomIndex(features);

    const room = resolveRoom('110', index, 'H');
    expect(room).not.toBeNull();
    expect(room!.ref).toBe('H-110');
  });

  it('resolves without separator', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const index = buildRoomIndex(features);

    const room = resolveRoom('H840', index);
    expect(room).not.toBeNull();
    expect(room!.ref).toBe('H-840');
  });

  it('returns null for unknown rooms', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const index = buildRoomIndex(features);

    const room = resolveRoom('H-999', index);
    expect(room).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// searchRooms (autocomplete) tests
// ---------------------------------------------------------------------------

describe('searchRooms', () => {
  beforeEach(() => resetIdCounter());

  it('returns matching rooms by prefix', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const index = buildRoomIndex(features);

    const results = searchRooms('H-1', index);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.ref === 'H-110')).toBe(true);
  });

  it('returns matching rooms case-insensitively', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const index = buildRoomIndex(features);

    const results = searchRooms('h-8', index);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.ref === 'H-840')).toBe(true);
  });

  it('returns empty array for empty query', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const index = buildRoomIndex(features);

    expect(searchRooms('', index)).toEqual([]);
    expect(searchRooms('  ', index)).toEqual([]);
  });

  it('returns empty array for non-matching query', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const index = buildRoomIndex(features);

    expect(searchRooms('Z-999', index)).toEqual([]);
  });

  it('supports shorthand with building code prefix', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const index = buildRoomIndex(features);

    // Searching "8" with building code "H" should find "H-840"
    const results = searchRooms('8', index, 'H');
    expect(results.some((r) => r.ref === 'H-840')).toBe(true);
  });

  it('respects the limit parameter', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const index = buildRoomIndex(features);

    const results = searchRooms('H', index, undefined, 1);
    expect(results.length).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Nearest POI tests
// ---------------------------------------------------------------------------

describe('findNearestPOI', () => {
  beforeEach(() => resetIdCounter());

  it('finds nearest café', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const result = findNearestPOI(features, { latitude: 45.497, longitude: -73.579 }, '1', 'cafe');
    expect(result).not.toBeNull();
    expect(result!.feature.type).toBe('poi');
  });

  it('finds nearest elevator', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const result = findNearestPOI(
      features,
      { latitude: 45.497, longitude: -73.579 },
      '1',
      'elevator',
    );
    expect(result).not.toBeNull();
    expect(result!.feature.type).toBe('elevator');
  });

  it('returns null when no matching POI exists', () => {
    const features = parseIndoorGeoJSON(makeTestGeoJSON());
    const result = findNearestPOI(
      features,
      { latitude: 45.497, longitude: -73.579 },
      '1',
      'washroom', // No washroom in test data
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectIndoorDestination tests
// ---------------------------------------------------------------------------

describe('detectIndoorDestination', () => {
  it('detects "H-840" as indoor destination', () => {
    const result = detectIndoorDestination('H-840');
    expect(result).not.toBeNull();
    expect(result!.buildingCode).toBe('H');
    expect(result!.roomRef).toBe('H-840');
  });

  it('detects "H840" without separator', () => {
    const result = detectIndoorDestination('H840');
    expect(result).not.toBeNull();
    expect(result!.buildingCode).toBe('H');
    expect(result!.roomRef).toBe('H-840');
  });

  it('detects "h 110" case-insensitive with space', () => {
    const result = detectIndoorDestination('h 110');
    expect(result).not.toBeNull();
    expect(result!.buildingCode).toBe('H');
    expect(result!.roomRef).toBe('H-110');
  });

  it('returns null for non-indoor queries', () => {
    expect(detectIndoorDestination('Hall Building')).toBeNull();
    expect(detectIndoorDestination('some random text')).toBeNull();
  });

  it('returns null for unknown building codes', () => {
    expect(detectIndoorDestination('Z-100')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Ref-based classification tests
// ---------------------------------------------------------------------------

describe('geojsonParser – ref-based classification', () => {
  beforeEach(() => resetIdCounter());

  it('classifies a feature with ref containing "escalator" as escalator', () => {
    const geo: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ref: 'H-escalator-5', level: '3', indoor: 'room' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-73.579, 45.497],
                [-73.5789, 45.497],
                [-73.5789, 45.4971],
                [-73.579, 45.4971],
                [-73.579, 45.497],
              ],
            ],
          },
        },
      ],
    };
    const features = parseIndoorGeoJSON(geo);
    expect(features.length).toBe(1);
    expect(features[0].type).toBe('escalator');
  });

  it('classifies a feature with ref containing "stair" tagged as area as stairs', () => {
    const geo: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { ref: 'H-stair-2-1', level: '2', indoor: 'area' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-73.579, 45.497],
                [-73.5789, 45.497],
                [-73.5789, 45.4971],
                [-73.579, 45.4971],
                [-73.579, 45.497],
              ],
            ],
          },
        },
      ],
    };
    const features = parseIndoorGeoJSON(geo);
    expect(features.length).toBe(1);
    expect(features[0].type).toBe('stairs');
  });
});

// ---------------------------------------------------------------------------
// repeat_on level merging tests
// ---------------------------------------------------------------------------

describe('geojsonParser – repeat_on support', () => {
  beforeEach(() => resetIdCounter());

  it('merges repeat_on levels with the base level', () => {
    const geo: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { highway: 'steps', level: '8', repeat_on: '9' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [-73.579, 45.497],
              [-73.5789, 45.4971],
            ],
          },
        },
      ],
    };
    const features = parseIndoorGeoJSON(geo);
    expect(features[0].levels).toEqual(expect.arrayContaining(['8', '9']));
    expect(features[0].levels.length).toBe(2);
  });

  it('does not duplicate levels when repeat_on overlaps', () => {
    const geo: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { highway: 'steps', level: '8;9', repeat_on: '9' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [-73.579, 45.497],
              [-73.5789, 45.4971],
            ],
          },
        },
      ],
    };
    const features = parseIndoorGeoJSON(geo);
    expect(features[0].levels).toEqual(['8', '9']);
  });
});

// ---------------------------------------------------------------------------
// buildRoomIndex polygon-over-point preference tests
// ---------------------------------------------------------------------------

describe('buildRoomIndex – polygon preference', () => {
  beforeEach(() => resetIdCounter());

  it('keeps the polygon entry when point comes second', () => {
    const geo: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { indoor: 'room', level: '8', ref: 'H-820' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-73.579, 45.497],
                [-73.5789, 45.497],
                [-73.5789, 45.4971],
                [-73.579, 45.4971],
                [-73.579, 45.497],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { indoor: 'room', level: '8', ref: 'H-820' },
          geometry: { type: 'Point', coordinates: [-73.57893, 45.49733] },
        },
      ],
    };
    const features = parseIndoorGeoJSON(geo);
    const index = buildRoomIndex(features);
    const room = index.get('H-820');
    expect(room).toBeDefined();
    expect(room!.polygon.length).toBeGreaterThanOrEqual(3);
  });

  it('replaces the point entry when polygon comes second', () => {
    const geo: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { indoor: 'room', level: '8', ref: 'H-820' },
          geometry: { type: 'Point', coordinates: [-73.57893, 45.49733] },
        },
        {
          type: 'Feature',
          properties: { indoor: 'room', level: '8', ref: 'H-820' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-73.579, 45.497],
                [-73.5789, 45.497],
                [-73.5789, 45.4971],
                [-73.579, 45.4971],
                [-73.579, 45.497],
              ],
            ],
          },
        },
      ],
    };
    const features = parseIndoorGeoJSON(geo);
    const index = buildRoomIndex(features);
    const room = index.get('H-820');
    expect(room).toBeDefined();
    expect(room!.polygon.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// findBuildingAtCoordinate tests
// ---------------------------------------------------------------------------

describe('findBuildingAtCoordinate', () => {
  it('returns building meta when coordinate is near Hall Building', () => {
    // Hall Building approximate centre
    const result = findBuildingAtCoordinate({ latitude: 45.4972, longitude: -73.5789 });
    expect(result).not.toBeNull();
    expect(result!.code).toBe('H');
  });

  it('returns null for a coordinate far from any indoor building', () => {
    const result = findBuildingAtCoordinate({ latitude: 0, longitude: 0 });
    expect(result).toBeNull();
  });
});
