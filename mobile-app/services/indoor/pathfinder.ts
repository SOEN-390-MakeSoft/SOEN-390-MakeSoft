/**
 * A* shortest-path algorithm for the indoor navigation graph.
 *
 * The heuristic uses Haversine distance which is admissible (never
 * overestimates) so A* is guaranteed to find the optimal path.
 *
 * Supports optional preferences:
 * - Prefer elevators over stairs (accessibility mode)
 * - Avoid stairs entirely
 */

import { IndoorGraph } from './IndoorGraph';
import type { IndoorNavStep, IndoorRoute, LatLng } from './types';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PathfinderOptions {
  /** If true, strongly prefer elevators over stairs. */
  preferElevator?: boolean;
  /** If true, exclude stair edges entirely (wheelchair mode). */
  avoidStairs?: boolean;
}

// ---------------------------------------------------------------------------
// Haversine (admissible heuristic)
// ---------------------------------------------------------------------------

function haversine(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ---------------------------------------------------------------------------
// Min-heap (priority queue)
// ---------------------------------------------------------------------------

interface HeapEntry {
  nodeId: string;
  f: number; // g + h
}

class MinHeap {
  private data: HeapEntry[] = [];

  get size() {
    return this.data.length;
  }

  push(entry: HeapEntry) {
    this.data.push(entry);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): HeapEntry | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[parent].f <= this.data[i].f) break;
      [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
      i = parent;
    }
  }

  private bubbleDown(i: number) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.data[left].f < this.data[smallest].f) smallest = left;
      if (right < n && this.data[right].f < this.data[smallest].f) smallest = right;
      if (smallest === i) break;
      [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
      i = smallest;
    }
  }
}

// ---------------------------------------------------------------------------
// A* implementation
// ---------------------------------------------------------------------------

/**
 * Find the shortest path between two nodes in the indoor graph.
 *
 * @returns An IndoorRoute, or `null` if no path exists.
 */
export function findPath(
  graph: IndoorGraph,
  startNodeId: string,
  endNodeId: string,
  options: PathfinderOptions = {},
): IndoorRoute | null {
  const startNode = graph.nodes.get(startNodeId);
  const endNode = graph.nodes.get(endNodeId);
  if (!startNode || !endNode) return null;

  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, { nodeId: string; edgeIdx: number }>();
  const closed = new Set<string>();

  gScore.set(startNodeId, 0);

  const open = new MinHeap();
  open.push({ nodeId: startNodeId, f: haversine(startNode.position, endNode.position) });

  while (open.size > 0) {
    const current = open.pop()!;
    if (current.nodeId === endNodeId) {
      return reconstructRoute(graph, cameFrom, startNodeId, endNodeId, gScore);
    }

    if (closed.has(current.nodeId)) continue;
    closed.add(current.nodeId);

    const currentG = gScore.get(current.nodeId) ?? Infinity;

    const edgeIndices = graph.adjacency.get(current.nodeId) ?? [];
    for (const edgeIdx of edgeIndices) {
      const edge = graph.edges[edgeIdx];

      // Determine the neighbour – edges are stored from/to but we can traverse bidirectional ones in both directions
      const neighbourId = edge.from === current.nodeId ? edge.to : edge.from;

      // For directed edges where current is NOT the `from`, skip
      // (This handles oneway stairs/escalators)
      if (neighbourId === current.nodeId) continue;

      if (closed.has(neighbourId)) continue;

      // Apply preference penalties
      let edgeWeight = edge.weight;
      if (options.avoidStairs && edge.edgeType === 'stairs') continue;
      if (options.preferElevator && edge.edgeType === 'stairs' && edge.isLevelChange) {
        edgeWeight *= 3; // Heavy penalty to discourage stairs when elevator preferred
      }

      const tentativeG = currentG + edgeWeight;
      const prevG = gScore.get(neighbourId) ?? Infinity;

      if (tentativeG < prevG) {
        gScore.set(neighbourId, tentativeG);
        cameFrom.set(neighbourId, { nodeId: current.nodeId, edgeIdx });
        const neighbourNode = graph.nodes.get(neighbourId)!;
        const h = haversine(neighbourNode.position, endNode.position);
        open.push({ nodeId: neighbourId, f: tentativeG + h });
      }
    }
  }

  // No path found
  return null;
}

