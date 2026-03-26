import Smartlook, { Properties } from 'react-native-smartlook-analytics';

async function track(name: string, props?: Record<string, string>) {
  try {
    const p = new Properties();
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        p.putString(key, value);
      }
    }
    await Smartlook.instance.analytics.trackEvent(name, p);
  } catch {
    // Smartlook may not be initialized (e.g. missing key, Expo Go)
  }
}

// ── Epic 1: Campus & Buildings ──────────────────────────────────────────

export function trackCampusSwitched(from: string, to: string) {
  track('campus_switched', { from_campus: from, to_campus: to });
}

export function trackBuildingSelected(
  buildingName: string,
  buildingCode: string | null,
  campus: string,
  method: 'polygon_tap' | 'search' | 'quick_pick' | 'map_tap',
) {
  track('building_selected', {
    building_name: buildingName,
    building_code: buildingCode ?? '',
    campus,
    method,
  });
}

export function trackBuildingInfoViewed(buildingName: string, campus: string) {
  track('building_info_viewed', { building_name: buildingName, campus });
}

export function trackBuildingDirectionsTapped(buildingName: string) {
  track('building_directions_tapped', { building_name: buildingName });
}

// ── Epic 2: Outdoor Navigation ──────────────────────────────────────────

export function trackNavigationOpened(destination: string) {
  track('navigation_opened', { destination });
}

export function trackTransportModeSelected(mode: string, isCrossCampus: boolean) {
  track('transport_mode_selected', {
    mode,
    is_cross_campus: String(isCrossCampus),
  });
}

export function trackWalkingVariantSelected(variant: string) {
  track('walking_variant_selected', { variant });
}

export function trackCurrentLocationUsed() {
  track('current_location_used');
}

export function trackRouteDisplayed(start: string, destination: string, mode: string) {
  track('route_displayed', { start, destination, mode });
}

export function trackRoutePreviewOpened() {
  track('route_preview_opened');
}

export function trackRoutePreviewCompleted() {
  track('route_preview_completed');
}

export function trackDirectionsModeOpened() {
  track('directions_mode_opened');
}

export function trackDirectionsModeCompleted() {
  track('directions_mode_completed');
}

export function trackShuttleInfoViewed(departureCampus: string) {
  track('shuttle_info_viewed', { departure_campus: departureCampus });
}

export function trackLocateMeClicked() {
  track('locate_me_clicked');
}

// ── Epic 3: Calendar ────────────────────────────────────────────────────

export function trackCalendarModalOpened() {
  track('calendar_modal_opened');
}

export function trackCalendarConnected() {
  track('calendar_connected');
}

export function trackCalendarDisconnected() {
  track('calendar_disconnected');
}

export function trackNextClassDirectionsTapped() {
  track('next_class_directions_tapped');
}

export function trackNextClassGoTapped(building: string, room: string | null) {
  track('next_class_go_tapped', {
    building,
    room: room ?? '',
  });
}

export function trackNextClassInfoClicked() {
  track('next_class_info_clicked');
}

export function trackGetStartedClicked() {
  track('get_started_clicked');
}

export function trackColorBlindToggled(enabled: boolean, source: 'map_menu' | 'menu_screen') {
  track('color_blind_toggled', {
    enabled: String(enabled),
    source,
  });
}

// ── Epic 4: Indoor Navigation ───────────────────────────────────────────

export function trackIndoorMapActivated(
  buildingCode: string,
  method: 'zoom' | 'search' | 'navigate' | 'room_tap',
) {
  track('indoor_map_activated', { building_code: buildingCode, method });
}

export function trackIndoorRoomSearched(query: string) {
  track('indoor_room_searched', { query });
}

export function trackIndoorRoomSelected(roomRef: string, buildingCode: string) {
  track('indoor_room_selected', { room_ref: roomRef, building_code: buildingCode });
}

export function trackIndoorNavigateTapped(roomRef: string) {
  track('indoor_navigate_tapped', { room_ref: roomRef });
}

export function trackFloorChanged(buildingCode: string, level: string) {
  track('floor_changed', { building_code: buildingCode, level });
}

export function trackAccessibleRouteToggled(enabled: boolean) {
  track('accessible_route_toggled', { enabled: String(enabled) });
}

// ── Epic 4: Indoor Points of Interest ───────────────────────────────────

export function trackIndoorPoiCategoryFiltered(category: string) {
  track('indoor_poi_category_filtered', { category });
}

export function trackIndoorPoiTapped(poiType: string) {
  track('indoor_poi_tapped', { poi_type: poiType });
}

// ── Epic 5: Outdoor Points of Interest ──────────────────────────────────

export function trackOutdoorPoiSearched(query: string, resultCount: number) {
  track('outdoor_poi_searched', { query, result_count: String(resultCount) });
}

export function trackOutdoorPoiSelected(
  poiName: string,
  category: string,
  method: 'search' | 'marker',
) {
  track('outdoor_poi_selected', { poi_name: poiName, category, method });
}

export function trackOutdoorPoiDirectionsTapped(poiName: string, category: string) {
  track('outdoor_poi_directions_tapped', { poi_name: poiName, category });
}
