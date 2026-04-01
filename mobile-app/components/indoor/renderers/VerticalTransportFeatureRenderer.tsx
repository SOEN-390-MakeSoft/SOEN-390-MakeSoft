import React from 'react';
import { Image } from 'react-native';
import { Polygon } from 'react-native-maps';
import { pointInPolygon } from '../../../utils/mapUtils';
import type { IndoorElevator } from '../../../services/indoor/types';
import type { FeatureRenderer, IndoorFeatureRendererParams } from './FeatureRenderer';
import { calculatePolygonCentroid } from './geometry';
import { IconMarker, indoorMarkerStyles } from './markers';

export class VerticalTransportFeatureRenderer implements FeatureRenderer {
  readonly key = 'verticalTransport' as const;

  render(params: IndoorFeatureRendererParams): React.ReactNode {
    const {
      categoryFilter,
      colors,
      escalators,
      elevators,
      filteredRooms,
      levelCentroid,
      onPoiPress,
      rooms,
    } = params;

    const escalatorFeatures = escalators.map((escalator) => {
      if (escalator.polygon.length <= 2) return null;

      const isHighlighted = categoryFilter === 'elevators' || categoryFilter === null;

      return (
        <React.Fragment key={escalator.id}>
          <Polygon
            coordinates={escalator.polygon}
            fillColor={isHighlighted ? 'rgba(140, 100, 180, 0.2)' : 'rgba(140, 100, 180, 0.05)'}
            strokeColor={isHighlighted ? colors.escalator : 'rgba(140, 100, 180, 0.2)'}
            strokeWidth={1.5}
            zIndex={5}
            tappable={false}
          />
          <IconMarker
            coordinate={calculatePolygonCentroid(escalator.polygon)}
            zIndex={10}
            onPress={onPoiPress ? () => onPoiPress({ ...escalator, type: 'escalator' }) : undefined}
            opacity={isHighlighted ? 1 : 0.3}
          >
            <Image
              source={require('../../../assets/images/escalator.png')}
              style={indoorMarkerStyles.iconImage}
            />
          </IconMarker>
        </React.Fragment>
      );
    });

    const groupedElevators: IndoorElevator[][] = [];

    for (const elevator of elevators) {
      let foundGroup = false;
      for (const group of groupedElevators) {
        const leader = group[0];
        const sameRef = elevator.ref && leader.ref && elevator.ref === leader.ref;
        const sameLevels = elevator.levels.join(',') === leader.levels.join(',');
        const distanceSquared =
          Math.pow(elevator.position.latitude - leader.position.latitude, 2) +
          Math.pow(elevator.position.longitude - leader.position.longitude, 2);
        const isClose = distanceSquared < 0.0000005;

        if (sameRef || (sameLevels && isClose)) {
          group.push(elevator);
          foundGroup = true;
          break;
        }
      }

      if (!foundGroup) groupedElevators.push([elevator]);
    }

    const isHallBuilding =
      elevators.some((elevator) => elevator.ref?.startsWith('H-')) ||
      rooms.some((room) => room.ref?.startsWith('H-'));

    const bestElevators = isHallBuilding
      ? elevators
      : groupedElevators.map((group) => {
          if (group.length === 1 || !levelCentroid) return group[0];

          return group.reduce((best, candidate) => {
            const bestDistanceSquared =
              Math.pow(best.position.latitude - levelCentroid.latitude, 2) +
              Math.pow(best.position.longitude - levelCentroid.longitude, 2);
            const candidateDistanceSquared =
              Math.pow(candidate.position.latitude - levelCentroid.latitude, 2) +
              Math.pow(candidate.position.longitude - levelCentroid.longitude, 2);

            return candidateDistanceSquared < bestDistanceSquared ? candidate : best;
          }, group[0]);
        });

    const elevatorPolygons = filteredRooms.filter((room) => /elevator/i.test(room.ref || ''));
    const displayedElevators = bestElevators.filter((elevator) => {
      if (elevatorPolygons.length === 0) return true;
      return elevatorPolygons.some((room) => pointInPolygon(elevator.position, room.polygon));
    });

    const elevatorFeatures = displayedElevators.map((elevator) => {
      const isHighlighted = categoryFilter === 'elevators' || categoryFilter === null;

      return (
        <IconMarker
          key={elevator.id}
          coordinate={elevator.position}
          zIndex={15}
          onPress={onPoiPress ? () => onPoiPress({ ...elevator, type: 'elevator' }) : undefined}
          opacity={isHighlighted ? 1 : 0.3}
        >
          <Image
            source={require('../../../assets/images/elevator.png')}
            style={indoorMarkerStyles.iconImage}
          />
        </IconMarker>
      );
    });

    return (
      <>
        {escalatorFeatures}
        {elevatorFeatures}
      </>
    );
  }
}
