/**
 * Shared types for the indoor navigation system.
 *
 * These types are intentionally decoupled from any UI framework so the
 * navigation engine can be tested and reused independently.
 */

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** A longitude/latitude pair in GeoJSON order [lng, lat]. */
export type GeoCoord = [number, number];

/** A simple lat/lng object matching react-native-maps conventions. */
export type LatLng = { latitude: number; longitude: number };

// ---------------------------------------------------------------------------
// Indoor feature categories (derived from the GeoJSON OSM-indoor schema)
// ---------------------------------------------------------------------------

export type IndoorFeatureType =
  | 'room'
  | 'corridor' // highway=footway LineStrings
  | 'stairs' // highway=steps or stairs=yes
  | 'elevator' // highway=elevator
  | 'escalator' // conveying=yes + stairs=yes
  | 'door'
  | 'level_outline' // indoor=level (full floor outline)
  | 'area' // indoor=area (open areas)
  | 'poi' // amenity-tagged features (café, theatre …)
  | 'unknown';

/** Properties common to every parsed indoor feature. */
export interface IndoorFeatureBase {
  /** Unique id within the building (generated during parse). */
  id: string;
  /** Classified feature type. */
  type: IndoorFeatureType;
  /** Levels this feature spans (e.g. ["1"], ["1","2"], ["2","8","9"]). */
  levels: string[];
  /** Human-readable reference if present (e.g. "H-840"). */
  ref: string | null;
  /** Raw GeoJSON properties preserved for extensions. */
  raw: Record<string, string | undefined>;
}

/** A room with a polygon outline. */
export interface IndoorRoom extends IndoorFeatureBase {
  type: 'room';
  polygon: LatLng[];
  holes?: LatLng[][];
  centroid: LatLng;
}

/** A walkable corridor segment (footway LineString). */
export interface IndoorCorridor extends IndoorFeatureBase {
  type: 'corridor';
  path: LatLng[];
}

/** Stairs / steps connecting two or more levels. */
export interface IndoorStairs extends IndoorFeatureBase {
  type: 'stairs';
  /** Polygon outline when available, otherwise empty. */
  polygon: LatLng[];
  /** LineString path when available (for routing). */
  path: LatLng[];
  /** Oneway direction: 'up' | 'down' | null (bidirectional). */
  oneway: 'up' | 'down' | null;
}

/** Elevator point connecting multiple levels. */
export interface IndoorElevator extends IndoorFeatureBase {
  type: 'elevator';
  position: LatLng;
  /** Connected levels. */
  levels: string[];
}

/** Escalator (conveying stairs). */
export interface IndoorEscalator extends IndoorFeatureBase {
  type: 'escalator';
  isElevator?: boolean;
  polygon: LatLng[];
  path: LatLng[];
  oneway: 'up' | 'down' | null;
}

/** A door / entrance point. */
export interface IndoorDoor extends IndoorFeatureBase {
  type: 'door';
  position: LatLng;
  /** Door kind: 'hinged' | 'no' | 'yes' | 'staircase' | …  */
  doorKind: string | null;
  /** True if the door is tagged as an entrance. */
  isEntrance: boolean;
}

/** A POI like a café, toilet, water fountain, etc. */
export interface IndoorPOI extends IndoorFeatureBase {
  type: 'poi';
  /** Position for point-based POIs (cafés, water fountains, etc.). */
  position?: LatLng;
  /** Polygon for area-based POIs (bathrooms, etc.). */
  polygon?: LatLng[];
  /** Centroid for area-based POIs (calculated from polygon). */
  centroid?: LatLng;
  amenity: string;
  name: string | null;
  /** Path to icon/image for rendering on the map. */
  image_path?: string;
  /** For amenity=toilets: Whether this facility accommodates males. */
  male?: boolean;
  /** For amenity=toilets: Whether this facility accommodates females. */
  female?: boolean;
}

/** Full building floor outline. */
export interface IndoorLevelOutline extends IndoorFeatureBase {
  type: 'level_outline';
  polygon: LatLng[];
  name: string | null;
}

