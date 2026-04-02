import React from 'react';
import { Image } from 'react-native';
import { Polygon } from 'react-native-maps';
import type { FeatureRenderer, IndoorFeatureRendererParams } from './FeatureRenderer';
import { calculatePolygonCentroid } from './geometry';
import { IconMarker, indoorMarkerStyles } from './markers';
import { getDisplayedElevators } from './renderingRules';

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

    const isVerticalTransportHighlighted =
      categoryFilter === 'elevators' || categoryFilter === null;

    const escalatorFeatures = escalators.map((escalator) => {
      if (escalator.polygon.length <= 2) return null;

      return (
        <React.Fragment key={escalator.id}>
          <Polygon
            coordinates={escalator.polygon}
            fillColor={
              isVerticalTransportHighlighted ? colors.escalatorFill : colors.escalatorFillMuted
            }
            strokeColor={
              isVerticalTransportHighlighted ? colors.escalator : colors.escalatorStrokeMuted
            }
            strokeWidth={1.5}
            zIndex={5}
            tappable={false}
          />
          <IconMarker
            coordinate={calculatePolygonCentroid(escalator.polygon)}
            zIndex={10}
            onPress={onPoiPress ? () => onPoiPress({ ...escalator, type: 'escalator' }) : undefined}
            opacity={isVerticalTransportHighlighted ? 1 : 0.3}
          >
            <Image
              source={require('../../../assets/images/escalator.png')}
              style={indoorMarkerStyles.iconImage}
              fadeDuration={0}
            />
          </IconMarker>
        </React.Fragment>
      );
    });

    const displayedElevators = getDisplayedElevators({
      elevators,
      rooms,
      filteredRooms,
      levelCentroid,
    });

    const elevatorFeatures = displayedElevators.map((elevator) => {
      return (
        <IconMarker
          key={elevator.id}
          coordinate={elevator.position}
          zIndex={15}
          onPress={onPoiPress ? () => onPoiPress({ ...elevator, type: 'elevator' }) : undefined}
          opacity={isVerticalTransportHighlighted ? 1 : 0.3}
        >
          <Image
            source={require('../../../assets/images/elevator.png')}
            style={indoorMarkerStyles.iconImage}
            fadeDuration={0}
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
