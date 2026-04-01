import { DrivingRouteStrategy } from '../services/navigation/strategies/DrivingRouteStrategy';
import { OutdoorWalkingRouteStrategy } from '../services/navigation/strategies/OutdoorWalkingRouteStrategy';

const ENCODED_POLYLINE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

describe('GoogleDirections strategies', () => {
  it('DrivingRouteStrategy prefers duration_in_traffic and strips HTML instructions', async () => {
    const strategy = new DrivingRouteStrategy();
    const fetchImpl = jest.fn().mockResolvedValue({
      json: async () => ({
        status: 'OK',
        routes: [
          {
            summary: 'A-720 W',
            overview_polyline: { points: ENCODED_POLYLINE },
            legs: [
              {
                distance: { text: '10 km' },
                duration: { text: '15 mins', value: 900 },
                duration_in_traffic: { text: '20 mins', value: 1200 },
                steps: [
                  {
                    html_instructions: 'Turn <b>left</b>',
                    distance: { text: '100 m' },
                    duration: { text: '1 min' },
                    end_location: { lat: 45.5, lng: -73.57 },
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    const route = await strategy.execute({
      origin: { latitude: 45.501, longitude: -73.57 },
      destination: { latitude: 45.49, longitude: -73.58 },
      currentTime: new Date('2026-03-29T10:00:00.000Z'),
      buildings: [],
      googleMapsApiKey: 'test-key',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('mode=driving'));
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('departure_time='));
    expect(route).not.toBeNull();
    expect(route?.durationText).toBe('20 mins');
    expect(route?.durationSec).toBe(1200);
    expect(route?.steps[0].instruction).toBe('Turn left');
    expect(route?.polyline.length).toBeGreaterThan(1);
  });

  it('OutdoorWalkingRouteStrategy builds walking route with decoded polyline', async () => {
    const strategy = new OutdoorWalkingRouteStrategy();
    const fetchImpl = jest.fn().mockResolvedValue({
      json: async () => ({
        status: 'OK',
        routes: [
          {
            summary: 'Rue Sainte-Catherine',
            overview_polyline: { points: ENCODED_POLYLINE },
            legs: [
              {
                distance: { text: '2 km' },
                duration: { text: '25 mins', value: 1500 },
                steps: [
                  {
                    html_instructions: 'Head <b>east</b>',
                    distance: { text: '300 m' },
                    duration: { text: '4 mins' },
                    end_location: { lat: 45.49, lng: -73.58 },
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    const route = await strategy.execute({
      origin: { latitude: 45.501, longitude: -73.57 },
      destination: { latitude: 45.49, longitude: -73.58 },
      currentTime: null,
      buildings: [],
      googleMapsApiKey: 'test-key',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('mode=walking'));
    expect(route?.durationText).toBe('25 mins');
    expect(route?.durationSec).toBe(1500);
    expect(route?.steps[0].instruction).toBe('Head east');
    expect(route?.polyline.length).toBeGreaterThan(1);
  });
});
