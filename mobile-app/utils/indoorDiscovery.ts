export const BUILDING_SELECTION_REGION_DELTA = 0.0032;
export const INDOOR_DISCOVERY_ZOOM_THRESHOLD = 0.002;
export const INDOOR_DISCOVERY_FOCUS_DELTA = 0.0016;

export function isIndoorZoomTooLow(latitudeDelta: number): boolean {
  return latitudeDelta >= INDOOR_DISCOVERY_ZOOM_THRESHOLD;
}
