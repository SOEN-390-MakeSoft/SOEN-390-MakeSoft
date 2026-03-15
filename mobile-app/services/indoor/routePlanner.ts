import { findPath, type PathfinderOptions } from './pathfinder';
import { getBuildingMeta, loadBuilding } from './buildingRegistry';
import { resolveRoom } from './roomResolver';
import type { IndoorRoute, LatLng } from './types';

export type IndoorRouteEndpoint =
  | { roomRef: string }
  | {
      position: LatLng;
      level?: string;
    };

export type IndoorRoutePlanResult = {
  route: IndoorRoute;
};

function resolveEndpoint(
  data: NonNullable<ReturnType<typeof loadBuilding>>,
  buildingCode: string,
  endpoint: IndoorRouteEndpoint,
  fallbackLevel: string,
): { position: LatLng; level: string } | null {
  if ('roomRef' in endpoint) {
    const room = resolveRoom(endpoint.roomRef, data.roomIndex, buildingCode);
    if (!room) return null;
    return { position: room.position, level: room.level };
  }

  return {
    position: endpoint.position,
    level: endpoint.level ?? fallbackLevel,
  };
}

/**
 * Compute an indoor route between two endpoints (rooms or coordinates).
 */
export function computeIndoorRoute(
  buildingCode: string,
  from: IndoorRouteEndpoint,
  to: IndoorRouteEndpoint,
  options: PathfinderOptions = {},
): IndoorRoutePlanResult | null {
  const code = buildingCode.toUpperCase();
  const data = loadBuilding(code);
  if (!data) return null;

  const meta = getBuildingMeta(code);
  const fallbackLevel = meta?.defaultLevel ?? data.levels[0] ?? '1';

  const start = resolveEndpoint(data, code, from, fallbackLevel);
  const end = resolveEndpoint(data, code, to, fallbackLevel);
  if (!start || !end) return null;

  const startNode = data.graph.findClosestNode(start.position, start.level);
  const endNode = data.graph.findClosestNode(end.position, end.level);
  if (!startNode || !endNode) return null;

  const route = findPath(data.graph, startNode.id, endNode.id, options);
  if (!route) return null;

  return { route };
}
