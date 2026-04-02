/**
 * Builds a navigation graph from parsed IndoorFeature objects.
 *
 * The graph is used by the pathfinder to compute shortest routes between any
 * two points inside a building (including level changes via stairs/elevators).
 *
 * ## Graph construction strategy
 *
 * 1. **Corridor endpoints/vertices** become graph nodes. Two endpoints that
 *    are geographically close (< SNAP_DISTANCE_METERS) and on the same level
 *    are merged into one node (intersection merging).
 *
 * 2. **Corridor segments** become bidirectional edges weighted by Haversine
 *    distance.
 *
 * 3. **Stairs / escalator paths** contribute edges that span multiple levels.
 *    The first coordinate is assigned to the first level in the `levels` list,
 *    the last coordinate to the last level, and they are connected by a single
 *    level-change edge.
 *
 * 4. **Elevators** create a fully-connected set of level-change edges between
 *    all listed levels at the elevator's position.
 *
 * 5. **Room centroids** are connected to the nearest corridor node on the same
 *    level (simulating "walk from room to hallway").
 */

import type {
  GraphEdge,
  GraphNode,
  IndoorCorridor,
  IndoorDoor,
  IndoorElevator,
  IndoorEscalator,
  IndoorFeature,
  IndoorRoom,
  IndoorStairs,
  LatLng,
} from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Two points within this distance (meters) on the same level merge into one node. */
const SNAP_DISTANCE_METERS = 3;

/** Maximum distance to connect a room centroid to a corridor node. */
const ROOM_CONNECT_MAX_METERS = 200;
/** Approximate penalty (meters) added to a level-change edge via stairs. */
const STAIRS_PENALTY_METERS = 25;

/** Approximate base wait penalty (meters) for taking an elevator. */
const ELEVATOR_BASE_PENALTY_METERS = 45;

/** Approximate penalty (meters) per floor added to an elevator edge. */
const ELEVATOR_FLOOR_PENALTY_METERS = 10;

/** Approximate penalty (meters) added to a level-change edge via escalator. */
const ESCALATOR_PENALTY_METERS = 20;

/** Maximum distance (meters) to search for a door near a transition feature. */
const DOOR_SEARCH_RADIUS_METERS = 15;

// ---------------------------------------------------------------------------
// Haversine distance
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
// Graph builder
// ---------------------------------------------------------------------------

export class IndoorGraph {
  readonly nodes: Map<string, GraphNode> = new Map();
  readonly edges: GraphEdge[] = [];
  /** Adjacency list: nodeId → list of edge indices into `edges`. */
  readonly adjacency: Map<string, number[]> = new Map();

  private _nodeCounter = 0;

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Build the full graph from a set of parsed indoor features. */
  static build(features: IndoorFeature[]): IndoorGraph {
    const graph = new IndoorGraph();
    const corridors = features.filter((f): f is IndoorCorridor => f.type === 'corridor');
    const stairs = features.filter((f): f is IndoorStairs => f.type === 'stairs');
    const elevators = features.filter((f): f is IndoorElevator => f.type === 'elevator');
    const escalators = features.filter((f): f is IndoorEscalator => f.type === 'escalator');
    const rooms = features.filter((f): f is IndoorRoom => f.type === 'room');
    const doors = features.filter((f): f is IndoorDoor => f.type === 'door');

    // Pre-index room polygons by level so corridors that extend into rooms
    // can be trimmed at the polygon boundary (prevents wall-clipping routes).
    const roomPolysByLevel = IndoorGraph.indexRoomPolysByLevel(rooms);

    // Pre-index doors by level so transition features can route through them.
    const doorsByLevel = IndoorGraph.indexDoorsByLevel(doors);

    // Phase 0: pre-seed door positions as graph nodes so that corridor
    // endpoints within SNAP_DISTANCE_METERS of a door snap to the door
    // node.  This makes every doorway a natural waypoint in the corridor
    // network — the generated path will pass through actual doorways
    // instead of cutting across walls.
    IndoorGraph.seedDoorNodes(graph, doors);

    // Phase 1: corridors → nodes + walk edges (trimmed at room boundaries)
    for (const c of corridors) {
      graph.addCorridor(c, roomPolysByLevel);
    }

    // Phase 2: stairs → level-change edges (routed through doorways)
    for (const s of stairs) {
      graph.addStairs(s, doorsByLevel);
    }

    // Phase 3: elevators → level-change edges (routed through doorways)
    for (const e of elevators) {
      graph.addElevator(e, doorsByLevel);
    }

    // Phase 4: escalators → level-change edges (routed through doorways)
    for (const e of escalators) {
      graph.addEscalator(e, doorsByLevel);
    }

    // Phase 5: connect room centroids to nearest corridor node
    for (const r of rooms) {
      graph.connectRoom(r);
    }

    return graph;
  }

