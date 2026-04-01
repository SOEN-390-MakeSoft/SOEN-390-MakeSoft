import React from 'react';
import type {
  IndoorElevator,
  IndoorEscalator,
  IndoorPOI,
  IndoorRoom,
  IndoorStairs,
  LatLng,
} from '../../../services/indoor/types';
import type { ResolvedRoom } from '../../../services/indoor/roomResolver';
import type { IndoorOverlayColors } from './IndoorOverlayColors';

export type IndoorFeatureRendererKey = 'rooms' | 'stairs' | 'verticalTransport' | 'pois';

export type IndoorPoiPressTarget =
  | IndoorPOI
  | (IndoorEscalator & { type: 'escalator' })
  | (IndoorElevator & { type: 'elevator' });

export interface IndoorFeatureRendererParams {
  activeLevel: string;
  categoryFilter?: string | null;
  visiblePoiAmenities?: string[];
  isColorBlind: boolean;
  selectedRoom?: ResolvedRoom | null;
  onRoomPress?: (room: ResolvedRoom) => void;
  onPoiPress?: (poi: IndoorPoiPressTarget) => void;
  rooms: IndoorRoom[];
  filteredRooms: IndoorRoom[];
  stairs: IndoorStairs[];
  escalators: IndoorEscalator[];
  elevators: IndoorElevator[];
  pois: IndoorPOI[];
  levelCentroid: LatLng | null;
  colors: IndoorOverlayColors;
}

export interface FeatureRenderer {
  key: IndoorFeatureRendererKey;
  render(params: IndoorFeatureRendererParams): React.ReactNode;
}
