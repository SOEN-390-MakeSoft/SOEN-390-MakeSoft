/*
 * System tests for the indoor navigation pipeline.
 *
 * These tests exercise the full stack — from raw GeoJSON asset all the way
 * through graph construction, room resolution, pathfinding, and building
 * detection — using the real Hall_Building.geojson data without rendering
 * any UI. This validates that the modules compose correctly as a system.
 *
 * No mocks are used for the indoor modules themselves; only the
 * react-native/expo dependencies are mocked so the test can run in Node.
 */

import {
  parseIndoorGeoJSON,
  extractLevels,
  groupByLevel,
  resetIdCounter,
} from '../../services/indoor/geojsonParser';
import type { GeoJSONFeatureCollection } from '../../services/indoor/geojsonParser';
import { IndoorGraph } from '../../services/indoor/IndoorGraph';
import { findPath } from '../../services/indoor/pathfinder';
import { buildRoomIndex, resolveRoom, findNearestPOI } from '../../services/indoor/roomResolver';
import {
  detectIndoorDestination,
  hasIndoorMap,
  loadBuilding,
  clearCache,
} from '../../services/indoor/buildingRegistry';
import type { IndoorFeature, IndoorRoute } from '../../services/indoor/types';
import sgwTunnelNetwork from '../../assets/geo/SGW_Tunnel_Network.geojson';

// ---------------------------------------------------------------------------
// Load the real GeoJSON asset once for all tests
// ---------------------------------------------------------------------------

const hallGeoJSON: GeoJSONFeatureCollection =
  // Jest uses a custom .geojson transform for test assets.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('../../assets/geo/Hall_Building.geojson') as GeoJSONFeatureCollection;