  private static indexRoomPolysByLevel(rooms: IndoorRoom[]): Map<string, LatLng[][]> {
    const roomPolysByLevel = new Map<string, LatLng[][]>();
    for (const room of rooms) {
      if (room.polygon.length < 3) continue;
      for (const level of room.levels) {
        if (!roomPolysByLevel.has(level)) roomPolysByLevel.set(level, []);
        roomPolysByLevel.get(level)!.push(room.polygon);
      }
    }
    return roomPolysByLevel;
  }

  private static indexDoorsByLevel(doors: IndoorDoor[]): Map<string, IndoorDoor[]> {
    const doorsByLevel = new Map<string, IndoorDoor[]>();
    for (const door of doors) {
      for (const level of door.levels) {
        if (!doorsByLevel.has(level)) doorsByLevel.set(level, []);
        doorsByLevel.get(level)!.push(door);
      }
    }
    return doorsByLevel;
  }

  private static seedDoorNodes(graph: IndoorGraph, doors: IndoorDoor[]): void {
    for (const door of doors) {
      for (const level of door.levels) {
        graph.getOrCreateNode(door.position, level, door.id);
      }
    }
  }

  /** Get all neighbours of a node (for pathfinding). */
  getNeighbours(nodeId: string): { node: GraphNode; edge: GraphEdge }[] {
    const edgeIndices = this.adjacency.get(nodeId) ?? [];
    const result: { node: GraphNode; edge: GraphEdge }[] = [];
    for (const idx of edgeIndices) {
      const edge = this.edges[idx];
      const neighbourId = edge.from === nodeId ? edge.to : edge.from;
      const node = this.nodes.get(neighbourId);
      if (node) result.push({ node, edge });
    }
    return result;
  }

  /** Find the closest graph node to a point on a given level. Prefer non-transition (walkable corridor) nodes. */
  findClosestNode(position: LatLng, level: string): GraphNode | null {
    let bestWalkable: GraphNode | null = null;
    let bestWalkableDist = Infinity;
    let bestAny: GraphNode | null = null;
    let bestAnyDist = Infinity;

    for (const node of this.nodes.values()) {
      if (node.level !== level) continue;

      const d = haversine(position, node.position);
      if (!node.isTransition && d < bestWalkableDist) {
        bestWalkableDist = d;
        bestWalkable = node;
      }
      if (d < bestAnyDist) {
        bestAnyDist = d;
        bestAny = node;
      }
    }
    return bestWalkable ?? bestAny;
  }

  // -----------------------------------------------------------------------
  // Internal graph building helpers
  // -----------------------------------------------------------------------

  private addCorridor(corridor: IndoorCorridor, roomPolysByLevel: Map<string, LatLng[][]>): void {
    // A corridor may span multiple levels (e.g. "2;8").
    // Create nodes and walk edges on EACH level so pathfinding works on all.
    const isTunnel =
      corridor.raw.tunnel === 'yes' || corridor.ref?.toLowerCase().includes('tunnel') === true;

    for (const level of corridor.levels) {
      const entries = this.createCorridorEntries(corridor, level);
      this.addCorridorEdges(entries, level, roomPolysByLevel, isTunnel);
    }
  }

