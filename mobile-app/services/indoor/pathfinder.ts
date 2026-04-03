/**
 * A* shortest-path algorithm for the indoor navigation graph.
 *
 * The heuristic uses Haversine distance which is admissible (never
 * overestimates) so A* is guaranteed to find the optimal path.
 *
 * Supports optional preferences:
 * - Prefer elevators over other vertical transitions
 * - Avoid stairs entirely
 * - Avoid escalators entirely
 */

import { IndoorGraph } from './IndoorGraph';
import { haversineMeters } from './geoUtils';
import type { GraphEdge, GraphNode, IndoorNavStep, IndoorRoute, LatLng } from './types';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PathfinderOptions {
  /** If true, strongly prefer elevators over stairs. */
  preferElevator?: boolean;
  /** If true, exclude stair edges entirely (wheelchair mode). */
  avoidStairs?: boolean;
  /** If true, exclude escalator edges entirely (wheelchair mode). */
  avoidEscalators?: boolean;
}

function getEdgeWeight(
  edge: { weight: number; edgeType: IndoorNavStep['edgeType']; isLevelChange: boolean },
  options: PathfinderOptions,
): number | null {
  if (options.avoidStairs && edge.edgeType === 'stairs') return null;
  if (options.avoidEscalators && edge.edgeType === 'escalator') return null;

  let weight = edge.weight;
  if (
    options.preferElevator &&
    edge.isLevelChange &&
    (edge.edgeType === 'stairs' || edge.edgeType === 'escalator')
  ) {
    weight *= 3; // Heavy penalty to discourage stairs when elevator preferred
  }

  return weight;
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

  const state = initPathfinderState(startNodeId, startNode.position, endNode.position);

  while (state.open.size > 0) {
    const current = state.open.pop()!;
    if (current.nodeId === endNodeId) {
      return reconstructRoute(graph, state.cameFrom, startNodeId, endNodeId, state.gScore);
    }

    if (state.closed.has(current.nodeId)) continue;
    state.closed.add(current.nodeId);
    processNeighbours(graph, current.nodeId, endNode, options, state);
  }

  // No path found
  return null;
}

// ---------------------------------------------------------------------------
// Route reconstruction
// ---------------------------------------------------------------------------

type PathfinderState = {
  gScore: Map<string, number>;
  cameFrom: Map<string, { nodeId: string; edgeIdx: number }>;
  closed: Set<string>;
  open: MinHeap;
};

function initPathfinderState(
  startNodeId: string,
  startPosition: LatLng,
  endPosition: LatLng,
): PathfinderState {
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, { nodeId: string; edgeIdx: number }>();
  const closed = new Set<string>();
  const open = new MinHeap();

  gScore.set(startNodeId, 0);
  open.push({ nodeId: startNodeId, f: haversineMeters(startPosition, endPosition) });

  return { gScore, cameFrom, closed, open };
}

function getNeighbourId(edge: GraphEdge, currentNodeId: string): string | null {
  const neighbourId = edge.from === currentNodeId ? edge.to : edge.from;
  // For directed edges where current is NOT the `from`, skip
  // (This handles oneway stairs/escalators)
  if (neighbourId === currentNodeId) return null;
  return neighbourId;
}

function processNeighbours(
  graph: IndoorGraph,
  currentNodeId: string,
  endNode: GraphNode,
  options: PathfinderOptions,
  state: PathfinderState,
): void {
  const edgeIndices = graph.adjacency.get(currentNodeId) ?? [];

  for (const edgeIdx of edgeIndices) {
    const edge = graph.edges[edgeIdx];
    const neighbourId = getNeighbourId(edge, currentNodeId);
    if (!neighbourId || state.closed.has(neighbourId)) continue;

    const edgeWeight = getEdgeWeight(edge, options);
    if (edgeWeight == null) continue;

    relaxEdge(state, graph, neighbourId, currentNodeId, edgeIdx, edgeWeight, endNode.position);
  }
}

function relaxEdge(
  state: PathfinderState,
  graph: IndoorGraph,
  neighbourId: string,
  currentNodeId: string,
  edgeIdx: number,
  edgeWeight: number,
  endPosition: LatLng,
): void {
  const currentG = state.gScore.get(currentNodeId) ?? Infinity;
  const tentativeG = currentG + edgeWeight;
  const prevG = state.gScore.get(neighbourId) ?? Infinity;
  if (tentativeG >= prevG) return;

  state.gScore.set(neighbourId, tentativeG);
  state.cameFrom.set(neighbourId, { nodeId: currentNodeId, edgeIdx });
  const neighbourNode = graph.nodes.get(neighbourId)!;
  const h = haversineMeters(neighbourNode.position, endPosition);
  state.open.push({ nodeId: neighbourId, f: tentativeG + h });
}

type RouteBuildState = {
  polyline: LatLng[];
  steps: IndoorNavStep[];
  currentLevel: string;
  segmentPath: LatLng[];
  segmentType: IndoorNavStep['edgeType'];
  segmentStartLevel: string;
};

