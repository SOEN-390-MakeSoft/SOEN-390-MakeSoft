import React, { useMemo } from 'react';
import { Marker, Polygon, Polyline } from 'react-native-maps';
import type {
  IndoorArea,
  IndoorFeature,
  IndoorRoute,
  IndoorLevelOutline,
} from '../../services/indoor/types';
import type { ResolvedRoom } from '../../services/indoor/roomResolver';
import type { IndoorPoiPressTarget } from './renderers/FeatureRenderer';
import { getIndoorOverlayColors } from './renderers/colorPalette';
import { createDefaultIndoorFeatureRenderers } from './renderers/defaultIndoorFeatureRenderers';
import { categorizeIndoorFeatures } from './renderers/featureBuckets';
import {
  computeLevelCentroid,
  getFilteredRooms,
  getRouteSegmentsOnLevel,
} from './renderers/renderingRules';

interface IndoorMapOverlayProps {
  activeLevelFeatures: IndoorFeature[];
  route: IndoorRoute | null;
  activeLevel: string;
  destinationRoom: ResolvedRoom | null;
  selectedRoom?: ResolvedRoom | null;
  onRoomPress?: (room: ResolvedRoom) => void;
  onPoiPress?: (poi: IndoorPoiPressTarget) => void;
  routeColor?: string;
  visiblePoiAmenities?: string[];
  categoryFilter?: string | null;
  isColorBlind?: boolean;
}

function renderLevelOutlines(
  outlines: IndoorLevelOutline[],
  fillColor: string,
  strokeColor: string,
) {
  return outlines.map((feature) =>
    feature.polygon.length > 2 ? (
      <Polygon
        key={feature.id}
        coordinates={feature.polygon}
        fillColor={fillColor}
        strokeColor={strokeColor}
        strokeWidth={1}
        zIndex={1}
        tappable={false}
      />
    ) : null,
  );
}

function renderAreas(areas: IndoorArea[], fillColor: string, strokeColor: string) {
  return areas.map((feature) =>
    feature.polygon.length > 2 ? (
      <Polygon
        key={feature.id}
        coordinates={feature.polygon}
        fillColor={fillColor}
        strokeColor={strokeColor}
        strokeWidth={0.5}
        zIndex={2}
        tappable={false}
      />
    ) : null,
  );
}

export default function IndoorMapOverlay({
  activeLevelFeatures,
  route,
  activeLevel,
  destinationRoom,
  selectedRoom = null,
  onRoomPress,
  onPoiPress,
  routeColor = '#1a73e8',
  visiblePoiAmenities,
  categoryFilter,
  isColorBlind = false,
}: Readonly<IndoorMapOverlayProps>) {
  const renderers = useMemo(() => createDefaultIndoorFeatureRenderers(), []);

  const { outlines, areas, rooms, stairs, escalators, elevators, pois } = useMemo(
    () => categorizeIndoorFeatures(activeLevelFeatures),
    [activeLevelFeatures],
  );

  const routeSegmentsOnLevel = useMemo(
    () => getRouteSegmentsOnLevel(route, activeLevel),
    [route, activeLevel],
  );

  const levelCentroid = useMemo(() => computeLevelCentroid(rooms), [rooms]);
  const filteredRooms = useMemo(
    () => getFilteredRooms(rooms, levelCentroid),
    [rooms, levelCentroid],
  );

  if (activeLevelFeatures.length === 0) return null;

  const batchKey = `indoor-${activeLevel}-${activeLevelFeatures.length}`;
  const colors = getIndoorOverlayColors(isColorBlind);

  const rendererParams = {
    activeLevel,
    categoryFilter,
    visiblePoiAmenities,
    isColorBlind,
    selectedRoom,
    onRoomPress,
    onPoiPress,
    rooms,
    filteredRooms,
    stairs,
    escalators,
    elevators,
    pois,
    levelCentroid,
    colors,
  };

  return (
    <React.Fragment key={batchKey}>
      {renderLevelOutlines(outlines, colors.outlineFill, colors.outlineStroke)}
      {renderAreas(areas, colors.areaFill, colors.outlineStroke)}

      {renderers.map((renderer) => (
        <React.Fragment key={renderer.key}>{renderer.render(rendererParams)}</React.Fragment>
      ))}

      {routeSegmentsOnLevel.length > 1 && (
        <>
          <Polyline
            coordinates={routeSegmentsOnLevel}
            strokeColor="rgba(10, 50, 120, 0.45)"
            strokeWidth={8}
            zIndex={19}
          />
          <Polyline
            coordinates={routeSegmentsOnLevel}
            strokeColor={routeColor}
            strokeWidth={5}
            zIndex={20}
          />
        </>
      )}

      {destinationRoom && (
        <Marker
          coordinate={destinationRoom.position}
          title={destinationRoom.ref}
          pinColor="#1a73e8"
          zIndex={30}
        />
      )}
    </React.Fragment>
  );
}
