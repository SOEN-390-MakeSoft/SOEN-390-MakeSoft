import type { FeatureRenderer, IndoorFeatureRendererKey } from './FeatureRenderer';

export type FeatureRendererCreator = () => FeatureRenderer;

export class FeatureRendererFactory {
  private readonly registry = new Map<IndoorFeatureRendererKey, FeatureRendererCreator>();

  register(key: IndoorFeatureRendererKey, creator: FeatureRendererCreator): void {
    this.registry.set(key, creator);
  }

  create(key: IndoorFeatureRendererKey): FeatureRenderer {
    const creator = this.registry.get(key);
    if (!creator) {
      throw new Error(`No renderer registered for key: ${key}`);
    }
    return creator();
  }

  createMany(keys: readonly IndoorFeatureRendererKey[]): FeatureRenderer[] {
    return keys.map((key) => this.create(key));
  }

  keys(): IndoorFeatureRendererKey[] {
    return [...this.registry.keys()];
  }
}
