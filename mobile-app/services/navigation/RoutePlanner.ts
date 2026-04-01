import type { ModeRoute, WalkingRouteVariant } from './types';
import type {
  ModeRouteStrategy,
  ModeRouteStrategyContext,
  ModeRouteStrategyKey,
} from './strategies/ModeRouteStrategy';

export type PlannedModeRoutes = {
  driving: ModeRoute | null;
  outdoorWalking: ModeRoute | null;
  tunnelWalking: ModeRoute | null;
  preferredWalkingVariant: WalkingRouteVariant;
};

export class RoutePlanner {
  constructor(private readonly strategies: readonly ModeRouteStrategy[]) {
    const seenKeys = new Set<ModeRouteStrategyKey>();
    for (const strategy of strategies) {
      if (seenKeys.has(strategy.key)) {
        throw new Error(`Duplicate route strategy key: ${strategy.key}`);
      }
      seenKeys.add(strategy.key);
    }
  }

  async plan(context: ModeRouteStrategyContext): Promise<PlannedModeRoutes> {
    const resultMap = new Map<ModeRouteStrategyKey, ModeRoute | null>();

    await Promise.all(
      this.strategies.map(async (strategy) => {
        try {
          const route = await strategy.execute(context);
          resultMap.set(strategy.key, route);
        } catch {
          resultMap.set(strategy.key, null);
        }
      }),
    );

    const outdoorWalking = resultMap.get('outdoorWalking') ?? null;
    const tunnelWalking = resultMap.get('tunnelWalking') ?? null;
    const preferredWalkingVariant = this.resolvePreferredWalkingVariant(
      outdoorWalking,
      tunnelWalking,
    );

    return {
      driving: resultMap.get('driving') ?? null,
      outdoorWalking,
      tunnelWalking,
      preferredWalkingVariant,
    };
  }

  private resolvePreferredWalkingVariant(
    outdoorWalking: ModeRoute | null,
    tunnelWalking: ModeRoute | null,
  ): WalkingRouteVariant {
    if (outdoorWalking && tunnelWalking) {
      return tunnelWalking.durationSec <= outdoorWalking.durationSec ? 'tunnel' : 'outdoor';
    }
    if (tunnelWalking) return 'tunnel';
    return 'outdoor';
  }
}
