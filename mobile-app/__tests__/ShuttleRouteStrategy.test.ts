import { DefaultShuttleRouteStrategy } from '../services/navigation/strategies/ShuttleRouteStrategy';
import { getNextShuttles } from '../services/api';

jest.mock('../services/api', () => ({
  getNextShuttles: jest.fn(),
}));

const ENCODED_POLYLINE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

function makeDirectionsResponse(durationSec: number) {
  return {
    status: 'OK',
    routes: [
      {
        overview_polyline: { points: ENCODED_POLYLINE },
        legs: [{ duration: { value: durationSec } }],
      },
    ],
  };
}

describe('DefaultShuttleRouteStrategy', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('keeps only the first catchable departure and computes wait window', async () => {
    (getNextShuttles as jest.MockedFunction<typeof getNextShuttles>).mockResolvedValue({
      threeNextShuttles: ['2026-03-29T10:05:00.000Z', '2026-03-29T10:30:00.000Z', null],
      tripDuration: 30,
    });

    const fetchImpl = jest.fn().mockResolvedValue({
      json: async () => makeDirectionsResponse(10 * 60),
    });

    const strategy = new DefaultShuttleRouteStrategy();
    const result = await strategy.execute({
      origin: { latitude: 45.4972, longitude: -73.5789 },
      destination: { latitude: 45.4584, longitude: -73.6387 },
      currentTime: new Date('2026-03-29T10:00:00.000Z'),
      googleMapsApiKey: 'test-key',
      fetchImpl,
    });

    expect(result).not.toBeNull();
    expect(result?.departureTimes).toEqual(['2026-03-29T10:30:00.000Z']);
    expect(result?.hasDirections).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('suppresses directions when wait is greater than two hours', async () => {
    (getNextShuttles as jest.MockedFunction<typeof getNextShuttles>).mockResolvedValue({
      threeNextShuttles: ['2026-03-29T13:00:00.000Z', null, null],
      tripDuration: 30,
    });

    const fetchImpl = jest.fn().mockResolvedValue({
      json: async () => makeDirectionsResponse(10 * 60),
    });

    const strategy = new DefaultShuttleRouteStrategy();
    const result = await strategy.execute({
      origin: { latitude: 45.4972, longitude: -73.5789 },
      destination: { latitude: 45.4584, longitude: -73.6387 },
      currentTime: new Date('2026-03-29T10:00:00.000Z'),
      googleMapsApiKey: 'test-key',
      fetchImpl,
    });

    expect(result).not.toBeNull();
    expect(result?.hasDirections).toBe(false);
  });
});