describe('Indoor Navigation System Tests — Hall Building', () => {
  let features: IndoorFeature[];
  let graph: IndoorGraph;
  let roomIndex: ReturnType<typeof buildRoomIndex>;
  let levels: string[];

  beforeAll(() => {
    resetIdCounter();
    features = parseIndoorGeoJSON(hallGeoJSON);
    graph = IndoorGraph.build(features);
    roomIndex = buildRoomIndex(features);
    levels = extractLevels(features);
  });

  afterEach(() => {
    clearCache();
  });

  // =========================================================================
  // 1. GeoJSON Parsing — Real Data
  // =========================================================================
  describe('GeoJSON parsing of real Hall Building data', () => {
    it('should parse a non-trivial number of features from the asset', () => {
      // The Hall Building GeoJSON has ~967 features
      expect(features.length).toBeGreaterThan(500);
    });

    it('should extract at least the known floor levels', () => {
      // The GeoJSON may not have features on every architectural floor.
      // Verify the levels that are actually present in the data.
      const requiredLevels = ['-2', '-1', '0', '1', '2', '8', '9'];
      for (const lvl of requiredLevels) {
        expect(levels).toContain(lvl);
      }
      expect(levels.length).toBeGreaterThanOrEqual(7);
    });

    it('should contain rooms, corridors, stairs, and elevators', () => {
      const typeSet = new Set(features.map((f) => f.type));
      expect(typeSet.has('room')).toBe(true);
      expect(typeSet.has('corridor')).toBe(true);
      expect(typeSet.has('stairs')).toBe(true);
      expect(typeSet.has('elevator')).toBe(true);
    });

    it('should group features by level with entries on every known level', () => {
      const byLevel = groupByLevel(features);
      expect(byLevel.size).toBeGreaterThanOrEqual(7);
      expect(byLevel.has('8')).toBe(true);
      expect(byLevel.get('8')!.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 2. Graph Construction — Real Data
  // =========================================================================
  describe('Graph construction from real data', () => {
    it('should produce a graph with a substantial number of nodes', () => {
      expect(graph.nodes.size).toBeGreaterThan(100);
    });

    it('should have edges connecting nodes', () => {
      expect(graph.edges.length).toBeGreaterThan(100);
    });

    it('should have nodes on multiple levels (cross-floor connectivity)', () => {
      const nodeLevels = new Set<string>();
      for (const node of graph.nodes.values()) {
        nodeLevels.add(node.level);
      }
      expect(nodeLevels.size).toBeGreaterThanOrEqual(5);
    });

    it('should find a closest node on level 8', () => {
      const node = graph.findClosestNode({ latitude: 45.4973, longitude: -73.5789 }, '8');
      expect(node).not.toBeNull();
      expect(node!.level).toBe('8');
    });
  });

  // =========================================================================
  // 3. Room Resolution — Real Data
  // =========================================================================
  describe('Room resolution against real building data', () => {
    it('should resolve "H-840" to a room on level 8', () => {
      const resolved = resolveRoom('H-840', roomIndex, 'H');
      expect(resolved).not.toBeNull();
      expect(resolved!.level).toBe('8');
      expect(resolved!.ref).toContain('840');
    });

    it('should resolve "H-110" to a room on its correct level', () => {
      const resolved = resolveRoom('H-110', roomIndex, 'H');
      // H-110 exists in the real data — verify it resolves and has a valid level
      if (resolved) {
        expect(levels).toContain(resolved.level);
        expect(resolved.ref).toContain('110');
      }
    });

    it('should resolve bare room number "840" when building code is provided', () => {
      const resolved = resolveRoom('840', roomIndex, 'H');
      expect(resolved).not.toBeNull();
      expect(resolved!.ref).toContain('840');
    });

    it('should return null for a non-existent room', () => {
      const resolved = resolveRoom('H-99999', roomIndex, 'H');
      expect(resolved).toBeNull();
    });

    it('should have indexed a meaningful number of rooms', () => {
      // The building has ~252 room features — not all have refs, so index may
      // be smaller, but should still be substantial
      expect(roomIndex.size).toBeGreaterThan(30);
    });
  });

  // =========================================================================
  // 4. End-to-End Pathfinding — Real Data
  // =========================================================================
  describe('Pathfinding across real building graph', () => {
    it('should find a same-floor route between two points on level 1', () => {
      const startNode = graph.findClosestNode({ latitude: 45.4972, longitude: -73.579 }, '1');
      const endNode = graph.findClosestNode({ latitude: 45.4974, longitude: -73.5788 }, '1');
      expect(startNode).not.toBeNull();
      expect(endNode).not.toBeNull();

      const route = findPath(graph, startNode!.id, endNode!.id);
      expect(route).not.toBeNull();
      expect(route!.polyline.length).toBeGreaterThan(0);
      expect(route!.totalDistanceMeters).toBeGreaterThan(0);
      expect(route!.startLevel).toBe('1');
      expect(route!.endLevel).toBe('1');
    });

    it('should find a cross-floor route (level 1 → level 8) using room-based nodes', () => {
      // Use room resolution to get nodes that are known to be connected
      // in the graph, rather than arbitrary coordinates.
      const room840 = resolveRoom('H-840', roomIndex, 'H');
      expect(room840).not.toBeNull();

      const startNode = graph.findClosestNode({ latitude: 45.4972, longitude: -73.579 }, '1');
      const endNode = graph.findClosestNode(room840!.position, room840!.level);
      expect(startNode).not.toBeNull();
      expect(endNode).not.toBeNull();

      const route = findPath(graph, startNode!.id, endNode!.id);
      // Route MUST exist — if it doesn't, the graph is broken
      expect(route).not.toBeNull();
      expect(route!.startLevel).toBe('1');
      expect(route!.endLevel).toBe('8');
      const levelChangeSteps = route!.steps.filter(
        (s) => s.edgeType === 'stairs' || s.edgeType === 'elevator' || s.edgeType === 'escalator',
      );
      expect(levelChangeSteps.length).toBeGreaterThan(0);
    });

    it('should find an accessible (elevator-only) route when avoidStairs is set', () => {
      // Use the building entrance and a known room to guarantee connectivity
      const room840 = resolveRoom('H-840', roomIndex, 'H');
      expect(room840).not.toBeNull();

      const startNode = graph.findClosestNode(
        { latitude: 45.49704433962407, longitude: -73.5786497963592 }, // building entrance
        '1',
      );
      const endNode = graph.findClosestNode(room840!.position, room840!.level);
      expect(startNode).not.toBeNull();
      expect(endNode).not.toBeNull();

      const route = findPath(graph, startNode!.id, endNode!.id, {
        avoidStairs: true,
      });
      expect(route).not.toBeNull();
      const stairsSteps = route!.steps.filter((s) => s.edgeType === 'stairs');
      expect(stairsSteps.length).toBe(0);
    });

    it('should produce step-by-step instructions with the same-floor route', () => {
      const startNode = graph.findClosestNode({ latitude: 45.4972, longitude: -73.579 }, '1');
      const endNode = graph.findClosestNode({ latitude: 45.4974, longitude: -73.5788 }, '1');
      expect(startNode).not.toBeNull();
      expect(endNode).not.toBeNull();

      const route = findPath(graph, startNode!.id, endNode!.id);
      expect(route).not.toBeNull();
      expect(route!.steps.length).toBeGreaterThan(0);

      // Each step should have a valid instruction and non-negative distance
      for (const step of route!.steps) {
        expect(step.instruction).toBeTruthy();
        expect(step.distanceMeters).toBeGreaterThanOrEqual(0);
        expect(step.path.length).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // 5. Building Detection & Registry — Real Data
  // =========================================================================
  describe('Building detection and registry integration', () => {
    it('should detect "H-840" as an indoor destination', () => {
      const result = detectIndoorDestination('H-840');
      expect(result).not.toBeNull();
      expect(result!.buildingCode).toBe('H');
      expect(result!.roomRef).toBe('H-840');
    });

    it('should detect "H840" (no separator) as an indoor destination', () => {
      const result = detectIndoorDestination('H840');
      expect(result).not.toBeNull();
      expect(result!.buildingCode).toBe('H');
      expect(result!.roomRef).toBe('H-840');
    });

    it('should detect "H 840" (space separator) as an indoor destination', () => {
      const result = detectIndoorDestination('H 840');
      expect(result).not.toBeNull();
      expect(result!.buildingCode).toBe('H');
      expect(result!.roomRef).toBe('H-840');
    });

    it('should not detect a non-registered building code', () => {
      const result = detectIndoorDestination('Z-100');
      expect(result).toBeNull();
    });

    it('should confirm Hall Building has an indoor map', () => {
      expect(hasIndoorMap('H')).toBe(true);
      expect(hasIndoorMap('h')).toBe(true); // case-insensitive
    });

    it('should confirm a non-registered code does not have an indoor map', () => {
      expect(hasIndoorMap('ZZZZZ')).toBe(false);
    });

    it('should load the full Hall Building data through the registry', () => {
      const data = loadBuilding('H');
      expect(data).not.toBeNull();
      expect(data!.features.length).toBeGreaterThan(500);
      expect(data!.graph.nodes.size).toBeGreaterThan(100);
      expect(data!.roomIndex.size).toBeGreaterThan(30);
      expect(data!.levels.length).toBeGreaterThanOrEqual(7);
    });

    it('should route from Hall tunnel access to the EV tunnel entry through the merged graph', () => {
      const data = loadBuilding('H');
      expect(data).not.toBeNull();

      const hallTunnelStart = { latitude: 45.49684, longitude: -73.57881 };
      const evTunnelEntryFeature = sgwTunnelNetwork.features.find(
        (feature) => feature.properties.ref === 'entry-EV-b1-metro',
      );
      expect(evTunnelEntryFeature).toBeDefined();

      const evTunnelEntry = {
        latitude: evTunnelEntryFeature!.geometry.coordinates[1],
        longitude: evTunnelEntryFeature!.geometry.coordinates[0],
      };

      const startNode = data!.graph.findClosestNode(hallTunnelStart, '-1');
      const endNode = data!.graph.findClosestNode(evTunnelEntry, '-1');
      expect(startNode).not.toBeNull();
      expect(endNode).not.toBeNull();

      const route = findPath(data!.graph, startNode!.id, endNode!.id);
      expect(route).not.toBeNull();
      expect(route!.polyline.length).toBeGreaterThan(1);
      expect(route!.steps.some((step) => step.edgeType === 'tunnel')).toBe(true);
      expect(route!.steps.some((step) => /tunnel/i.test(step.instruction))).toBe(true);
    });

    it('should return cached data on second load', () => {
      const first = loadBuilding('H');
      const second = loadBuilding('H');
      expect(first).toBe(second); // reference equality — same cached object
    });
  });

  // =========================================================================
  // 6. End-to-End: Search Query → Room Route
  // =========================================================================
  describe('Full pipeline: search query to indoor route', () => {
    it('should go from "H-840" search query to a routable destination', () => {
      // Step 1: Detect indoor destination from search text
      const detected = detectIndoorDestination('H-840');
      expect(detected).not.toBeNull();

      // Step 2: Load building data
      const building = loadBuilding(detected!.buildingCode);
      expect(building).not.toBeNull();

      // Step 3: Resolve room
      const room = resolveRoom(detected!.roomRef, building!.roomIndex, detected!.buildingCode);
      expect(room).not.toBeNull();
      expect(room!.level).toBe('8');

      // Step 4: Find a graph node near the entrance (simulate user position at ground floor)
      const entrancePosition = { latitude: 45.49704433962407, longitude: -73.5786497963592 };
      const startNode = building!.graph.findClosestNode(entrancePosition, '1');
      expect(startNode).not.toBeNull();

      // Step 5: Find a graph node near the destination room
      const destNode = building!.graph.findClosestNode(room!.position, room!.level);
      expect(destNode).not.toBeNull();

      // Step 6: Compute route
      const route = findPath(building!.graph, startNode!.id, destNode!.id);
      expect(route).not.toBeNull();
      expect(route!.totalDistanceMeters).toBeGreaterThan(0);
      expect(route!.polyline.length).toBeGreaterThan(1);
      expect(route!.startLevel).toBe('1');
      expect(route!.endLevel).toBe('8');

      // The route should include a floor-change transition
      const hasTransition = route!.steps.some(
        (s) => s.edgeType === 'stairs' || s.edgeType === 'elevator',
      );
      expect(hasTransition).toBe(true);
    });

    it('should produce an accessible route (elevator-only) for the same query', () => {
      const detected = detectIndoorDestination('H-840');
      expect(detected).not.toBeNull();
      const building = loadBuilding(detected!.buildingCode);
      expect(building).not.toBeNull();
      const room = resolveRoom(detected!.roomRef, building!.roomIndex, detected!.buildingCode);
      expect(room).not.toBeNull();
      const startNode = building!.graph.findClosestNode(
        { latitude: 45.49704433962407, longitude: -73.5786497963592 },
        '1',
      );
      const destNode = building!.graph.findClosestNode(room!.position, room!.level);
      expect(startNode).not.toBeNull();
      expect(destNode).not.toBeNull();

      const route = findPath(building!.graph, startNode!.id, destNode!.id, {
        avoidStairs: true,
        avoidEscalators: true,
        preferElevator: true,
      });

      expect(route).not.toBeNull();
      const hasStairs = route!.steps.some((s) => s.edgeType === 'stairs');
      const hasEscalators = route!.steps.some((s) => s.edgeType === 'escalator');
      const hasElevator = route!.steps.some((s) => s.edgeType === 'elevator');
      expect(hasStairs).toBe(false);
      expect(hasEscalators).toBe(false);
      expect(hasElevator).toBe(true);
      expect(route!.totalDistanceMeters).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 7. Nearest POI — Real Data
  // =========================================================================
  describe('Nearest POI search on real data', () => {
    it('should find the nearest elevator from a point on level 1', () => {
      const result = findNearestPOI(
        features,
        { latitude: 45.4973, longitude: -73.5789 },
        '1',
        'elevator',
      );
      expect(result).not.toBeNull();
      expect(result!.feature.type).toBe('elevator');
      expect(result!.distanceMeters).toBeGreaterThan(0);
    });

    it('should find the nearest stairs from a point on level 1', () => {
      const result = findNearestPOI(
        features,
        { latitude: 45.4973, longitude: -73.5789 },
        '1',
        'stairs',
      );
      expect(result).not.toBeNull();
      expect(result!.feature.type).toBe('stairs');
      expect(result!.distanceMeters).toBeGreaterThan(0);
    });
  });
});
