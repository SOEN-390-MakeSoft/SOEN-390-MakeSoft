import type { LatLng } from '../../../utils/mapUtils';
import type { ShuttleInfo } from '../types';

export type ShuttleStrategyContext = {
  origin: LatLng;
  destination: LatLng;
  currentTime: Date | null;
  googleMapsApiKey?: string;
  fetchImpl: typeof fetch;
};

export interface ShuttleStrategy {
  execute(context: ShuttleStrategyContext): Promise<ShuttleInfo | null>;
}
