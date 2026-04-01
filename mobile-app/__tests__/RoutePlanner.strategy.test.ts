import { RoutePlanner } from '../services/navigation/RoutePlanner';
import type {
  ModeRouteStrategy,
  ModeRouteStrategyKey,
} from '../services/navigation/strategies/ModeRouteStrategy';
import type { ModeRoute } from '../services/navigation/types';

const makeRoute = (durationSec: number, viaText: string): ModeRoute => ({
  durationText: `${Math.round(durationSec / 60)} min`,
  durationSec,
  distanceText: '1 km',
  viaText,
  polyline: [
    { latitude: 45.5, longitude: -73.57 },
    { latitude: 45.49, longitude: -73.58 },
  ],
  steps: [
    {
      instruction: 'Head north',
      distanceText: '1 km',
      durationText: '10 min',
    },
  ],
});

class FakeStrategy implements ModeRouteStrategy {
  constructor(
    public readonly key: ModeRouteStrategyKey,
    private readonly route: ModeRoute | null,
  ) {}

  async execute(): Promise<ModeRoute | null> {
    return this.route;
  }
}

class ThrowingStrategy implements ModeRouteStrategy {
  constructor(public readonly key: ModeRouteStrategyKey) {}

  async execute(): Promise<ModeRoute | null> {
    throw new Error(`Strategy failed for ${this.key}`);
  }
}

describe('RoutePlanner', () => {
  const baseContext = {
    origin: { latitude: 45.5, longitude: -73.57 },
    destination: { latitude: 45.49, longitude: -73.58 },
    currentTime: new Date('2026-03-29T10:00:00.000Z'),
    buildings: [],
    googleMapsApiKey: 'test-key',
    fetchImpl: jest.fn() as unknown as typeof fetch,
  };

  it('prefers tunnel walking when tunnel is faster than outdoor', async () => {
    const planner = new RoutePlanner([
      new FakeStrategy('driving', makeRoute(900, 'Drive route')),
      new FakeStrategy('outdoorWalking', makeRoute(840, 'Outdoor walk')),
      new FakeStrategy('tunnelWalking', makeRoute(600, 'Tunnel walk')),
    ]);

    const result = await planner.plan(baseContext);

    expect(result.driving?.viaText).toBe('Drive route');
    expect(result.outdoorWalking?.viaText).toBe('Outdoor walk');
    expect(result.tunnelWalking?.viaText).toBe('Tunnel walk');
    expect(result.preferredWalkingVariant).toBe('tunnel');
  });

  it('falls back to outdoor when tunnel route is unavailable', async () => {
    const planner = new RoutePlanner([
      new FakeStrategy('driving', makeRoute(900, 'Drive route')),
      new FakeStrategy('outdoorWalking', makeRoute(840, 'Outdoor walk')),
      new FakeStrategy('tunnelWalking', null),
    ]);

    const result = await planner.plan(baseContext);

    expect(result.outdoorWalking).not.toBeNull();
    expect(result.tunnelWalking).toBeNull();
    expect(result.preferredWalkingVariant).toBe('outdoor');
  });

  it('defaults to outdoor when both walking routes are unavailable', async () => {
    const planner = new RoutePlanner([
      new FakeStrategy('driving', makeRoute(900, 'Drive route')),
      new FakeStrategy('outdoorWalking', null),
      new FakeStrategy('tunnelWalking', null),
    ]);

    const result = await planner.plan(baseContext);

    expect(result.outdoorWalking).toBeNull();
    expect(result.tunnelWalking).toBeNull();
    expect(result.preferredWalkingVariant).toBe('outdoor');
  });

  it('throws when duplicate strategy keys are registered', () => {
    expect(
      () =>
        new RoutePlanner([
          new FakeStrategy('driving', makeRoute(900, 'Drive route A')),
          new FakeStrategy('driving', makeRoute(800, 'Drive route B')),
        ]),
    ).toThrow('Duplicate route strategy key: driving');
  });

  it('keeps planning when one strategy throws', async () => {
    const planner = new RoutePlanner([
      new FakeStrategy('driving', makeRoute(900, 'Drive route')),
      new ThrowingStrategy('outdoorWalking'),
      new FakeStrategy('tunnelWalking', makeRoute(600, 'Tunnel walk')),
    ]);

    const result = await planner.plan(baseContext);

    expect(result.driving?.viaText).toBe('Drive route');
    expect(result.outdoorWalking).toBeNull();
    expect(result.tunnelWalking?.viaText).toBe('Tunnel walk');
    expect(result.preferredWalkingVariant).toBe('tunnel');
  });

  it('returns partial results when driving strategy fails', async () => {
    const planner = new RoutePlanner([
      new ThrowingStrategy('driving'),
      new FakeStrategy('outdoorWalking', makeRoute(540, 'Outdoor walk')),
      new FakeStrategy('tunnelWalking', makeRoute(600, 'Tunnel walk')),
    ]);

    const result = await planner.plan(baseContext);

    expect(result.driving).toBeNull();
    expect(result.outdoorWalking?.viaText).toBe('Outdoor walk');
    expect(result.tunnelWalking?.viaText).toBe('Tunnel walk');
    expect(result.preferredWalkingVariant).toBe('outdoor');
  });
});