  private createCorridorEntries(
    corridor: IndoorCorridor,
    level: string,
  ): { nodeId: string; coord: LatLng }[] {
    // We use the original coordinates so snapping preserves shared junctions.
    return corridor.path.map((coord) => ({
      nodeId: this.getOrCreateNode(coord, level, corridor.id),
      coord,
    }));
  }

  private addCorridorEdges(
    entries: { nodeId: string; coord: LatLng }[],
    level: string,
    roomPolysByLevel: Map<string, LatLng[][]>,
    isTunnel: boolean,
  ): void {
    let runStart = 0;

    for (let i = 1; i < entries.length; i++) {
      if (entries[i].nodeId === entries[runStart].nodeId) continue;

      this.addCorridorSegment(entries, runStart, i, level, roomPolysByLevel, isTunnel);
      runStart = i;
    }
  }

  private addCorridorSegment(
    entries: { nodeId: string; coord: LatLng }[],
    startIndex: number,
    endIndex: number,
    level: string,
    roomPolysByLevel: Map<string, LatLng[][]>,
    isTunnel: boolean,
  ): void {
    const pathCoords = entries.slice(startIndex, endIndex + 1).map((entry) => entry.coord);
    const renderPath = trimPathAtRoomBoundaries(pathCoords, level, roomPolysByLevel);

    this.addEdge({
      from: entries[startIndex].nodeId,
      to: entries[endIndex].nodeId,
      weight: this.getPathDistance(pathCoords),
      isLevelChange: false,
      edgeType: isTunnel ? 'tunnel' : 'walk',
      // If trimming removes the whole interior path, let reconstruction
      // fall back to a straight line between the edge endpoints.
      path: renderPath.length >= 2 ? renderPath : undefined,
    });
  }

  private getPathDistance(path: LatLng[]): number {
    let distance = 0;

    for (let i = 1; i < path.length; i++) {
      distance += haversine(path[i - 1], path[i]);
    }

    return distance;
  }

  private addStairs(stairs: IndoorStairs, doorsByLevel: Map<string, IndoorDoor[]>): void {
    if (stairs.levels.length < 2) return;
    if (stairs.path.length < 2 && stairs.polygon.length === 0) return;

    // Use the path endpoints (or polygon centroid) as the transition points
    const lastStairsPoint = stairs.path.at(-1);
    const points =
      stairs.path.length >= 2 && lastStairsPoint
        ? [stairs.path[0], lastStairsPoint]
        : [centroid(stairs.polygon), centroid(stairs.polygon)];

    const sortedLevels = [...stairs.levels].sort((a, b) => Number(a) - Number(b));

    const transitionNodeByLevel = new Map<string, string>();
    const toPosition = points.length > 1 ? points[1] : points[0];

    for (let i = 0; i < sortedLevels.length - 1; i++) {
      const fromLevel = sortedLevels[i];
      const toLevel = sortedLevels[i + 1];

      const fromNode = this.ensureTransitionNode(
        transitionNodeByLevel,
        fromLevel,
        points[0],
        stairs.id,
        doorsByLevel,
      );
      const toNode = this.ensureTransitionNode(
        transitionNodeByLevel,
        toLevel,
        toPosition,
        stairs.id,
        doorsByLevel,
      );

      const weight = STAIRS_PENALTY_METERS * Math.abs(Number(toLevel) - Number(fromLevel));
      this.addLevelChangeEdge(stairs.oneway, fromNode, toNode, weight, 'stairs');
    }
  }

  private addElevator(elevator: IndoorElevator, doorsByLevel: Map<string, IndoorDoor[]>): void {
    if (elevator.levels.length < 2) return;

    // Create a dedicated node on each level at the elevator position.
    // Force-create (no snapping) so the transition node stays inside the
    // elevator shaft; a doorway edge will connect it to the corridor.
    const levelNodes: string[] = [];
    for (const level of elevator.levels) {
      const nodeId = this.forceCreateNode(elevator.position, level, elevator.id);
      levelNodes.push(nodeId);
      this.connectTransitionThroughDoor(
        nodeId,
        elevator.position,
        level,
        elevator.id,
        doorsByLevel,
      );
    }

    // Fully connect all levels (elevator can go to any floor)
    for (let i = 0; i < levelNodes.length; i++) {
      for (let j = i + 1; j < levelNodes.length; j++) {
        const lA = elevator.levels[i];
        const lB = elevator.levels[j];
        const levelDiff = Math.abs(Number(lB) - Number(lA));
        this.addEdge({
          from: levelNodes[i],
          to: levelNodes[j],
          weight:
            ELEVATOR_BASE_PENALTY_METERS + ELEVATOR_FLOOR_PENALTY_METERS * Math.max(levelDiff, 1),
          isLevelChange: true,
          edgeType: 'elevator',
        });
      }
    }
  }

