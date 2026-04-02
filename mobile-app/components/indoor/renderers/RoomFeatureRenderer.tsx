import React from 'react';
import { Polygon } from 'react-native-maps';
import type { IndoorRoom } from '../../../services/indoor/types';
import type { ResolvedRoom } from '../../../services/indoor/roomResolver';
import type { FeatureRenderer, IndoorFeatureRendererParams } from './FeatureRenderer';
import { RoomLabelMarker } from './markers';

function toResolvedRoom(room: IndoorRoom, activeLevel: string, ref: string): ResolvedRoom {
  return {
    featureId: room.id,
    ref,
    level: activeLevel,
    position: room.centroid,
    polygon: room.polygon,
  };
}

function toShortRoomLabel(ref: string): string | null {
  let shortLabel = ref.replace(/^[A-Z]{1,3}-/i, '');

  if (/^elevator/i.test(shortLabel)) return null;
  if (/^bath-W/i.test(shortLabel)) shortLabel = 'WC ♀';
  else if (/^bath-M/i.test(shortLabel)) shortLabel = 'WC ♂';
  else if (/^bath/i.test(shortLabel)) shortLabel = 'WC';
  else if (/^stair/i.test(shortLabel)) shortLabel = 'Stairs';
  else if (/^escalator/i.test(shortLabel)) shortLabel = 'Esc.';

  return shortLabel;
}

export class RoomFeatureRenderer implements FeatureRenderer {
  readonly key = 'rooms' as const;

  render(params: IndoorFeatureRendererParams): React.ReactNode {
    const { activeLevel, colors, filteredRooms, onRoomPress, rooms, selectedRoom } = params;

    return (
      <>
        {filteredRooms.map((room) => {
          if (room.polygon.length < 3) return null;

          const isSelected = selectedRoom?.featureId === room.id;
          const resolvedRoom = room.ref ? toResolvedRoom(room, activeLevel, room.ref) : null;

          return (
            <Polygon
              key={room.id}
              coordinates={room.polygon}
              holes={room.holes}
              fillColor={isSelected ? colors.roomSelectedFill : colors.roomFill}
              strokeColor={isSelected ? colors.roomSelectedStroke : colors.roomStroke}
              strokeWidth={isSelected ? 2 : 1}
              zIndex={3}
              tappable={!!onRoomPress && !!resolvedRoom}
              onPress={resolvedRoom && onRoomPress ? () => onRoomPress(resolvedRoom) : undefined}
            />
          );
        })}

        {(() => {
          const renderedRefs = new Set<string>();

          return rooms.map((room) => {
            if (!room.ref || room.polygon.length < 3) return null;
            if (renderedRefs.has(room.ref)) return null;

            renderedRefs.add(room.ref);
            const shortLabel = toShortRoomLabel(room.ref);
            if (!shortLabel) return null;

            const resolvedRoom = toResolvedRoom(room, activeLevel, room.ref);

            return (
              <RoomLabelMarker
                key={`label-${room.ref}`}
                room={room}
                shortLabel={shortLabel}
                onPress={onRoomPress ? () => onRoomPress(resolvedRoom) : undefined}
              />
            );
          });
        })()}
      </>
    );
  }
}
