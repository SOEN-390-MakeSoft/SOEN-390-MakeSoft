import type { FeatureRenderer, IndoorFeatureRendererKey } from './FeatureRenderer';
import { FeatureRendererFactory } from './FeatureRendererFactory';
import { PoiFeatureRenderer } from './PoiFeatureRenderer';
import { RoomFeatureRenderer } from './RoomFeatureRenderer';
import { StairsFeatureRenderer } from './StairsFeatureRenderer';
import { VerticalTransportFeatureRenderer } from './VerticalTransportFeatureRenderer';

export const DEFAULT_INDOOR_RENDERER_ORDER: readonly IndoorFeatureRendererKey[] = [
  'rooms',
  'stairs',
  'verticalTransport',
  'pois',
];

function createDefaultFactory(): FeatureRendererFactory {
  const factory = new FeatureRendererFactory();

  factory.register('rooms', () => new RoomFeatureRenderer());
  factory.register('stairs', () => new StairsFeatureRenderer());
  factory.register('verticalTransport', () => new VerticalTransportFeatureRenderer());
  factory.register('pois', () => new PoiFeatureRenderer());

  return factory;
}

export function createDefaultIndoorFeatureRenderers(): FeatureRenderer[] {
  return createDefaultFactory().createMany(DEFAULT_INDOOR_RENDERER_ORDER);
}