  private addEscalator(escalator: IndoorEscalator, doorsByLevel: Map<string, IndoorDoor[]>): void {
    if (escalator.levels.length < 2) return;

    const lastEscalatorPoint = escalator.path.at(-1);
    const points =
      escalator.path.length >= 2 && lastEscalatorPoint
        ? [escalator.path[0], lastEscalatorPoint]
        : [centroid(escalator.polygon), centroid(escalator.polygon)];

    const sortedLevels = [...escalator.levels].sort((a, b) => Number(a) - Number(b));

    const transitionNodeByLevel = new Map<string, string>();
    const toPosition = points[1] ?? points[0];
    const edgeType = escalator.isElevator ? 'elevator' : 'escalator';

    for (let i = 0; i < sortedLevels.length - 1; i++) {
      const fromLevel = sortedLevels[i];
      const toLevel = sortedLevels[i + 1];

      const fromNode = this.ensureTransitionNode(
        transitionNodeByLevel,
        fromLevel,
        points[0],
        escalator.id,
        doorsByLevel,
      );
      const toNode = this.ensureTransitionNode(
        transitionNodeByLevel,
        toLevel,
        toPosition,
        escalator.id,
        doorsByLevel,
      );

      const levelDiff = Math.abs(Number(toLevel) - Number(fromLevel));
      const weight = escalator.isElevator
        ? ELEVATOR_BASE_PENALTY_METERS + ELEVATOR_FLOOR_PENALTY_METERS * levelDiff
        : ESCALATOR_PENALTY_METERS * levelDiff;

      this.addLevelChangeEdge(escalator.oneway, fromNode, toNode, weight, edgeType);
    }
  }

  private ensureTransitionNode(
    transitionNodeByLevel: Map<string, string>,
    level: string,
    position: LatLng,
    featureId: string,
    doorsByLevel: Map<string, IndoorDoor[]>,
  ): string {
    const existing = transitionNodeByLevel.get(level);
    if (existing) return existing;

    const nodeId = this.forceCreateNode(position, level, featureId);
    transitionNodeByLevel.set(level, nodeId);
    this.connectTransitionThroughDoor(nodeId, position, level, featureId, doorsByLevel);
    return nodeId;
  }

  private addLevelChangeEdge(
    oneway: 'up' | 'down' | null,
    fromNode: string,
    toNode: string,
    weight: number,
    edgeType: GraphEdge['edgeType'],
  ): void {
    if (oneway === 'up') {
      this.addDirectedEdge({
        from: fromNode,
        to: toNode,
        weight,
        isLevelChange: true,
        edgeType,
      });
      return;
    }
    if (oneway === 'down') {
      this.addDirectedEdge({
        from: toNode,
        to: fromNode,
        weight,
        isLevelChange: true,
        edgeType,
      });
      return;
    }
    this.addEdge({
      from: fromNode,
      to: toNode,
      weight,
      isLevelChange: true,
      edgeType,
    });
  }

