import { findPath, loadTunnelGraph } from '../../indoor';
import {
  distanceMeters,
  findBuildingAtOrNearCoordinate,
  type LatLng,
} from '../../../utils/mapUtils';
import { extractCodeFromName } from '../../../utils/stringUtils';
import {
  dedupePolyline,
  formatDistanceLabel,
  formatMinutesLabel,
  midpointOrFallback,
} from '../routeUtils';
import type { Building, ModeRoute, NavigationStep } from '../types';
import type { ModeRouteStrategy, ModeRouteStrategyContext } from './ModeRouteStrategy';

const WALK_SPEED_MPS = 1.4;
const TUNNEL_ROUTE_VIA_TEXT = 'Underground tunnel network';
const TUNNEL_GRAPH_SNAP_MAX_METERS = 25;

type TunnelAccessPoint = {
  code: string;
  level: string;
  position: LatLng;
  label: string;
};

const SGW_TUNNEL_ACCESS: Record<string, TunnelAccessPoint> = {
  H: {
    code: 'H',
    level: '-1',
    position: { latitude: 45.49684, longitude: -73.57881 },
    label: 'Hall basement tunnel entrance',
  },
  EV: {
    code: 'EV',
    level: '-1',
    position: { latitude: 45.49593, longitude: -73.57845 },
    label: 'EV metro tunnel entrance',
  },
  GM: {
    code: 'GM',
    level: '-1',
    position: { latitude: 45.49608, longitude: -73.57872 },
    label: 'GM metro tunnel entrance',
  },
  LB: {
    code: 'LB',
    level: '-1',
    position: { latitude: 45.4969, longitude: -73.57839 },
    label: 'LB basement tunnel entrance',
  },
  MB: {
    code: 'MB',
    level: '-2',
    position: { latitude: 45.49523, longitude: -73.57852 },
    label: 'MB lower tunnel entrance',
  },
};

function resolveTunnelBuilding(
  point: LatLng,
  buildings: readonly Building[],
): { building: Building; access: TunnelAccessPoint } | null {
  const building = findBuildingAtOrNearCoordinate(point, buildings, 150);
  if (!building) return null;

  const buildingCode = (building.code ?? extractCodeFromName(building.name) ?? '').toUpperCase();
  const access = SGW_TUNNEL_ACCESS[buildingCode];
  if (!access) return null;

  return { building, access };
}

function buildTunnelModeRoute(
  origin: LatLng,
  destination: LatLng,
  buildings: readonly Building[],
): ModeRoute | null {
  const originTunnel = resolveTunnelBuilding(origin, buildings);
  const destinationTunnel = resolveTunnelBuilding(destination, buildings);
  if (!originTunnel || !destinationTunnel) return null;
  if (originTunnel.access.code === destinationTunnel.access.code) return null;

  const tunnelGraph = loadTunnelGraph('SGW');
  if (!tunnelGraph) return null;

  const startNode = tunnelGraph.findClosestNode(
    originTunnel.access.position,
    originTunnel.access.level,
  );
  const endNode = tunnelGraph.findClosestNode(
    destinationTunnel.access.position,
    destinationTunnel.access.level,
  );
  if (!startNode || !endNode) return null;

  if (
    distanceMeters(startNode.position, originTunnel.access.position) >
      TUNNEL_GRAPH_SNAP_MAX_METERS ||
    distanceMeters(endNode.position, destinationTunnel.access.position) >
      TUNNEL_GRAPH_SNAP_MAX_METERS
  ) {
    return null;
  }

  const tunnelRoute = findPath(tunnelGraph, startNode.id, endNode.id);
  if (!tunnelRoute) return null;

  const walkToTunnelDistance = distanceMeters(origin, originTunnel.access.position);
  const walkFromTunnelDistance = distanceMeters(destinationTunnel.access.position, destination);
  const walkToTunnelSeconds = walkToTunnelDistance / WALK_SPEED_MPS;
  const walkFromTunnelSeconds = walkFromTunnelDistance / WALK_SPEED_MPS;
  const totalDistanceMeters =
    walkToTunnelDistance + tunnelRoute.totalDistanceMeters + walkFromTunnelDistance;
  const totalDurationSeconds =
    walkToTunnelSeconds + tunnelRoute.totalEstimatedSeconds + walkFromTunnelSeconds;

  const steps: NavigationStep[] = [];

  if (walkToTunnelDistance >= 5) {
    steps.push({
      instruction: `Go to the tunnel entrance in ${originTunnel.building.name}`,
      distanceText: formatDistanceLabel(walkToTunnelDistance),
      durationText: formatMinutesLabel(walkToTunnelSeconds),
      focusCoordinate: originTunnel.access.position,
    });
  }

  steps.push({
    instruction: `Enter the tunnel at ${originTunnel.access.label} on level ${originTunnel.access.level}`,
    distanceText: '',
    durationText: '',
    focusCoordinate: originTunnel.access.position,
  });

  for (const step of tunnelRoute.steps) {
    steps.push({
      instruction: step.instruction,
      distanceText: formatDistanceLabel(step.distanceMeters),
      durationText: formatMinutesLabel(step.estimatedSeconds),
      focusCoordinate: midpointOrFallback(step.path, step.path.at(-1) ?? step.path[0]),
      maneuver: step.edgeType,
    });
  }

  steps.push({
    instruction: `Exit the tunnel toward ${destinationTunnel.building.name}`,
    distanceText: '',
    durationText: '',
    focusCoordinate: destinationTunnel.access.position,
  });

  if (walkFromTunnelDistance >= 5) {
    steps.push({
      instruction: `Walk to ${destinationTunnel.building.name}`,
      distanceText: formatDistanceLabel(walkFromTunnelDistance),
      durationText: formatMinutesLabel(walkFromTunnelSeconds),
      focusCoordinate: destination,
    });
  }

  return {
    durationText: formatMinutesLabel(totalDurationSeconds),
    durationSec: Math.round(totalDurationSeconds),
    distanceText: formatDistanceLabel(totalDistanceMeters),
    viaText: TUNNEL_ROUTE_VIA_TEXT,
    polyline: dedupePolyline([
      origin,
      originTunnel.access.position,
      ...tunnelRoute.polyline,
      destinationTunnel.access.position,
      destination,
    ]),
    steps,
  };
}

export class TunnelWalkingRouteStrategy implements ModeRouteStrategy {
  readonly key = 'tunnelWalking' as const;

  async execute(context: ModeRouteStrategyContext): Promise<ModeRoute | null> {
    const { origin, destination, buildings } = context;
    return buildTunnelModeRoute(origin, destination, buildings);
  }
}
