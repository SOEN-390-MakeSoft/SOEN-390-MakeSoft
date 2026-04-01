import type { LatLng } from '../../../utils/mapUtils';
import type { Building, ModeRoute } from '../types';

export type ModeRouteStrategyContext = {
  origin: LatLng;
  destination: LatLng;
  currentTime: Date | null;
  buildings: readonly Building[];
  googleMapsApiKey?: string;
  fetchImpl: typeof fetch;
};

export type ModeRouteStrategyKey = 'driving' | 'outdoorWalking' | 'tunnelWalking';

export interface ModeRouteStrategy {
  readonly key: ModeRouteStrategyKey;
  execute(context: ModeRouteStrategyContext): Promise<ModeRoute | null>;
}