  private connectRoom(room: IndoorRoom): void {
    for (const level of room.levels) {
      const closest = this.findClosestNode(room.centroid, level);
      if (!closest) continue;
      const dist = haversine(room.centroid, closest.position);
      if (dist > ROOM_CONNECT_MAX_METERS) continue;

      // Place the room's graph node at the nearest point on the room polygon
      // boundary facing the corridor.  This ensures the route line enters/exits
      // the room at a natural doorway-like point rather than cutting through walls
      // from the centroid.
      const entryPoint =
        room.polygon.length > 2
          ? closestPointOnPolygon(room.polygon, closest.position)
          : room.centroid;

      // Track node count to detect whether the entry point snapped to an
      // already-existing node (corridor junction / elevator / etc.).
      const countBefore = this.nodes.size;
      const roomNode = this.getOrCreateNode(entryPoint, level, room.id);
      const wasSnapped = this.nodes.size === countBefore;

      // If the entry point snapped to an existing corridor/transition node
      // that is different from the closest node, creating an edge would add
      // a shortcut between two corridor junctions with straight-line
      // geometry that cuts through the room — bypassing the actual corridor
      // path.  Skip it: the room is already reachable at the snapped node.
      if (wasSnapped && roomNode !== closest.id) continue;

      // Same node — no edge needed.
      if (roomNode === closest.id) continue;

      this.addEdge({
        from: roomNode,
        to: closest.id,
        weight: haversine(entryPoint, closest.position),
        isLevelChange: false,
        edgeType: 'walk',
        // Provide explicit path geometry from the room entry point to
        // the corridor node.  Without this the route reconstruction
        // falls back to raw node positions, which can be inside room
        // polygons when nodes snap to corridor coordinates that
        // penetrate rooms.
        path: [entryPoint, closest.position],
      });
    }
  }

  // -----------------------------------------------------------------------
  // Transition ↔ corridor doorway routing
  // -----------------------------------------------------------------------

  /**
   * Connect a transition node (elevator / stairs / escalator) to the
   * corridor network through the nearest door on this level.
   *
   * If a door is found within DOOR_SEARCH_RADIUS_METERS, the route goes:
   *   transition node → door node → corridor network
   *
   * If no door is found, the transition node connects directly to the
   * nearest corridor node (fallback for data gaps).
   */
  private connectTransitionThroughDoor(
    transitionNodeId: string,
    transitionPosition: LatLng,
    level: string,
    _featureId: string,
    doorsByLevel: Map<string, IndoorDoor[]>,
  ): void {
    const levelDoors = doorsByLevel.get(level) ?? [];
    const bestDoor = this.findClosestDoor(levelDoors, transitionPosition);

    if (!bestDoor) {
      this.connectTransitionToNearestCorridor(transitionNodeId, transitionPosition, level);
      return;
    }

    const { doorNodeId, wasNewDoorNode } = this.connectTransitionToDoor(
      transitionNodeId,
      transitionPosition,
      bestDoor,
      level,
    );
    if (wasNewDoorNode) {
      this.connectDoorToNearestCorridor(doorNodeId, transitionNodeId, bestDoor.position, level);
    }
  }

  private findClosestDoor(doors: IndoorDoor[], position: LatLng): IndoorDoor | null {
    let bestDoor: IndoorDoor | null = null;
    let bestDist = Infinity;
    for (const door of doors) {
      const dist = haversine(position, door.position);
      if (dist < DOOR_SEARCH_RADIUS_METERS && dist < bestDist) {
        bestDist = dist;
        bestDoor = door;
      }
    }
    return bestDoor;
  }

  private connectTransitionToDoor(
    transitionNodeId: string,
    transitionPosition: LatLng,
    door: IndoorDoor,
    level: string,
  ): { doorNodeId: string; wasNewDoorNode: boolean } {
    const countBefore = this.nodes.size;
    const doorNodeId = this.getOrCreateNode(door.position, level, door.id);
    const wasNewDoorNode = this.nodes.size > countBefore;

    if (doorNodeId !== transitionNodeId) {
      this.addEdge({
        from: transitionNodeId,
        to: doorNodeId,
        weight: haversine(transitionPosition, door.position),
        isLevelChange: false,
        edgeType: 'walk',
        path: [transitionPosition, door.position],
      });
    }

    return { doorNodeId, wasNewDoorNode };
  }