/** Generic area. */
export interface IndoorArea extends IndoorFeatureBase {
  type: 'area';
  polygon: LatLng[];
}

/** Union of all typed indoor features. */
export type IndoorFeature =
  | IndoorRoom
  | IndoorCorridor
  | IndoorStairs
  | IndoorElevator
  | IndoorEscalator
  | IndoorDoor
  | IndoorPOI
  | IndoorLevelOutline
  | IndoorArea;

// ---------------------------------------------------------------------------
// Indoor graph types (used by the pathfinder)
// ---------------------------------------------------------------------------

/** A node in the indoor navigation graph. */
export interface GraphNode {
  id: string;
  position: LatLng;
  level: string;
  /** Feature ids that contributed this node (for reverse lookup). */
  featureIds: string[];
  /** True when this node is a vertical transition (stairs / elevator / escalator). */
  isTransition: boolean;
}

/** An edge in the indoor navigation graph. */
export interface GraphEdge {
  from: string; // GraphNode id
  to: string; // GraphNode id
  /** Approximate distance in meters. */
  weight: number;
  /** Whether this edge crosses levels. */
  isLevelChange: boolean;
  /** Edge type hint for step-by-step instructions. */
  edgeType: 'walk' | 'tunnel' | 'stairs' | 'elevator' | 'escalator';
  /**
   * Original corridor geometry for this edge (from → to direction).
   * When present the pathfinder uses these coordinates instead of just the
   * endpoint node positions, so the rendered polyline follows the actual
   * walkway instead of cutting through walls.
   */
  path?: LatLng[];
}

// ---------------------------------------------------------------------------
// Indoor navigation result
// ---------------------------------------------------------------------------

/** A single step in the indoor route instructions. */
export interface IndoorNavStep {
  instruction: string;
  fromLevel: string;
  toLevel: string;
  /** Polyline segment for this step (for rendering on the map). */
  path: LatLng[];
  distanceMeters: number;
  /** Estimated time in seconds for this step. */
  estimatedSeconds: number;
  edgeType: 'walk' | 'tunnel' | 'stairs' | 'elevator' | 'escalator';
}

/** The result returned by the pathfinder. */
export interface IndoorRoute {
  /** Total estimated distance in meters. */
  totalDistanceMeters: number;
  /** Total estimated time in seconds for the entire route. */
  totalEstimatedSeconds: number;
  /** Ordered list of graph node ids along the route. */
  nodeIds: string[];
  /** Full polyline for rendering. */
  polyline: LatLng[];
  /** Step-by-step instructions. */
  steps: IndoorNavStep[];
  /** Starting level. */
  startLevel: string;
  /** Ending level. */
  endLevel: string;
}

// ---------------------------------------------------------------------------
// Building registry
// ---------------------------------------------------------------------------

/** Geographic bounding box for placing an image overlay on the map. */
export interface OverlayBounds {
  /** South-west corner. */
  sw: LatLng;
  /** North-east corner. */
  ne: LatLng;
}

/** An indoor access point anchored to a specific level. */
export interface LevelledEntrance {
  /** Entrance coordinate. */
  position: LatLng;
  /** Indoor level where the access point lands. */
  level: string;
  /** Optional stable reference used to match external datasets. */
  ref?: string;
}

/** Metadata about an available indoor map. */
export interface IndoorBuildingMeta {
  /** Building code, e.g. "H". */
  code: string;
  /** Human-readable building name. */
  name: string;
  /** Available floor levels sorted ascending. */
  levels: string[];
  /** Building entrance coordinate (used to bridge outdoor → indoor). */
  entrances: LatLng[];
  /** Underground access points used to join tunnel and indoor graphs. */
  tunnelEntrances?: LevelledEntrance[];
  /** Path (or require key) to the GeoJSON asset. */
  geojsonAsset: string;
  /** Geographic bounds for the floor plan image overlay. */
  imageBounds: OverlayBounds;
  /** Bearing (clockwise degrees from north) to rotate the floor plan image. */
  overlayBearing?: number;
  /** The default floor level to show when no previous selection exists. */
  defaultLevel: string;
}
