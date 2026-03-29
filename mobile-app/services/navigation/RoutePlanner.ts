import type { ModeRoute, WalkingRouteVariant } from './types';
import type { ModeRouteStrategy, ModeRouteStrategyContext } from './strategies/ModeRouteStrategy';

export type PlannedModeRoutes = {
  driving: ModeRoute | null;
  outdoorWalking: ModeRoute | null;
  tunnelWalking: ModeRoute | null;
  preferredWalkingVariant: WalkingRouteVariant;
};

export class RoutePlanner {
  constructor(private readonly strategies: readonly ModeRouteStrategy[]) {}

  async plan(context: ModeRouteStrategyContext): Promise<PlannedModeRoutes> {
    const resultMap = new Map<string, ModeRoute | null>();

    await Promise.all(
      this.strategies.map(async (strategy) => {
        const route = await strategy.execute(context);
        resultMap.set(strategy.key, route);
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