  private connectDoorToNearestCorridor(
    doorNodeId: string,
    transitionNodeId: string,
    doorPosition: LatLng,
    level: string,
  ): void {
    const nearest = this.findClosestNodeExcluding(
      doorPosition,
      level,
      new Set([transitionNodeId, doorNodeId]),
    );
    if (!nearest || haversine(doorPosition, nearest.position) >= ROOM_CONNECT_MAX_METERS) {
      return;
    }
    this.addEdge({
      from: doorNodeId,
      to: nearest.id,
      weight: haversine(doorPosition, nearest.position),
      isLevelChange: false,
      edgeType: 'walk',
      path: [doorPosition, nearest.position],
    });
  }

  private connectTransitionToNearestCorridor(
    transitionNodeId: string,
    transitionPosition: LatLng,
    level: string,
  ): void {
    const nearest = this.findClosestNodeExcluding(
      transitionPosition,
      level,
      new Set([transitionNodeId]),
    );
    if (!nearest) return;
    this.addEdge({
      from: transitionNodeId,
      to: nearest.id,
      weight: haversine(transitionPosition, nearest.position),
      isLevelChange: false,
      edgeType: 'walk',
      path: [transitionPosition, nearest.position],
    });
  }

  /** Find the closest node on a level, excluding specific node IDs. Prefer non-transition (walkable corridor) nodes. */
  private findClosestNodeExcluding(
    position: LatLng,
    level: string,
    excludeIds: Set<string>,
  ): GraphNode | null {
    let bestWalkable: GraphNode | null = null;
    let bestWalkableDist = Infinity;
    let bestAny: GraphNode | null = null;
    let bestAnyDist = Infinity;

    for (const node of this.nodes.values()) {
      if (node.level !== level) continue;
      if (excludeIds.has(node.id)) continue;

      const d = haversine(position, node.position);
      if (!node.isTransition && d < bestWalkableDist) {
        bestWalkableDist = d;
        bestWalkable = node;
      }
      if (d < bestAnyDist) {
        bestAnyDist = d;
        bestAny = node;
      }
    }
    return bestWalkable ?? bestAny;
  }

  /**
   * Create a new node without snapping to existing nodes.
   * Used for transition features whose nodes must stay at their actual
   * position inside the elevator shaft / stairwell.
   */
  private forceCreateNode(position: LatLng, level: string, featureId: string): string {
    const id = `n-${this._nodeCounter++}`;
    this.nodes.set(id, {
      id,
      position,
      level,
      featureIds: [featureId],
      isTransition: true,
    });
    this.adjacency.set(id, []);
    return id;
  }

  // -----------------------------------------------------------------------
  // Low-level node / edge management
  // -----------------------------------------------------------------------

  /**
   * Get an existing node that is within SNAP_DISTANCE_METERS on the same
   * level, or create a new one.
   */
  private getOrCreateNode(
    position: LatLng,
    level: string,
    featureId: string,
    isTransition = false,
  ): string {
    // Try to snap to an existing nearby node on the same level
    for (const existing of this.nodes.values()) {
      if (existing.level !== level) continue;
      if (haversine(existing.position, position) < SNAP_DISTANCE_METERS) {
        if (!existing.featureIds.includes(featureId)) {
          existing.featureIds.push(featureId);
        }
        if (isTransition) existing.isTransition = true;
        return existing.id;
      }
    }

    // Create new node
    const id = `n-${this._nodeCounter++}`;
    this.nodes.set(id, {
      id,
      position,
      level,
      featureIds: [featureId],
      isTransition,
    });
    this.adjacency.set(id, []);
    return id;
  }

  /** Add a bidirectional edge. */
  private addEdge(edge: GraphEdge): void {
    const idx = this.edges.length;
    this.edges.push(edge);
    this.adjacency.get(edge.from)?.push(idx);
    this.adjacency.get(edge.to)?.push(idx);
  }

