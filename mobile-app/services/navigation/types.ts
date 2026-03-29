import type { LatLng } from '../../utils/mapUtils';

export type Building = {
  id: string;
  name: string;
  code: string | null;
  polygon: readonly LatLng[];
};

export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type RouteSummary = {
  arrivalText: string;
  distanceText: string;
  durationText: string;
  viaText: string;
};

export type RouteMode = 'driving' | 'transit' | 'walking';

export type ModeDurations = {
  driving?: string;
  walking?: string;
};

export type TransportMode = 'driving' | 'walking' | 'shuttle';
export type WalkingRouteVariant = 'outdoor' | 'tunnel';

export type NavigationStep = {
  instruction: string;
  distanceText: string;
  durationText: string;
  maneuver?: string;
  focusCoordinate?: LatLng;
  focusRegion?: MapRegion;
};

export type ModeRoute = {
  durationText: string;
  durationSec: number;
  distanceText: string;
  viaText: string;
  polyline: LatLng[];
  steps: NavigationStep[];
};

export type WalkingModeRoutes = {
  outdoor?: ModeRoute | null;
  tunnel?: ModeRoute | null;
};

export type AllModeRoutes = {
  driving?: ModeRoute | null;
  walking?: WalkingModeRoutes;
};

export type WalkingRouteComparison = {
  originLabel: string;
  destinationLabel: string;
  activeVariant: WalkingRouteVariant;
  fastestVariant: WalkingRouteVariant;
  outdoor: {
    durationText: string;
    distanceText: string;
  };
  tunnel: {
    durationText: string;
    distanceText: string;
  };
};

export type ShuttleInfo = {
  departureTimes: (string | null)[];
  tripDurationMin: number;
  departureCampus: 'SGW' | 'LOY';
  walkToHubPolyline: LatLng[];
  shuttleSegmentPolyline: LatLng[];
  walkFromHubPolyline: LatLng[];
  walkToHubDurationMin?: number;
  walkFromHubDurationMin?: number;
  departureHubCoordinate?: LatLng;
  arrivalHubCoordinate?: LatLng;
  waitDurationMin?: number | null;
  hasDirections?: boolean;
};