function buildNodePath(
  cameFrom: Map<string, { nodeId: string; edgeIdx: number }>,
  startId: string,
  endId: string,
): string[] {
  const nodeIds: string[] = [endId];
  let current = endId;
  while (current !== startId) {
    const prev = cameFrom.get(current);
    if (!prev) break;
    nodeIds.unshift(prev.nodeId);
    current = prev.nodeId;
  }
  return nodeIds;
}

function initRouteBuildState(graph: IndoorGraph, nodeIds: string[]): RouteBuildState {
  const startNode = graph.nodes.get(nodeIds[0])!;
  const startLevel = startNode.level ?? '0';
  return {
    polyline: [startNode.position],
    steps: [],
    currentLevel: startLevel,
    segmentPath: [startNode.position],
    segmentType: 'walk',
    segmentStartLevel: startLevel,
  };
}

function shouldStartNewSegment(
  edgeType: IndoorNavStep['edgeType'],
  edge: GraphEdge | null,
  nodeLevel: string,
  currentLevel: string,
  segmentType: IndoorNavStep['edgeType'],
): boolean {
  return edgeType !== segmentType || (edge?.isLevelChange && nodeLevel !== currentLevel);
}

function isVerticalTransition(edgeType: IndoorNavStep['edgeType']): boolean {
  return edgeType === 'elevator' || edgeType === 'stairs' || edgeType === 'escalator';
}

function resetSegmentAfterFlush(
  state: RouteBuildState,
  graph: IndoorGraph,
  nodeIds: string[],
  nodeIndex: number,
  edgeType: IndoorNavStep['edgeType'],
): void {
  const prevWasLevelChange = isVerticalTransition(state.segmentType);
  const prevNode = graph.nodes.get(nodeIds[nodeIndex - 1])!;
  state.segmentPath = prevWasLevelChange ? [] : [prevNode.position];
  state.segmentType = edgeType;
  state.segmentStartLevel = state.currentLevel;
}

function appendEdgeGeometry(
  state: RouteBuildState,
  node: GraphNode,
  edge: GraphEdge | null,
  prevNodeId: string | null,
): void {
  if (edge?.path && edge.path.length >= 2 && prevNodeId) {
    const isForward = prevNodeId === edge.from;
    const geom = isForward ? edge.path : [...edge.path].reverse();
    for (let p = 0; p < geom.length; p++) {
      if (p === 0 && state.polyline.length > 0) {
        const last = state.polyline.at(-1);
        if (last && haversineMeters(last, geom[p]) < 1) continue;
      }
      state.polyline.push(geom[p]);
      state.segmentPath.push(geom[p]);
    }
    return;
  }

  state.segmentPath.push(node.position);
  state.polyline.push(node.position);
}

function flushSegment(state: RouteBuildState, endLevel: string, minPoints: number): void {
  if (state.segmentPath.length < minPoints) return;
  state.steps.push(
    buildStep(state.segmentType, state.segmentStartLevel, endLevel, state.segmentPath),
  );
}

function reconstructRoute(
  graph: IndoorGraph,
  cameFrom: Map<string, { nodeId: string; edgeIdx: number }>,
  startId: string,
  endId: string,
  gScore: Map<string, number>,
): IndoorRoute {
  const nodeIds = buildNodePath(cameFrom, startId, endId);

  const state = initRouteBuildState(graph, nodeIds);

  for (let i = 1; i < nodeIds.length; i++) {
    const node = graph.nodes.get(nodeIds[i])!;
    const prev = cameFrom.get(nodeIds[i]);
    const edge = prev ? graph.edges[prev.edgeIdx] : null;
    const edgeType = edge?.edgeType ?? 'walk';

    // If the edge type or level changes, flush the current segment
    if (shouldStartNewSegment(edgeType, edge, node.level, state.currentLevel, state.segmentType)) {
      flushSegment(state, state.currentLevel, 1);
      resetSegmentAfterFlush(state, graph, nodeIds, i, edgeType);
    }

    // Use the edge's original corridor geometry when available so the
    // polyline follows actual walkways instead of cutting through walls.
    appendEdgeGeometry(state, node, edge, prev?.nodeId ?? null);
    state.currentLevel = node.level;
  }

  // Flush last segment
  flushSegment(state, state.currentLevel, 2);

  const startNode = graph.nodes.get(nodeIds[0])!;
  const endNodeId = nodeIds.at(-1) ?? endId;
  const endNode = graph.nodes.get(endNodeId)!;

  const totalEstimatedSeconds = state.steps.reduce((sum, s) => sum + s.estimatedSeconds, 0);

  return {
    totalDistanceMeters: gScore.get(endId) ?? 0,
    totalEstimatedSeconds,
    nodeIds,
    polyline: state.polyline,
    steps: state.steps,
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
    case 'tunnel':
      return distanceMeters / WALK_SPEED_MPS;
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
    distanceMeters += haversineMeters(path[i - 1], path[i]);
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
    case 'tunnel':
      instruction =
        fromLevel === toLevel
          ? `Take the tunnel for ${Math.round(distanceMeters)}m on level ${fromLevel}`
          : `Take the tunnel from level ${fromLevel} to level ${toLevel}`;
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
