import React from 'react';
import { Image, type ImageSourcePropType } from 'react-native';
import { Polygon } from 'react-native-maps';
import type { IndoorPOI } from '../../../services/indoor/types';
import type { FeatureRenderer, IndoorFeatureRendererParams } from './FeatureRenderer';
import { PoiMarker, indoorMarkerStyles } from './markers';

function getPoiImageSource(imagePath?: string): ImageSourcePropType | null {
  if (!imagePath) return null;

  const imageMap: Record<string, ImageSourcePropType> = {
    'assets/images/women_bathroom.png': require('../../../assets/images/women_bathroom.png'),
    'assets/images/men_bathroom.png': require('../../../assets/images/men_bathroom.png'),
    'assets/images/unisex_bathroom.png': require('../../../assets/images/unisex_bathroom.png'),
    'assets/images/water_fountain.png': require('../../../assets/images/water_fountain.png'),
  };

  return imageMap[imagePath] ?? null;
}

function getBathroomImagePath(
  amenity: string,
  male?: boolean,
  female?: boolean,
): string | undefined {
  if (amenity !== 'toilets') return undefined;

  if (male && female) return 'assets/images/unisex_bathroom.png';
  if (male && !female) return 'assets/images/men_bathroom.png';
  if (female && !male) return 'assets/images/women_bathroom.png';

  return 'assets/images/unisex_bathroom.png';
}

function getImagePathForAmenity(
  amenity: string,
  male?: boolean,
  female?: boolean,
): string | undefined {
  if (amenity === 'toilets') {
    return getBathroomImagePath(amenity, male, female);
  }

  if (amenity === 'drinking_water') {
    return 'assets/images/water_fountain.png';
  }

  return undefined;
}

function getPoiColorChannels(amenity: string, isColorBlind: boolean): { baseChannel: string } {
  const bathroomChannel = isColorBlind ? '255, 150, 100' : '100, 150, 255';
  const waterChannel = isColorBlind ? '255, 200, 100' : '100, 200, 255';

  switch (amenity) {
    case 'drinking_water':
      return { baseChannel: waterChannel };
    case 'toilets':
    default:
      return { baseChannel: bathroomChannel };
  }
}

function getPoiFillColor(amenity: string, isHighlighted: boolean, isColorBlind: boolean): string {
  const { baseChannel } = getPoiColorChannels(amenity, isColorBlind);
  const alphaHighlighted = '0.15';
  const alphaMuted = '0.05';
  const alpha = isHighlighted ? alphaHighlighted : alphaMuted;

  return `rgba(${baseChannel}, ${alpha})`;
}

function getPoiStrokeColor(amenity: string, isHighlighted: boolean, isColorBlind: boolean): string {
  const { baseChannel } = getPoiColorChannels(amenity, isColorBlind);
  const alphaHighlighted = '0.6';
  const alphaMuted = '0.2';
  const alpha = isHighlighted ? alphaHighlighted : alphaMuted;

  return `rgba(${baseChannel}, ${alpha})`;
}

function renderPointPoi(
  poi: IndoorPOI,
  isHighlighted: boolean,
  onPoiPress?: (poi: IndoorPOI) => void,
  testID?: string,
): React.ReactNode {
  if (!poi.position) return null;

  const imagePath = getImagePathForAmenity(poi.amenity, poi.male, poi.female);
  const imageSource = getPoiImageSource(imagePath);
  if (!imageSource) return null;

  return (
    <PoiMarker
      key={poi.id}
      coordinate={poi.position}
      zIndex={15}
      opacity={isHighlighted ? 1 : 0.3}
      onPress={onPoiPress ? () => onPoiPress(poi) : undefined}
      testID={testID}
      accessibilityLabel={testID ? `POI ${poi.amenity}` : undefined}
    >
      <Image source={imageSource} style={indoorMarkerStyles.poiIconImage} fadeDuration={0} />
    </PoiMarker>
  );
}

function renderPolygonPoi(
  poi: IndoorPOI,
  isHighlighted: boolean,
  isColorBlind: boolean,
  onPoiPress?: (poi: IndoorPOI) => void,
  testID?: string,
): React.ReactNode {
  if (!poi.polygon || poi.polygon.length <= 2 || !poi.centroid) return null;

  const strokeColor = getPoiStrokeColor(poi.amenity, isHighlighted, isColorBlind);
  const fillColor = getPoiFillColor(poi.amenity, isHighlighted, isColorBlind);
  const imagePath = getImagePathForAmenity(poi.amenity, poi.male, poi.female);
  const imageSource = getPoiImageSource(imagePath);

  return (
    <React.Fragment key={poi.id}>
      <Polygon
        coordinates={poi.polygon}
        fillColor={fillColor}
        strokeColor={strokeColor}
        strokeWidth={1.5}
        zIndex={5}
        tappable={!!onPoiPress}
        onPress={onPoiPress ? () => onPoiPress(poi) : undefined}
      />
      {imageSource && (
        <PoiMarker
          coordinate={poi.centroid}
          zIndex={12}
          opacity={isHighlighted ? 1 : 0.3}
          onPress={onPoiPress ? () => onPoiPress(poi) : undefined}
          testID={testID}
          accessibilityLabel={testID ? `POI ${poi.amenity}` : undefined}
        >
          <Image source={imageSource} style={indoorMarkerStyles.poiIconImage} fadeDuration={0} />
        </PoiMarker>
      )}
    </React.Fragment>
  );
}

function renderPoiFeature(
  poi: IndoorPOI,
  isHighlighted: boolean,
  isColorBlind: boolean,
  onPoiPress?: (poi: IndoorPOI) => void,
  testID?: string,
): React.ReactNode {
  if (poi.position && !poi.polygon) {
    return renderPointPoi(poi, isHighlighted, onPoiPress, testID);
  }

  if (poi.polygon && poi.polygon.length > 2) {
    return renderPolygonPoi(poi, isHighlighted, isColorBlind, onPoiPress, testID);
  }

  return null;
}

export class PoiFeatureRenderer implements FeatureRenderer {
  readonly key = 'pois' as const;

  render(params: IndoorFeatureRendererParams): React.ReactNode {
    const { isColorBlind, onPoiPress, pois, visiblePoiAmenities } = params;

    return (
      <>
        {pois.map((poi) => {
          const isHighlighted = !visiblePoiAmenities || visiblePoiAmenities.includes(poi.amenity);
          const testID = `poi-${poi.amenity}-${poi.id}`;

          return renderPoiFeature(poi, isHighlighted, isColorBlind, onPoiPress, testID);
        })}
      </>
    );
  }
}