  /** Add a directed edge (only from → to). */
  private addDirectedEdge(edge: GraphEdge): void {
    const idx = this.edges.length;
    this.edges.push(edge);
    this.adjacency.get(edge.from)?.push(idx);
    // Directed: only from-side gets the adjacency entry.
    // To allow the pathfinder to still traverse it, we store it in the
    // `to` adjacency as well but the pathfinder will use edge.from/to
    // to determine direction.
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function centroid(ring: LatLng[]): LatLng {
  if (ring.length === 0) return { latitude: 0, longitude: 0 };
  const sum = ring.reduce(
    (a, p) => ({ latitude: a.latitude + p.latitude, longitude: a.longitude + p.longitude }),
    { latitude: 0, longitude: 0 },
  );
  return { latitude: sum.latitude / ring.length, longitude: sum.longitude / ring.length };
}

/**
 * Find the closest point on a polygon boundary to a target point.
 * Projects `target` onto every polygon edge and returns the nearest projection.
 */
function closestPointOnPolygon(polygon: LatLng[], target: LatLng): LatLng {
  let best: LatLng = polygon[0];
  let bestDist = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const projected = projectPointOnSegment(a, b, target);
    const d = haversine(projected, target);
    if (d < bestDist) {
      bestDist = d;
      best = projected;
    }
  }

  return best;
}

/** Project point P onto line segment A–B, clamped to [0, 1]. */
function projectPointOnSegment(a: LatLng, b: LatLng, p: LatLng): LatLng {
  const dx = b.longitude - a.longitude;
  const dy = b.latitude - a.latitude;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return a;

  let t = ((p.longitude - a.longitude) * dx + (p.latitude - a.latitude) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return {
    latitude: a.latitude + t * dy,
    longitude: a.longitude + t * dx,
  };
}

/** Ray-casting point-in-polygon test. */
function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i].latitude,
      xi = polygon[i].longitude;
    const yj = polygon[j].latitude,
      xj = polygon[j].longitude;
    if (
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Trim a corridor path so it stops at room polygon boundaries instead of
 * continuing inside rooms.  Scans from both ends, removing consecutive
 * coordinates that fall inside a room polygon and inserting a boundary
 * point where the corridor exits/enters the room.
 */
function trimPathAtRoomBoundaries(
  path: LatLng[],
  level: string,
  roomPolysByLevel: Map<string, LatLng[][]>,
): LatLng[] {
  if (path.length < 2) return path;
  const polys = roomPolysByLevel.get(level);
  if (!polys || polys.length === 0) return path;

  // Tag each coordinate with its enclosing room polygon (if any)
  const enclosing: (LatLng[] | null)[] = path.map((coord) => {
    for (const poly of polys) {
      if (pointInPolygon(coord, poly)) return poly;
    }
    return null;
  });

  const startTrim = findStartTrim(enclosing);
  const endTrim = findEndTrim(enclosing);

  // Whole path inside rooms → nothing useful to keep
  if (startTrim >= endTrim) return [];

  return buildTrimmedPath(path, enclosing, startTrim, endTrim);
}

function findStartTrim(enclosing: (LatLng[] | null)[]): number {
  let startTrim = -1;
  for (let i = 0; i < enclosing.length; i++) {
    if (enclosing[i]) startTrim = i;
    else break;
  }
  return startTrim;
}

function findEndTrim(enclosing: (LatLng[] | null)[]): number {
  let endTrim = enclosing.length;
  for (let i = enclosing.length - 1; i >= 0; i--) {
    if (enclosing[i]) endTrim = i;
    else break;
  }
  return endTrim;
}

function buildTrimmedPath(
  path: LatLng[],
  enclosing: (LatLng[] | null)[],
  startTrim: number,
  endTrim: number,
): LatLng[] {
  const result: LatLng[] = [];

  // Insert a point on the room polygon boundary at the start
  if (startTrim >= 0 && startTrim + 1 < path.length) {
    result.push(closestPointOnPolygon(enclosing[startTrim]!, path[startTrim + 1]));
  }

  // Keep all coordinates that are outside rooms
  for (let i = startTrim + 1; i < endTrim; i++) {
    result.push(path[i]);
  }

  // Insert a point on the room polygon boundary at the end
  if (endTrim < path.length && endTrim > 0) {
    result.push(closestPointOnPolygon(enclosing[endTrim]!, path[endTrim - 1]));
  }

  return result;
}
