/**
 * Indoor navigation system — public API surface.
 *
 * Import everything the rest of the app needs from this single entry point:
 *
 *   import { loadBuilding, findPath, resolveRoom } from '@/services/indoor';
 */

// Types
export type {
  IndoorFeature,
  IndoorRoom,
  IndoorCorridor,
  IndoorStairs,
  IndoorElevator,
  IndoorEscalator,
  IndoorDoor,
  IndoorPOI,
  IndoorLevelOutline,
  IndoorArea,
  IndoorRoute,
  IndoorNavStep,
  IndoorBuildingMeta,
  LevelledEntrance,
  OverlayBounds,
  GraphNode,
  GraphEdge,
  LatLng,
} from './types';

// GeoJSON parser
export { parseIndoorGeoJSON, groupByLevel, extractLevels } from './geojsonParser';

// Graph
export { IndoorGraph } from './IndoorGraph';

// Pathfinder
export { findPath } from './pathfinder';
export type { PathfinderOptions } from './pathfinder';

// Room resolver & POI search
export { buildRoomIndex, resolveRoom, searchRooms, findNearestPOI } from './roomResolver';
export type { ResolvedRoom, POICategory, NearestPOIResult } from './roomResolver';

// Building registry
export {
  INDOOR_BUILDINGS,
  hasIndoorMap,
  getBuildingMeta,
  loadBuilding,
  loadBuildingGraph,
  findBuildingAtCoordinate,
  detectIndoorDestination,
  getFloorPlanImage,
  clearCache,
} from './buildingRegistry';
