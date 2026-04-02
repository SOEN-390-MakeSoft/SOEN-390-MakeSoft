import { FeatureRendererFactory } from '../components/indoor/renderers/FeatureRendererFactory';
import type { FeatureRenderer } from '../components/indoor/renderers/FeatureRenderer';

describe('FeatureRendererFactory', () => {
  it('creates registered renderers in requested order', () => {
    const factory = new FeatureRendererFactory();

    const roomsRenderer: FeatureRenderer = {
      key: 'rooms',
      render: () => null,
    };
    const stairsRenderer: FeatureRenderer = {
      key: 'stairs',
      render: () => null,
    };

    factory.register('rooms', () => roomsRenderer);
    factory.register('stairs', () => stairsRenderer);

    const created = factory.createMany(['stairs', 'rooms']);

    expect(created).toEqual([stairsRenderer, roomsRenderer]);
    expect(factory.keys()).toEqual(['rooms', 'stairs']);
  });

  it('throws when no renderer is registered for a key', () => {
    const factory = new FeatureRendererFactory();

    expect(() => factory.create('pois')).toThrow('No renderer registered for key: pois');
  });
});
