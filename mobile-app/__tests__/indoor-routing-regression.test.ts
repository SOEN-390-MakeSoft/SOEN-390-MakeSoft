import { parseIndoorGeoJSON } from '../services/indoor/geojsonParser';
import { IndoorGraph } from '../services/indoor/IndoorGraph';
import { findPath } from '../services/indoor/pathfinder';
import { buildRoomIndex, resolveRoom } from '../services/indoor/roomResolver';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Indoor Routing Regressions', () => {
  let graph: IndoorGraph;
  let roomIndex: ReturnType<typeof buildRoomIndex>;

  beforeAll(() => {
    // Load the actual geojson map to ensure route logic holds true against real data
    const geojsonPath = path.resolve(__dirname, '../assets/geo/Hall_Building.geojson');
    const data = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
    const features = parseIndoorGeoJSON(data);

    graph = IndoorGraph.build(features);
    roomIndex = buildRoomIndex(features);
  });

  /**
   * Regression test for US-4.3
   * Ensure the 8th floor walk network is connected properly.
   * Previously, a broken/fragmented geometry caused A* to find extreme detours
   * (e.g. going down to floor 2 and back up) to cross the 8th floor.
   */
  it('should find a direct short path across floor 8 without extreme detours via lower floors', () => {
    // The node associated with the escalator heading down to 2
    const escalator8to2 = Array.from(graph.nodes.values()).find(
      (n) => n.featureIds.includes('escalator-25') && n.level === '8',
    );
    // Destination: A room across the 8th floor (H-908, we will route to floor 9 directly above)
    const room908 = resolveRoom('H-908', roomIndex, 'H');

    expect(escalator8to2).toBeDefined();
    expect(room908).toBeDefined();

    const destNode = graph.findClosestNode(room908!.position, '9');
    expect(destNode).toBeDefined();

    // Find path avoiding stairs (preferring escalator/walk)
    const route = findPath(graph, escalator8to2!.id, destNode!.id, { avoidStairs: true });

    // Assert a route was successfully found
    expect(route).toBeDefined();
    expect(route).not.toBeNull();

    // Calculate total walk/transition distance steps
    let totalDistance = 0;
    let visitedLevels = new Set<string>();

    route!.steps.forEach((step) => {
      totalDistance += step.distanceMeters;
      // Record what levels the path attempts to traverse
      if (step.fromLevel) visitedLevels.add(step.fromLevel);
      if (step.toLevel) visitedLevels.add(step.toLevel);
    });

    // The path should directly go from 8 to 9. It should NOT touch level '2'.
    expect(visitedLevels.has('2')).toBe(false);
    expect(visitedLevels.has('8')).toBe(true);
    expect(visitedLevels.has('9')).toBe(true);

    // A sane route directly taking the escalator upwards and walking across floor 8 and 9
    // should fall around ~40-60 meters. (If the bug were active, distance would exceed 150m)
    expect(totalDistance).toBeLessThan(100);
  });
});