// ---------------------------------------------------------------------------
// Route reconstruction
// ---------------------------------------------------------------------------

function reconstructRoute(
  graph: IndoorGraph,
  cameFrom: Map<string, { nodeId: string; edgeIdx: number }>,
  startId: string,
  endId: string,
  gScore: Map<string, number>,
): IndoorRoute {
  // Rebuild the node path
  const nodeIds: string[] = [endId];
  let current = endId;
  while (current !== startId) {
    const prev = cameFrom.get(current);
    if (!prev) break;
    nodeIds.unshift(prev.nodeId);
    current = prev.nodeId;
  }

  // Build the polyline and step-by-step instructions
  const polyline: LatLng[] = [graph.nodes.get(nodeIds[0])!.position];
  const steps: IndoorNavStep[] = [];

  let currentLevel = graph.nodes.get(nodeIds[0])?.level ?? '0';
  let segmentPath: LatLng[] = [graph.nodes.get(nodeIds[0])!.position];
  let segmentType: IndoorNavStep['edgeType'] = 'walk';
  let segmentStartLevel = currentLevel;

  for (let i = 1; i < nodeIds.length; i++) {
    const node = graph.nodes.get(nodeIds[i])!;
    const prev = cameFrom.get(nodeIds[i]);
    const edge = prev ? graph.edges[prev.edgeIdx] : null;
    const edgeType = edge?.edgeType ?? 'walk';

    // If the edge type or level changes, flush the current segment
    if (edgeType !== segmentType || (edge?.isLevelChange && node.level !== currentLevel)) {
      if (segmentPath.length > 0) {
        steps.push(buildStep(segmentType, segmentStartLevel, currentLevel, segmentPath));
      }
      // After a level-change step (elevator/stairs/escalator), the
      // transition node may have snapped inside a room polygon (e.g.
      // elevator node inside a bathroom).  Starting with an empty
      // segment lets the first walk edge's geometry supply the anchor
      // point — the existing < 1 m dedup will skip the near-duplicate
      // of the transition node while keeping the corridor boundary
      // coordinate, so the polyline starts on the walkway.
      const prevWasLevelChange =
        segmentType === 'elevator' || segmentType === 'stairs' || segmentType === 'escalator';
      segmentPath = prevWasLevelChange ? [] : [graph.nodes.get(nodeIds[i - 1])!.position];
      segmentType = edgeType;
      segmentStartLevel = currentLevel;
    }

    // Use the edge's original corridor geometry when available so the
    // polyline follows actual walkways instead of cutting through walls.
    if (edge?.path && edge.path.length >= 2) {
      // Determine traversal direction: the edge stores geometry from→to.
      // If we arrived at this node from edge.from, traverse forward;
      // otherwise reverse the path.
      const isForward = prev!.nodeId === edge.from;
      const geom = isForward ? edge.path : [...edge.path].reverse();
      // Include all path points.  Skip the first only when it is
      // essentially identical to the last polyline point (< 1 m apart).
      // With snap-merging the original corridor coordinate can be up to
      // SNAP_DISTANCE_METERS away from the node position, so blindly
      // skipping it would lose intermediate waypoints.
      for (let p = 0; p < geom.length; p++) {
        if (p === 0 && polyline.length > 0) {
          const last = polyline[polyline.length - 1];
          if (haversine(last, geom[p]) < 1) continue;
        }
        polyline.push(geom[p]);
        segmentPath.push(geom[p]);
      }
    } else {
      segmentPath.push(node.position);
      polyline.push(node.position);
    }
    currentLevel = node.level;
  }

  // Flush last segment
  if (segmentPath.length > 1) {
    steps.push(buildStep(segmentType, segmentStartLevel, currentLevel, segmentPath));
  }

  const startNode = graph.nodes.get(nodeIds[0])!;
  const endNode = graph.nodes.get(nodeIds[nodeIds.length - 1])!;

  const totalEstimatedSeconds = steps.reduce((sum, s) => sum + s.estimatedSeconds, 0);

  return {
    totalDistanceMeters: gScore.get(endId) ?? 0,
    totalEstimatedSeconds,
    nodeIds,
    polyline,
    steps,
    startLevel: startNode.level,
    endLevel: endNode.level,
  };
}

