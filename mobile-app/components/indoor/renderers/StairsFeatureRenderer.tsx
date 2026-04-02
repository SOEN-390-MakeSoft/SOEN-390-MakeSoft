import React from 'react';
import { Image } from 'react-native';
import { Polygon } from 'react-native-maps';
import type { FeatureRenderer } from './FeatureRenderer';
import { calculatePolygonCentroid } from './geometry';
import { IconMarker, indoorMarkerStyles } from './markers';

export class StairsFeatureRenderer implements FeatureRenderer {
  readonly key = 'stairs' as const;

  render({ colors, stairs }) {
    return (
      <>
        {stairs.map((stairsFeature) => {
          if (stairsFeature.polygon.length <= 2) return null;

          return (
            <React.Fragment key={stairsFeature.id}>
              <Polygon
                coordinates={stairsFeature.polygon}
                fillColor="rgba(180, 120, 40, 0.2)"
                strokeColor={colors.stairs}
                strokeWidth={1.5}
                zIndex={5}
                tappable={false}
              />
              <IconMarker coordinate={calculatePolygonCentroid(stairsFeature.polygon)} zIndex={10}>
                <Image
                  source={require('../../../assets/images/stairs.png')}
                  style={indoorMarkerStyles.iconImage}
                  fadeDuration={0}
                />
              </IconMarker>
            </React.Fragment>
          );
        })}
      </>
    );
  }
}
