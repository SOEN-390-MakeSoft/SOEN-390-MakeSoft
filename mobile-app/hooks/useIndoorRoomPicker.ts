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
}

/**
 * Derives the indoor room options list for NavigationMenu and handles
 * room selection (recomputing the indoor route when a room is picked
 * as start or destination).
 *
 * Extracted from MapScreen to keep indoor room-picker logic isolated.
 */
export function useIndoorRoomPicker({ indoor, isIndoorOnlyRoute }: UseIndoorRoomPickerArgs) {
  const indoorRoomOptions = useMemo<SearchEntry[] | undefined>(() => {
    if (!isIndoorOnlyRoute || !indoor.isIndoorActive) return undefined;
    const rooms = indoor.listRooms(500);
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

      const rooms = indoor.searchRooms(name, 1);
      const room = rooms[0];
      if (!room) return false;

      if (field === 'destination') {
        indoor.navigateToRoom(room.ref);
      } else if (field === 'start' && indoor.destinationRoom) {
        indoor.navigateToRoom(indoor.destinationRoom.ref, room.position, room.level);
      }
      return true;
    },
    [isIndoorOnlyRoute, indoor],
  );

  return { indoorRoomOptions, handleIndoorRoomSelect };
}