// ---------------------------------------------------------------------------
// Time estimation constants
// ---------------------------------------------------------------------------

/** Average pedestrian walking speed in m/s (Google Maps baseline). */
const WALK_SPEED_MPS = 1.4;

/** Seconds per floor on stairs going UP. */
const STAIRS_UP_SECS_PER_FLOOR = 25;
/** Seconds per floor on stairs going DOWN. */
const STAIRS_DOWN_SECS_PER_FLOOR = 15;

/**
 * Elevator: fixed wait/door time + per-floor travel time.
 * Average elevator wait ≈ 15 s, travel ≈ 3 s/floor.
 */
const ELEVATOR_WAIT_SECS = 15;
const ELEVATOR_TRAVEL_SECS_PER_FLOOR = 3;

/** Seconds per floor on an escalator. */
const ESCALATOR_SECS_PER_FLOOR = 20;

/**
 * Compute the estimated time in seconds for a navigation step.
 */
function estimateStepSeconds(
  edgeType: IndoorNavStep['edgeType'],
  fromLevel: string,
  toLevel: string,
  distanceMeters: number,
): number {
  const floors = Math.abs(Number(toLevel) - Number(fromLevel)) || 0;

  switch (edgeType) {
    case 'stairs': {
      if (floors === 0) return distanceMeters / WALK_SPEED_MPS;
      const goingUp = Number(toLevel) > Number(fromLevel);
      const secsPerFloor = goingUp ? STAIRS_UP_SECS_PER_FLOOR : STAIRS_DOWN_SECS_PER_FLOOR;
      return floors * secsPerFloor;
    }
    case 'elevator':
      return ELEVATOR_WAIT_SECS + floors * ELEVATOR_TRAVEL_SECS_PER_FLOOR;
    case 'escalator':
      return floors > 0 ? floors * ESCALATOR_SECS_PER_FLOOR : distanceMeters / WALK_SPEED_MPS;
    default: // walk
      return distanceMeters / WALK_SPEED_MPS;
  }
}

function buildStep(
  edgeType: IndoorNavStep['edgeType'],
  fromLevel: string,
  toLevel: string,
  path: LatLng[],
): IndoorNavStep {
  let distanceMeters = 0;
  for (let i = 1; i < path.length; i++) {
    distanceMeters += haversine(path[i - 1], path[i]);
  }

  const estimatedSeconds = estimateStepSeconds(edgeType, fromLevel, toLevel, distanceMeters);

  let instruction: string;
  switch (edgeType) {
    case 'stairs':
      instruction =
        fromLevel === toLevel
          ? `Walk along stairs on level ${fromLevel}`
          : `Take the stairs from level ${fromLevel} to level ${toLevel}`;
      break;
    case 'elevator':
      instruction = `Take the elevator from level ${fromLevel} to level ${toLevel}`;
      break;
    case 'escalator':
      instruction =
        fromLevel === toLevel
          ? `Take the escalator on level ${fromLevel}`
          : `Take the escalator from level ${fromLevel} to level ${toLevel}`;
      break;
    default:
      instruction =
        fromLevel === toLevel
          ? `Walk ${Math.round(distanceMeters)}m on level ${fromLevel}`
          : `Walk from level ${fromLevel} to level ${toLevel}`;
  }

  return {
    instruction,
    fromLevel,
    toLevel,
    path: [...path],
    distanceMeters,
    estimatedSeconds,
    edgeType,
  };
}
