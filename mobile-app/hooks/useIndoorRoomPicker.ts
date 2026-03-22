import { useCallback, useMemo } from 'react';
import type { UseIndoorNavigationReturn } from './useIndoorNavigation';

type SearchEntry = {
  name: string;
  code: string | null;
  address: string | null;
};

interface UseIndoorRoomPickerArgs {
  indoor: UseIndoorNavigationReturn;
  isIndoorOnlyRoute: boolean;
  isAccessibleRouteEnabled: boolean;
}

/**
 * Derives the indoor room options list for NavigationMenu and handles
 * room selection (recomputing the indoor route when a room is picked
 * as start or destination).
 *
 * Extracted from MapScreen to keep indoor room-picker logic isolated.
 */
export function useIndoorRoomPicker({
  indoor,
  isIndoorOnlyRoute,
  isAccessibleRouteEnabled,
}: UseIndoorRoomPickerArgs) {
  const MAX_ROOM_SEARCH_RESULTS = 500;

  const indoorRoomOptions = useMemo<SearchEntry[] | undefined>(() => {
    if (!isIndoorOnlyRoute || !indoor.isIndoorActive) return undefined;
    const rooms = indoor.listRooms(MAX_ROOM_SEARCH_RESULTS);
    return rooms.map((room) => ({
      name: room.ref,
      code: indoor.activeBuildingCode,
      address: `${indoor.buildingMeta?.name ?? ''} \u00B7 Floor ${room.level}`,
    }));
  }, [
    isIndoorOnlyRoute,
    indoor.isIndoorActive,
    indoor.listRooms,
    indoor.activeBuildingCode,
    indoor.buildingMeta,
  ]);

  const handleIndoorRoomSelect = useCallback(
    (field: 'start' | 'destination', name: string): boolean => {
      if (!isIndoorOnlyRoute) return false;

      const routeOptions = isAccessibleRouteEnabled
        ? { avoidStairs: true, avoidEscalators: true, preferElevator: true }
        : {};

      const rooms = indoor.searchRooms(name, 1);
      const room = rooms[0];
      if (!room) return false;

      if (field === 'destination') {
        indoor.navigateToRoomAccessible(room.ref, routeOptions);
        return true;
      } else if (field === 'start' && indoor.destinationRoom) {
        indoor.navigateToRoomAccessible(
          indoor.destinationRoom.ref,
          routeOptions,
          room.position,
          room.level,
        );
        return true;
      }
      return false;
    },
    [isIndoorOnlyRoute, isAccessibleRouteEnabled, indoor],
  );

  return { indoorRoomOptions, handleIndoorRoomSelect };
}
