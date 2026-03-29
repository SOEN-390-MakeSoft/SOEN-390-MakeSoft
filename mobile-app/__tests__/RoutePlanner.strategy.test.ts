import { RoutePlanner } from '../services/navigation/RoutePlanner';
import type { ModeRouteStrategy } from '../services/navigation/strategies/ModeRouteStrategy';
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
    public readonly key: 'driving' | 'outdoorWalking' | 'tunnelWalking',
    private readonly route: ModeRoute | null,
  ) {}

  async execute(): Promise<ModeRoute | null> {
    return this.route;
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
});
