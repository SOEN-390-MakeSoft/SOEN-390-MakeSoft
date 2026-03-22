import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useNavigationBetweenBuildings } from '../hooks/useNavigationBetweenBuildings';
import { Platform } from 'react-native';
import { getNextShuttles } from '../services/api';
import * as Location from 'expo-location';
import { BUILDING_POLYGONS } from '../data/buildingPolygons';

jest.mock('expo-location');

jest.mock('../services/api', () => ({
  getNextShuttles: jest.fn().mockResolvedValue({
    threeNextShuttles: ['2026-02-21T10:00:00', '2026-02-21T10:30:00', null],
    tripDuration: 30,
  }),
}));

type LatLng = { latitude: number; longitude: number };
type Building = {
  id: string;
  name: string;
  code: string | null;
  polygon: readonly LatLng[];
};

const rectangleFromAnchor = (anchor: LatLng, height: number, width: number): readonly LatLng[] => {
  const north = anchor.latitude;
  const west = anchor.longitude;
  const south = north - height;
  const east = west + width;

  return [
    { latitude: north, longitude: west },
    { latitude: north, longitude: east },
    { latitude: south, longitude: east },
    { latitude: south, longitude: west },
  ];
};

const createTestBuilding = (id: string, name: string, anchor: LatLng): Building => ({
  id,
  name,
  code: id,
  polygon: rectangleFromAnchor(anchor, 0.001, 0.002),
});

const NORTH_BUILDING = createTestBuilding('A1', 'Alpha Hall', {
  latitude: 45.502,
  longitude: -73.568,
});

const SOUTH_BUILDING = createTestBuilding('B2', 'Beta Hall', {
  latitude: 45.497,
  longitude: -73.579,
});

const mockBuildings: Building[] = [NORTH_BUILDING, SOUTH_BUILDING];

function getCampusBuildingByPrefix(codePrefix: string): Building {
  const entry = Object.entries(BUILDING_POLYGONS).find(([, record]) =>
    record.name.startsWith(`${codePrefix} - `),
  );
  if (!entry) {
    throw new Error(`Missing campus building polygon for ${codePrefix}`);
  }

  const [id, record] = entry;
  return {
    id,
    name: record.name,
    code: codePrefix,
    polygon: record.polygon,
  };
}

const HALL_BUILDING = getCampusBuildingByPrefix('H');
const EV_BUILDING = getCampusBuildingByPrefix('EV');
type HookArgs = {
  buildings: Building[];
  onSelectBuilding: (id: string) => void;
  onBuildingNotFound?: () => void;
};

const setup = (overrides?: Partial<HookArgs>) => {
  const args: HookArgs = {
    buildings: mockBuildings,
    onSelectBuilding: jest.fn(),
    ...overrides,
  };

  const hook = renderHook(() => useNavigationBetweenBuildings(args));
  return { ...hook, args };
};

const MOCK_POLYLINE = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';

function setupDirectionsMocks() {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID = 'test-api-key';
  (Platform as any).OS = 'android';
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
    status: 'granted',
  });
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
    coords: { latitude: 45.505, longitude: -73.572 },
  });
}

function teardownDirectionsMocks() {
  delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;
  jest.restoreAllMocks();
}

function createDrivingWalkingFetch(drivingResponse: object, walkingResponse: object) {
  let callCount = 0;
  const mockFetch = jest.fn().mockImplementation((url: string) => {
    callCount++;
    const response = url.includes('mode=driving') ? drivingResponse : walkingResponse;
    return Promise.resolve({ json: () => Promise.resolve(response) });
  });
  globalThis.fetch = mockFetch;
  return { mockFetch, getCallCount: () => callCount };
}

function renderNavHook(overrides: Record<string, any> = {}) {
  return renderHook(() =>
    useNavigationBetweenBuildings({
      buildings: mockBuildings,
      onSelectBuilding: jest.fn(),
      ...overrides,
    }),
  );
}

function openNavAndSetStart(result: { current: any }, startBuildingId: string) {
  act(() => {
    result.current.openNavigationForBuilding(mockBuildings[0], null);
  });
  act(() => {
    result.current.setNavigationActiveField('start');
  });
  act(() => {
    result.current.handleMapBuildingPress(startBuildingId);
  });
}

function openNavAndSetCurrentLocation(result: { current: any }) {
  act(() => {
    result.current.openNavigationForBuilding(mockBuildings[0], null);
  });
  act(() => {
    result.current.setStartToCurrentLocation({ latitude: 45.505, longitude: -73.572 });
  });
}

describe('useNavigationBetweenBuildings', () => {
  describe('handleMapCoordinatePress', () => {
    it('should call onSelectBuilding and set tap marker when coordinate is inside a building (happy path)', () => {
      const onSelectBuilding = jest.fn();
      const { result } = renderNavHook({ onSelectBuilding });

      // Act: tap inside TB polygon
      act(() => {
        result.current.handleMapCoordinatePress({
          latitude: 45.5015,
          longitude: -73.567,
        });
      });

      expect(onSelectBuilding).toHaveBeenCalledWith('A1');
      expect(result.current.tapMarkerCoordinate).not.toBeNull();
      expect(result.current.tapMarkerCoordinate?.latitude).toBeCloseTo(45.5015);
      expect(result.current.tapMarkerCoordinate?.longitude).toBeCloseTo(-73.567);
    });

    it('should call onBuildingNotFound when coordinate is far from any building (failure case)', () => {
      const onBuildingNotFound = jest.fn();
      const { result } = renderNavHook({ onBuildingNotFound });

      // Act: tap far from campus
      act(() => {
        result.current.handleMapCoordinatePress({
          latitude: 45.6,
          longitude: -73.4,
        });
      });

      expect(onBuildingNotFound).toHaveBeenCalled();
      expect(result.current.tapMarkerCoordinate).toBeNull();
    });

    it('should not call onBuildingNotFound when callback is not provided (edge case)', () => {
      // Arrange
      const { result } = renderNavHook();

      // Act
      act(() => {
        result.current.handleMapCoordinatePress({
          latitude: 45.6,
          longitude: -73.4,
        });
      });

      expect(result.current.tapMarkerCoordinate).toBeNull();
    });
  });

  describe('tapMarkerCoordinate and closeNavigation', () => {
    it('should clear tap marker when closeNavigation is called', () => {
      // Arrange
      const { result } = renderNavHook();
      act(() => {
        result.current.handleMapCoordinatePress({
          latitude: 45.5015,
          longitude: -73.567,
        });
      });
      expect(result.current.tapMarkerCoordinate).not.toBeNull();

      act(() => {
        result.current.closeNavigation();
      });

      expect(result.current.tapMarkerCoordinate).toBeNull();
    });
  });

  describe('handleMapBuildingPress', () => {
    it('should set tap marker when pressing a building by id', () => {
      const onSelectBuilding = jest.fn();
      const { result } = renderNavHook({ onSelectBuilding });

      // Act
      act(() => {
        result.current.handleMapBuildingPress('A1');
      });

      expect(onSelectBuilding).toHaveBeenCalledWith('A1');
      expect(result.current.tapMarkerCoordinate).not.toBeNull();
    });
  });

  describe('validation and error handling', () => {
    it('should have Get Directions disabled when fields are empty (initial state)', () => {
      // Arrange
      const { result } = renderNavHook();

      // Assert: no origin, no destination label
      expect(result.current.isGetDirectionsDisabled).toBe(true);
    });

    it('should have Get Directions disabled when destination has name but no coords', () => {
      // Arrange: open with remote building only (no selected building) -> label set, coord null
      const { result } = renderNavHook();
      act(() => {
        result.current.closeNavigation();
      });
      act(() => {
        result.current.openNavigationForBuilding(null, {
          name: 'Destination',
          code: null,
        });
      });

      expect(result.current.isGetDirectionsDisabled).toBe(true);
    });

    it('should set directionsError to same_origin_destination when origin equals destination', () => {
      // Arrange
      const { result } = renderNavHook();
      openNavAndSetStart(result, 'A1');

      expect(result.current.directionsError).toBe('same_origin_destination');
      expect(result.current.isGetDirectionsDisabled).toBe(true);
    });

    it('should set directionsError to missing_coordinates when destination has name but no coords', () => {
      // Arrange: open navigation with remote building only (no selected building -> no coords)
      const { result } = renderNavHook();
      act(() => {
        result.current.openNavigationForBuilding(null, {
          name: 'Remote Building',
          code: 'RB',
        });
      });

      expect(result.current.directionsError).toBe('missing_coordinates');
      expect(result.current.isGetDirectionsDisabled).toBe(true);
    });

    it('should have no directionsError when origin and destination are valid and different', () => {
      // Arrange: set origin (e.g. "Your location" requires async location; use a building for start)
      const { result } = renderNavHook();
      openNavAndSetStart(result, 'B2');

      // Assert: start = Hall (H), destination = Test Building (TB), different coords
      expect(result.current.directionsError).toBeNull();
      expect(result.current.isGetDirectionsDisabled).toBe(false);
    });
  });

  describe('route polyline and transport mode', () => {
    it("should default selectedTransportMode to 'driving'", () => {
      const { result } = renderNavHook();
      expect(result.current.selectedTransportMode).toBe('driving');
    });

    it('should allow switching transport mode via setSelectedTransportMode', () => {
      const { result } = renderNavHook();
      act(() => {
        result.current.setSelectedTransportMode('walking');
      });
      expect(result.current.selectedTransportMode).toBe('walking');

      act(() => {
        result.current.setSelectedTransportMode('driving');
      });
      expect(result.current.selectedTransportMode).toBe('driving');
    });

    it('should initialize routePolyline as empty array', () => {
      const { result } = renderNavHook();
      expect(result.current.routePolyline).toEqual([]);
    });

    it('should initialize routeRegion as null', () => {
      const { result } = renderNavHook();
      expect(result.current.routeRegion).toBeNull();
    });

    it('should clear route polyline and region when navigation is closed', () => {
      const { result } = renderNavHook();
      // Open navigation
      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });
      expect(result.current.isNavigationOpen).toBe(true);

      // Close navigation
      act(() => {
        result.current.closeNavigation();
      });
      expect(result.current.routePolyline).toEqual([]);
      expect(result.current.routeRegion).toBeNull();
    });

    it('should expose modeDurations with driving and walking keys', () => {
      const { result } = renderNavHook();
      // Initially empty
      expect(result.current.modeDurations).toEqual({});
    });

    it('should initialize navigationSteps as empty array', () => {
      const { result } = renderNavHook();
      expect(result.current.navigationSteps).toEqual([]);
    });

    it('should clear navigationSteps when navigation is closed', () => {
      const { result } = renderNavHook();

      openNavAndSetCurrentLocation(result);

      act(() => {
        result.current.closeNavigation();
      });

      expect(result.current.navigationSteps).toEqual([]);
    });
  });

  describe('directions fetch effect', () => {
    const MOCK_STEPS = [
      {
        html_instructions: 'Head <b>north</b> on Rue Guy',
        distance: { text: '0.3 km', value: 300 },
        duration: { text: '1 min', value: 60 },
        maneuver: 'straight',
      },
      {
        html_instructions: 'Turn <b>left</b> onto Blvd de Maisonneuve',
        distance: { text: '0.5 km', value: 500 },
        duration: { text: '2 mins', value: 120 },
        maneuver: 'turn-left',
      },
    ];
    const makeMockDirectionsResponse = (summary = 'Route 1') => ({
      status: 'OK',
      routes: [
        {
          summary,
          overview_polyline: { points: MOCK_POLYLINE },
          legs: [
            {
              duration: { text: '10 mins', value: 600 },
              distance: { text: '5 km', value: 5000 },
              steps: MOCK_STEPS,
            },
          ],
        },
      ],
    });

    beforeEach(setupDirectionsMocks);
    afterEach(teardownDirectionsMocks);

    it('should fetch driving and walking directions and set route data', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(makeMockDirectionsResponse()),
      });
      globalThis.fetch = mockFetch;

      const { result } = renderNavHook();
      openNavAndSetCurrentLocation(result);

      // Wait for fetch to be called (driving + walking = 2 calls)
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // Verify both driving and walking URLs were fetched
      const fetchUrls = mockFetch.mock.calls.map((c: any[]) => c[0]);
      expect(fetchUrls.some((u: string) => u.includes('mode=driving'))).toBe(true);
      expect(fetchUrls.some((u: string) => u.includes('mode=walking'))).toBe(true);

      // Verify route state is populated
      await waitFor(() => {
        expect(result.current.routeSummary).not.toBeNull();
      });
      expect(result.current.modeDurations.driving).toBe('10 mins');
      expect(result.current.modeDurations.walking).toBe('10 mins');
      expect(result.current.routePolyline.length).toBeGreaterThan(0);
      expect(result.current.routeRegion).not.toBeNull();
      expect(result.current.isRouteLoading).toBe(false);

      // Verify navigation steps are extracted
      expect(result.current.navigationSteps.length).toBe(2);
      expect(result.current.navigationSteps[0].instruction).toBe('Head north on Rue Guy');
      expect(result.current.navigationSteps[0].distanceText).toBe('0.3 km');
      expect(result.current.navigationSteps[0].durationText).toBe('1 min');
      expect(result.current.navigationSteps[0].maneuver).toBe('straight');
      expect(result.current.navigationSteps[1].instruction).toBe(
        'Turn left onto Blvd de Maisonneuve',
      );
      expect(result.current.navigationSteps[1].maneuver).toBe('turn-left');
    });

    it('should compare outdoor and tunnel walking routes for Hall to EV and default to the faster tunnel route', async () => {
      const { mockFetch } = createDrivingWalkingFetch(makeMockDirectionsResponse('Driving route'), {
        status: 'OK',
        routes: [
          {
            summary: 'Outdoor walking route',
            overview_polyline: { points: MOCK_POLYLINE },
            legs: [
              {
                duration: { text: '6 mins', value: 360 },
                distance: { text: '650 m', value: 650 },
                steps: MOCK_STEPS,
              },
            ],
          },
        ],
      });

      const { result } = renderHook(() =>
        useNavigationBetweenBuildings({
          buildings: [HALL_BUILDING, EV_BUILDING],
          onSelectBuilding: jest.fn(),
        }),
      );

      act(() => {
        result.current.openNavigationForBuilding(EV_BUILDING, null);
      });
      act(() => {
        result.current.setNavigationActiveField('start');
      });
      act(() => {
        result.current.handleMapBuildingPress(HALL_BUILDING.id);
      });

      await waitFor(() => {
        expect(result.current.selectedTransportMode).toBe('walking');
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls.some((call: any[]) => call[0].includes('mode=driving'))).toBe(
        true,
      );
      expect(mockFetch.mock.calls.some((call: any[]) => call[0].includes('mode=walking'))).toBe(
        true,
      );
      expect(result.current.routeSummary?.viaText).toBe('Underground tunnel network');
      expect(result.current.routePolyline.length).toBeGreaterThan(0);
      expect(result.current.walkingRouteComparison).toMatchObject({
        activeVariant: 'tunnel',
        fastestVariant: 'tunnel',
        outdoor: {
          durationText: '6 mins',
          distanceText: '650 m',
        },
      });
      expect(
        result.current.navigationSteps.some((step: { instruction: string }) =>
          step.instruction.includes('Take the tunnel'),
        ),
      ).toBe(true);
      expect(
        result.current.navigationSteps.some((step: { instruction: string }) =>
          step.instruction.includes('Enter the tunnel'),
        ),
      ).toBe(true);

      act(() => {
        result.current.setSelectedWalkingRouteVariant('outdoor');
      });

      await waitFor(() => {
        expect(result.current.routeSummary?.viaText).toBe('Outdoor walking route');
      });
      expect(result.current.walkingRouteComparison?.activeVariant).toBe('outdoor');
      expect(result.current.navigationSteps[0].instruction).toBe('Head north on Rue Guy');
    });

    it('should handle API returning non-OK status', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve({ status: 'ZERO_RESULTS', routes: [] }),
      });

      const { result } = renderNavHook();
      openNavAndSetCurrentLocation(result);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.isRouteLoading).toBe(false);
      });
      expect(result.current.routeSummary).toBeNull();
      expect(result.current.routePolyline).toEqual([]);
      expect(result.current.navigationSteps).toEqual([]);
    });

    it('should handle API response with no legs', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            status: 'OK',
            routes: [{ summary: 'Route', overview_polyline: {}, legs: [] }],
          }),
      });

      const { result } = renderNavHook();
      openNavAndSetCurrentLocation(result);

      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(result.current.isRouteLoading).toBe(false);
      });
    });

    it('should use iOS API key on iOS platform', async () => {
      (Platform as any).OS = 'ios';
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS = 'ios-test-key';
      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(makeMockDirectionsResponse()),
      });
      globalThis.fetch = mockFetch;

      const { result } = renderNavHook();
      openNavAndSetCurrentLocation(result);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const fetchUrl = mockFetch.mock.calls[0][0];
      expect(fetchUrl).toContain('key=ios-test-key');

      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS;
      (Platform as any).OS = 'android';
    });

    it('should not fetch directions when API key is missing', async () => {
      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;
      const mockFetch = jest.fn();
      globalThis.fetch = mockFetch;

      const { result } = renderNavHook();
      openNavAndSetCurrentLocation(result);

      // Give it a tick â€” fetch should NOT have been called
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should use simulated currentTime for driving departure_time and ETA', async () => {
      const simulatedNow = new Date('2026-03-09T07:00:00.000Z');
      const expectedDepartureEpoch = Math.floor(simulatedNow.getTime() / 1000);
      const expectedArrivalText = new Date(simulatedNow.getTime() + 600 * 1000).toLocaleTimeString(
        [],
        {
          hour: 'numeric',
          minute: '2-digit',
        },
      );

      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(makeMockDirectionsResponse()),
      });
      globalThis.fetch = mockFetch;

      const { result } = renderNavHook({ currentTime: simulatedNow });
      openNavAndSetCurrentLocation(result);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      const drivingUrl = mockFetch.mock.calls
        .map((c: any[]) => c[0] as string)
        .find((u: string) => u.includes('mode=driving'));
      expect(drivingUrl).toContain(`departure_time=${expectedDepartureEpoch}`);
      expect(drivingUrl).not.toContain('departure_time=now');

      await waitFor(() => {
        expect(result.current.routeSummary).not.toBeNull();
      });
      expect(result.current.routeSummary!.arrivalText).toBe(expectedArrivalText);
    });

    it('should flag driving and walking as late when arriveBy is earlier than projected arrival', async () => {
      const simulatedNow = new Date('2026-03-09T07:00:00.000Z');
      const arriveBy = new Date(simulatedNow.getTime() + 5 * 60 * 1000); // 5 minutes deadline

      const mockFetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(makeMockDirectionsResponse()),
      });
      globalThis.fetch = mockFetch;

      const { result } = renderNavHook({ currentTime: simulatedNow, arriveBy });
      openNavAndSetCurrentLocation(result);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
      await waitFor(() => {
        expect(result.current.routeSummary).not.toBeNull();
      });

      expect(result.current.lateTransportModes).toEqual(
        expect.arrayContaining(['driving', 'walking']),
      );
    });

    it('should use start_location as fallback focusCoordinate when end_location is absent', async () => {
      /**
       * Lines 349-354 of the hook are the `else if (s.start_location?.lat != null)`
       * branch.  The existing MOCK_STEPS have no end_location or start_location,
       * so neither branch fires. Here we provide a step with only start_location
       * to exercise the else-if body and improve branch coverage.
       */
      const stepWithStartOnly = {
        html_instructions: 'Walk <b>north</b> on Rue Guy',
        distance: { text: '0.2 km', value: 200 },
        duration: { text: '3 mins', value: 180 },
        maneuver: 'straight',
        start_location: { lat: 45.4965, lng: -73.578 },
        // deliberately no end_location
      };

      const mockResponse = {
        status: 'OK',
        routes: [
          {
            summary: 'Start-only route',
            overview_polyline: { points: MOCK_POLYLINE },
            legs: [
              {
                duration: { text: '3 mins', value: 180 },
                distance: { text: '0.2 km', value: 200 },
                steps: [stepWithStartOnly],
              },
            ],
          },
        ],
      };

      globalThis.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });
      act(() => {
        result.current.setStartToCurrentLocation({ latitude: 45.505, longitude: -73.572 });
      });

      await waitFor(() => {
        expect(result.current.navigationSteps.length).toBeGreaterThan(0);
      });

      // focusCoordinate should come from start_location, not end_location
      const step = result.current.navigationSteps[0];
      expect(step.focusCoordinate?.latitude).toBeCloseTo(45.4965);
      expect(step.focusCoordinate?.longitude).toBeCloseTo(-73.578);
    });

    it('should use start_location as fallback focusCoordinate when end_location is absent', async () => {
      /**
       * Lines 349-354 of the hook are the `else if (s.start_location?.lat != null)`
       * branch.  The existing MOCK_STEPS have no end_location or start_location,
       * so neither branch fires. Here we provide a step with only start_location
       * to exercise the else-if body and improve branch coverage.
       */
      const stepWithStartOnly = {
        html_instructions: 'Walk <b>north</b> on Rue Guy',
        distance: { text: '0.2 km', value: 200 },
        duration: { text: '3 mins', value: 180 },
        maneuver: 'straight',
        start_location: { lat: 45.4965, lng: -73.578 },
        // deliberately no end_location
      };

      const mockResponse = {
        status: 'OK',
        routes: [
          {
            summary: 'Start-only route',
            overview_polyline: { points: MOCK_POLYLINE },
            legs: [
              {
                duration: { text: '3 mins', value: 180 },
                distance: { text: '0.2 km', value: 200 },
                steps: [stepWithStartOnly],
              },
            ],
          },
        ],
      };

      globalThis.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });

      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });
      act(() => {
        result.current.setStartToCurrentLocation({ latitude: 45.505, longitude: -73.572 });
      });

      await waitFor(() => {
        expect(result.current.navigationSteps.length).toBeGreaterThan(0);
      });

      // focusCoordinate should come from start_location, not end_location
      const step = result.current.navigationSteps[0];
      expect(step.focusCoordinate?.latitude).toBeCloseTo(45.4965);
      expect(step.focusCoordinate?.longitude).toBeCloseTo(-73.578);
    });
  });

  describe('mode-switch effect with routes loaded', () => {
    const MOCK_DRIVING_STEPS = [
      {
        html_instructions: 'Take the <b>highway</b>',
        distance: { text: '3 km', value: 3000 },
        duration: { text: '5 mins', value: 300 },
        maneuver: 'merge',
      },
    ];
    const MOCK_WALKING_STEPS = [
      {
        html_instructions: 'Walk along <b>Rue Sherbrooke</b>',
        distance: { text: '0.8 km', value: 800 },
        duration: { text: '10 mins', value: 600 },
      },
      {
        html_instructions: 'Turn <b>right</b> onto Rue Guy',
        distance: { text: '0.2 km', value: 200 },
        duration: { text: '3 mins', value: 180 },
        maneuver: 'turn-right',
      },
    ];
    const makeMockResponse = (
      durationText: string,
      durationValue: number,
      steps: unknown[] = [],
    ) => ({
      status: 'OK',
      routes: [
        {
          summary: 'Test Route',
          overview_polyline: { points: MOCK_POLYLINE },
          legs: [
            {
              duration: { text: durationText, value: durationValue },
              distance: { text: '5 km', value: 5000 },
              steps,
            },
          ],
        },
      ],
    });

    beforeEach(setupDirectionsMocks);
    afterEach(teardownDirectionsMocks);

    it('should update polyline and summary when switching from driving to walking', async () => {
      const { getCallCount } = createDrivingWalkingFetch(
        makeMockResponse('15 mins', 900, MOCK_DRIVING_STEPS),
        makeMockResponse('45 mins', 2700, MOCK_WALKING_STEPS),
      );

      const { result } = renderNavHook();

      openNavAndSetCurrentLocation(result);

      await waitFor(() => {
        expect(getCallCount()).toBe(2);
      });

      await waitFor(() => {
        expect(result.current.routePolyline.length).toBeGreaterThan(0);
      });

      // Now switch to walking
      act(() => {
        result.current.setSelectedTransportMode('walking');
      });

      await waitFor(() => {
        expect(result.current.selectedTransportMode).toBe('walking');
      });

      // Polyline should still be populated (walking route)
      expect(result.current.routePolyline.length).toBeGreaterThan(0);
      expect(result.current.routeRegion).not.toBeNull();

      // Steps should update to walking steps
      expect(result.current.navigationSteps.length).toBe(2);
      expect(result.current.navigationSteps[0].instruction).toBe('Walk along Rue Sherbrooke');
      expect(result.current.navigationSteps[1].maneuver).toBe('turn-right');
    });

    it('should update steps back to driving when switching mode', async () => {
      const { getCallCount } = createDrivingWalkingFetch(
        makeMockResponse('15 mins', 900, MOCK_DRIVING_STEPS),
        makeMockResponse('45 mins', 2700, MOCK_WALKING_STEPS),
      );

      const { result } = renderNavHook();

      openNavAndSetCurrentLocation(result);

      await waitFor(() => {
        expect(getCallCount()).toBe(2);
      });

      await waitFor(() => {
        expect(result.current.navigationSteps.length).toBeGreaterThan(0);
      });

      // Initially driving â€” steps should be driving steps
      expect(result.current.navigationSteps.length).toBe(1);
      expect(result.current.navigationSteps[0].instruction).toBe('Take the highway');

      // Switch to walking
      act(() => {
        result.current.setSelectedTransportMode('walking');
      });
      await waitFor(() => {
        expect(result.current.navigationSteps.length).toBe(2);
      });

      // Switch back to driving
      act(() => {
        result.current.setSelectedTransportMode('driving');
      });
      await waitFor(() => {
        expect(result.current.navigationSteps.length).toBe(1);
      });
      expect(result.current.navigationSteps[0].instruction).toBe('Take the highway');
      expect(result.current.navigationSteps[0].maneuver).toBe('merge');
    });

    it('should clear route when switching to a mode with no cached data (L594-596)', async () => {
      /**
       * After driving loads OK but walking returns ZERO_RESULTS, switching from
       * 'driving' to 'walking' triggers the else-if at lines 594-596 of the hook:
       * allModeRoutes.walking is null, route?.polyline is falsy,
       * but allModeRoutes.driving exists → clear path fires.
       */
      const okResponse = {
        status: 'OK',
        routes: [
          {
            summary: 'Driving Route',
            overview_polyline: { points: MOCK_POLYLINE },
            legs: [
              {
                duration: { text: '15 mins', value: 900 },
                distance: { text: '5 km', value: 5000 },
                steps: [],
              },
            ],
          },
        ],
      };
      const zeroResultsResponse = { status: 'ZERO_RESULTS', routes: [] };

      // driving → OK, walking → ZERO_RESULTS
      createDrivingWalkingFetch(okResponse, zeroResultsResponse);

      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });
      act(() => {
        result.current.setStartToCurrentLocation({ latitude: 45.505, longitude: -73.572 });
      });

      // Wait for the driving route to load and populate routePolyline
      await waitFor(() => {
        expect(result.current.routePolyline.length).toBeGreaterThan(0);
      });

      // Switch to walking — no cached walking route exists, but driving does
      act(() => {
        result.current.setSelectedTransportMode('walking');
      });

      // The else-if branch should clear the polyline and steps
      await waitFor(() => {
        expect(result.current.routePolyline).toEqual([]);
      });
      expect(result.current.navigationSteps).toEqual([]);
    });
  });

  describe('handleMapBuildingPress during navigation', () => {
    it('should set destination when navigation is open and destination field is active', () => {
      const { result } = renderNavHook();

      // Open navigation
      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      // Set active field to destination
      act(() => {
        result.current.setNavigationActiveField('destination');
      });

      // Press a different building
      act(() => {
        result.current.handleMapBuildingPress('B2');
      });

      // Destination should be updated to Beta Hall
      expect(result.current.navigationDestination).toBe('Beta Hall (B2)');
    });

    it('should set start when navigation is open and start field is active', () => {
      const { result } = renderNavHook();

      // Open navigation
      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      // Set active field to start
      act(() => {
        result.current.setNavigationActiveField('start');
      });

      // Press Hall building
      act(() => {
        result.current.handleMapBuildingPress('B2');
      });

      expect(result.current.navigationStart).toBe('Beta Hall (B2)');
    });

    it('should set start when nav is open, no active field, and destination already set', () => {
      const { result } = renderNavHook();

      // Open navigation (sets destination to TB)
      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      // Clear active field
      act(() => {
        result.current.setNavigationActiveField(null);
      });

      // Press Hall â€” since destination is already set, it should assign start
      act(() => {
        result.current.handleMapBuildingPress('B2');
      });

      expect(result.current.navigationStart).toBe('Beta Hall (B2)');
    });

    it('should set destination when nav is open, no active field, and no destination set', () => {
      const { result } = renderNavHook();

      // Open navigation with null building and null remote => destination label = "Destination"
      // Then manually close and re-open with empty destination
      act(() => {
        result.current.openNavigationForBuilding(null, null);
      });

      // Close to reset, then reopen â€” we need destination to be empty
      act(() => {
        result.current.closeNavigation();
      });

      // Manually open to simulate empty destination state
      act(() => {
        result.current.openNavigationForBuilding(null, { name: '', code: null });
      });

      // Clear active field
      act(() => {
        result.current.setNavigationActiveField(null);
      });

      // Press TB â€” since destination is empty string, it should assign destination
      act(() => {
        result.current.handleMapBuildingPress('B2');
      });

      // When destination is empty, the else branch sets destination
      expect(result.current.navigationDestination).toBe('Beta Hall (B2)');
    });

    it('should ignore building press for unknown building id', () => {
      const onSelectBuilding = jest.fn();
      const { result } = renderNavHook({ onSelectBuilding });

      act(() => {
        result.current.handleMapBuildingPress('UNKNOWN');
      });

      expect(onSelectBuilding).not.toHaveBeenCalled();
      expect(result.current.tapMarkerCoordinate).toBeNull();
    });
  });

  describe('openNavigationForBuilding', () => {
    it('should format label from remote building name and code', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(null, {
          name: 'Science Complex',
          code: 'SP',
        });
      });

      expect(result.current.navigationDestination).toBe('Science Complex (SP)');
      expect(result.current.isNavigationOpen).toBe(true);
    });

    it('should use building name without code when code is null', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(null, {
          name: 'Some Place',
          code: null,
        });
      });

      expect(result.current.navigationDestination).toBe('Some Place');
    });

    it('should not duplicate code if name already contains it', () => {
      const buildingWithCode: Building = {
        id: 'X',
        name: 'Xavier Hall (XH)',
        code: 'XH',
        polygon: mockBuildings[0].polygon,
      };

      const { result } = renderHook(() =>
        useNavigationBetweenBuildings({
          buildings: [buildingWithCode],
          onSelectBuilding: jest.fn(),
        }),
      );

      act(() => {
        result.current.openNavigationForBuilding(buildingWithCode, null);
      });

      expect(result.current.navigationDestination).toBe('Xavier Hall (XH)');
    });
    it("should default destination label to 'Destination' when no names provided", () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(null, null);
      });

      expect(result.current.navigationDestination).toBe('Destination');
    });
  });

  describe('openNavigationForResolvedDestination (3.4.1)', () => {
    it('should auto-fill destination and lock it', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForResolvedDestination(mockBuildings[0]);
      });

      expect(result.current.navigationStart).toBe('Your location');
      expect(result.current.navigationDestination).toBe('Alpha Hall (A1)');
      expect(result.current.isDestinationLocked).toBe(true);
      expect(result.current.isNavigationOpen).toBe(true);
    });

    it('should prevent overriding locked destination via search select', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForResolvedDestination(mockBuildings[0]);
      });
      const initialDestination = result.current.navigationDestination;

      act(() => {
        result.current.handleSearchSelect('destination', 'Beta Hall', 'B2');
      });

      expect(result.current.navigationDestination).toBe(initialDestination);
      expect(result.current.isDestinationLocked).toBe(true);
    });

    it('should ignore activating destination field while destination is locked', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForResolvedDestination(mockBuildings[0]);
      });

      // If destination were active, pressing a building would overwrite destination.
      // With lock enabled, active field change to destination is blocked, so this
      // building press falls back to updating start instead.
      act(() => {
        result.current.setNavigationActiveField('destination');
      });
      act(() => {
        result.current.handleMapBuildingPress('B2');
      });

      expect(result.current.navigationDestination).toBe('Alpha Hall (A1)');
      expect(result.current.navigationStart).toBe('Beta Hall (B2)');
      expect(result.current.isDestinationLocked).toBe(true);
    });
  });

  describe('shuttle feature', () => {
    it('should expose isShuttleRoute as false initially', () => {
      const { result } = renderNavHook();
      expect(result.current.isShuttleRoute).toBe(false);
    });

    it('should expose isShuttleLoading as false initially', () => {
      const { result } = renderNavHook();
      expect(result.current.isShuttleLoading).toBe(false);
    });

    it('should expose shuttleInfo as null initially', () => {
      const { result } = renderNavHook();
      expect(result.current.shuttleInfo).toBeNull();
    });

    it('should expose isWeekend as a boolean', () => {
      const { result } = renderNavHook();
      expect(typeof result.current.isWeekend).toBe('boolean');
    });

    it('should reset shuttle state on closeNavigation', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });
      act(() => {
        result.current.closeNavigation();
      });

      expect(result.current.isShuttleRoute).toBe(false);
      expect(result.current.isShuttleLoading).toBe(false);
      expect(result.current.shuttleInfo).toBeNull();
    });

    it("should allow switching to 'shuttle' transport mode", () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.setSelectedTransportMode('shuttle');
      });

      expect(result.current.selectedTransportMode).toBe('shuttle');
    });

    it('should pass simulated currentTime to shuttle API dateTime override', async () => {
      const simulatedNow = new Date(2026, 2, 9, 13, 0, 0, 0); // Monday 1:00 PM (local time)
      const loyBuilding: Building = createTestBuilding('L1', 'Loyola Hall', {
        latitude: 45.459,
        longitude: -73.64,
      });
      const mockedGetNextShuttles = getNextShuttles as jest.MockedFunction<typeof getNextShuttles>;
      mockedGetNextShuttles.mockClear();

      const { result } = renderHook(() =>
        useNavigationBetweenBuildings({
          buildings: [SOUTH_BUILDING, loyBuilding],
          onSelectBuilding: jest.fn(),
          currentTime: simulatedNow,
        }),
      );

      act(() => {
        result.current.openNavigationForBuilding(loyBuilding, null);
      });
      act(() => {
        result.current.setStartToCurrentLocation({ latitude: 45.4975, longitude: -73.579 });
      });

      await waitFor(() => {
        expect(mockedGetNextShuttles).toHaveBeenCalled();
      });

      expect(mockedGetNextShuttles).toHaveBeenCalledWith(
        'SGW',
        expect.any(Number),
        '2026-03-09T13:00:00',
      );
    });

    it('should keep only the first catchable shuttle after walk-to-hub arrival', async () => {
      setupDirectionsMocks();
      const simulatedNow = new Date(2026, 2, 9, 13, 0, 0, 0);
      const loyBuilding: Building = createTestBuilding('L1', 'Loyola Hall', {
        latitude: 45.459,
        longitude: -73.64,
      });
      const mockedGetNextShuttles = getNextShuttles as jest.MockedFunction<typeof getNextShuttles>;
      mockedGetNextShuttles.mockResolvedValueOnce({
        threeNextShuttles: ['2026-03-09T13:05:00', '2026-03-09T13:20:00', null],
        tripDuration: 30,
      });

      const mockDirections = {
        status: 'OK',
        routes: [
          {
            summary: 'Route',
            overview_polyline: { points: MOCK_POLYLINE },
            legs: [
              {
                duration: { text: '10 mins', value: 600 },
                distance: { text: '1 km', value: 1000 },
                steps: [],
              },
            ],
          },
        ],
      };
      globalThis.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(mockDirections),
      });

      const { result } = renderHook(() =>
        useNavigationBetweenBuildings({
          buildings: [SOUTH_BUILDING, loyBuilding],
          onSelectBuilding: jest.fn(),
          currentTime: simulatedNow,
        }),
      );

      act(() => {
        result.current.openNavigationForBuilding(loyBuilding, null);
      });
      act(() => {
        result.current.setStartToCurrentLocation({ latitude: 45.4975, longitude: -73.579 });
      });

      await waitFor(() => {
        expect(result.current.shuttleInfo).not.toBeNull();
      });

      expect(result.current.shuttleInfo!.departureTimes).toEqual(['2026-03-09T13:20:00']);
      teardownDirectionsMocks();
    });

    it('should suppress shuttle directions when required waiting time exceeds 2 hours', async () => {
      setupDirectionsMocks();
      const simulatedNow = new Date(2026, 2, 9, 13, 0, 0, 0);
      const loyBuilding: Building = createTestBuilding('L1', 'Loyola Hall', {
        latitude: 45.459,
        longitude: -73.64,
      });
      const mockedGetNextShuttles = getNextShuttles as jest.MockedFunction<typeof getNextShuttles>;
      mockedGetNextShuttles.mockResolvedValueOnce({
        threeNextShuttles: ['2026-03-09T15:20:00', null, null], // 2h10 after 13:10 walk arrival
        tripDuration: 30,
      });

      const mockDirections = {
        status: 'OK',
        routes: [
          {
            summary: 'Route',
            overview_polyline: { points: MOCK_POLYLINE },
            legs: [
              {
                duration: { text: '10 mins', value: 600 },
                distance: { text: '1 km', value: 1000 },
                steps: [],
              },
            ],
          },
        ],
      };
      globalThis.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(mockDirections),
      });

      const { result } = renderHook(() =>
        useNavigationBetweenBuildings({
          buildings: [SOUTH_BUILDING, loyBuilding],
          onSelectBuilding: jest.fn(),
          currentTime: simulatedNow,
        }),
      );

      act(() => {
        result.current.openNavigationForBuilding(loyBuilding, null);
      });
      act(() => {
        result.current.setStartToCurrentLocation({ latitude: 45.4975, longitude: -73.579 });
      });

      await waitFor(() => {
        expect(result.current.shuttleInfo).not.toBeNull();
      });

      expect(result.current.shuttleInfo!.hasDirections).toBe(false);
      expect(result.current.shuttleInfo!.departureTimes).toEqual(['2026-03-09T15:20:00']);

      act(() => {
        result.current.setSelectedTransportMode('shuttle');
      });

      await waitFor(() => {
        expect(result.current.navigationSteps).toEqual([]);
      });
      expect(result.current.routeSegments).toEqual([]);
      teardownDirectionsMocks();
    });

    it('should populate shuttle steps when shuttle mode is selected before shuttle info loads', async () => {
      setupDirectionsMocks();
      const simulatedNow = new Date(2026, 2, 9, 9, 15, 0, 0);
      const loyBuilding: Building = createTestBuilding('L1', 'Loyola Hall', {
        latitude: 45.459,
        longitude: -73.64,
      });
      const mockedGetNextShuttles = getNextShuttles as jest.MockedFunction<typeof getNextShuttles>;
      mockedGetNextShuttles.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  threeNextShuttles: ['2026-03-09T09:30:00', null, null],
                  tripDuration: 30,
                }),
              60,
            ),
          ),
      );

      const mockDirections = {
        status: 'OK',
        routes: [
          {
            summary: 'Route',
            overview_polyline: { points: MOCK_POLYLINE },
            legs: [
              {
                duration: { text: '7 mins', value: 420 },
                distance: { text: '0.8 km', value: 800 },
                steps: [],
              },
            ],
          },
        ],
      };
      globalThis.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(mockDirections),
      });

      const { result } = renderHook(() =>
        useNavigationBetweenBuildings({
          buildings: [SOUTH_BUILDING, loyBuilding],
          onSelectBuilding: jest.fn(),
          currentTime: simulatedNow,
        }),
      );

      act(() => {
        result.current.openNavigationForBuilding(loyBuilding, null);
      });
      act(() => {
        result.current.setStartToCurrentLocation({ latitude: 45.4975, longitude: -73.579 });
      });
      act(() => {
        result.current.setSelectedTransportMode('shuttle');
      });

      await waitFor(() => {
        expect(result.current.shuttleInfo).not.toBeNull();
      });
      await waitFor(() => {
        expect(result.current.navigationSteps.length).toBe(3);
      });
      teardownDirectionsMocks();
    });

    it('should compute shuttle step arrival times and focus coordinates for preview', async () => {
      setupDirectionsMocks();
      const simulatedNow = new Date(2026, 2, 9, 13, 0, 0, 0); // Monday 1:00 PM (local time)
      const loyBuilding: Building = createTestBuilding('L1', 'Loyola Hall', {
        latitude: 45.459,
        longitude: -73.64,
      });

      const mockedGetNextShuttles = getNextShuttles as jest.MockedFunction<typeof getNextShuttles>;
      mockedGetNextShuttles.mockResolvedValueOnce({
        threeNextShuttles: ['2026-03-09T13:20:00', null, null],
        tripDuration: 30,
      });

      const mockDirections = {
        status: 'OK',
        routes: [
          {
            summary: 'Route',
            overview_polyline: { points: MOCK_POLYLINE },
            legs: [
              {
                duration: { text: '10 mins', value: 600 },
                distance: { text: '1 km', value: 1000 },
                steps: [],
              },
            ],
          },
        ],
      };

      globalThis.fetch = jest.fn().mockResolvedValue({
        json: () => Promise.resolve(mockDirections),
      });

      const { result } = renderHook(() =>
        useNavigationBetweenBuildings({
          buildings: [SOUTH_BUILDING, loyBuilding],
          onSelectBuilding: jest.fn(),
          currentTime: simulatedNow,
        }),
      );

      act(() => {
        result.current.openNavigationForBuilding(loyBuilding, null);
      });
      act(() => {
        result.current.setStartToCurrentLocation({ latitude: 45.4975, longitude: -73.579 });
      });

      await waitFor(() => {
        expect(result.current.shuttleInfo).not.toBeNull();
      });

      act(() => {
        result.current.setSelectedTransportMode('shuttle');
      });

      await waitFor(() => {
        expect(result.current.navigationSteps.length).toBe(3);
      });

      const expectedWalkHubArrival = new Date(
        simulatedNow.getTime() + 10 * 60_000,
      ).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const expectedShuttleArrival = new Date(
        new Date('2026-03-09T13:20:00').getTime() + 30 * 60_000,
      ).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const expectedFinalArrival = new Date(
        new Date('2026-03-09T13:20:00').getTime() + 40 * 60_000,
      ).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

      const [walkToHub, shuttleRide, walkToDestination] = result.current.navigationSteps;
      expect(walkToHub.distanceText).toContain(expectedWalkHubArrival);
      expect(shuttleRide.distanceText).toContain(expectedShuttleArrival);
      expect(walkToDestination.distanceText).toContain(expectedFinalArrival);
      expect(walkToHub.durationText).toContain('~10 min walk');
      expect(walkToHub.durationText).toContain('wait 10 min');
      expect(shuttleRide.durationText).toBe('~30 min ride');
      expect(walkToHub.focusCoordinate).toBeTruthy();
      expect(shuttleRide.focusCoordinate).toBeTruthy();
      expect(shuttleRide.focusRegion).toBeTruthy();
      expect((shuttleRide.focusRegion?.latitudeDelta ?? 0) > 0.01).toBe(true);
      expect((shuttleRide.focusRegion?.longitudeDelta ?? 0) > 0.01).toBe(true);
      expect(walkToDestination.focusCoordinate).toBeTruthy();

      teardownDirectionsMocks();
    });
  });

  describe('rerouteFromLocation', () => {
    it('should be exposed by the hook (sanity check)', () => {
      const { result } = renderNavHook();
      expect(typeof result.current.rerouteFromLocation).toBe('function');
    });

    it('should update navigationOrigin to the supplied coordinate', async () => {
      // Provide an API key + a never-resolving fetch so we can inspect the request URL
      // before the loading state is cleared.
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID = 'test-key';
      (Platform as any).OS = 'android';
      const capturedUrls: string[] = [];
      globalThis.fetch = jest.fn().mockImplementation((url: string) => {
        capturedUrls.push(url);
        return new Promise(() => {}); // hang so isRouteLoading stays true
      });

      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      const newOrigin = { latitude: 45.496, longitude: -73.577 };
      act(() => {
        result.current.rerouteFromLocation(newOrigin);
      });

      // Wait for at least one fetch to be triggered with the new origin coords.
      await waitFor(() => expect(capturedUrls.length).toBeGreaterThan(0));
      expect(capturedUrls[0]).toContain('45.496');
      expect(capturedUrls[0]).toContain('-73.577');

      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;
    });

    it('should set isRouteLoading to true (resetRouteState is called)', async () => {
      // Provide an API key + a never-resolving fetch so the loading flag
      // fired by resetRouteState is still true when we assert.
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID = 'test-key';
      (Platform as any).OS = 'android';
      globalThis.fetch = jest.fn().mockReturnValue(new Promise(() => {}));

      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      act(() => {
        result.current.rerouteFromLocation({ latitude: 45.497, longitude: -73.579 });
      });

      await waitFor(() => expect(result.current.isRouteLoading).toBe(true));

      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;
    });

    it('should clear shuttleInfo when called', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      act(() => {
        result.current.rerouteFromLocation({ latitude: 45.497, longitude: -73.579 });
      });

      expect(result.current.shuttleInfo).toBeNull();
    });

    it('should clear routeSummary when called', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      act(() => {
        result.current.rerouteFromLocation({ latitude: 45.497, longitude: -73.579 });
      });

      expect(result.current.routeSummary).toBeNull();
    });

    it('should accept different coordinates on successive calls (idempotent)', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      // Both calls should clear route state without throwing.
      act(() => {
        result.current.rerouteFromLocation({ latitude: 45.49, longitude: -73.57 });
      });
      act(() => {
        result.current.rerouteFromLocation({ latitude: 45.495, longitude: -73.575 });
      });

      // Route summary is reset to null on each reroute call.
      expect(result.current.routeSummary).toBeNull();
    });
  });

  // ── handleSearchSelect ───────────────────────────────────────────────────

  describe('handleSearchSelect', () => {
    it('sets navigationStart label for the start field', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      act(() => {
        result.current.handleSearchSelect('start', 'Alpha Hall', 'A1');
      });

      expect(result.current.navigationStart).toBe('Alpha Hall (A1)');
    });

    it('sets navigationStart to "Your location" and clears origin when name is "Your location"', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      act(() => {
        result.current.handleSearchSelect('start', 'Your location', null);
      });

      expect(result.current.navigationStart).toBe('Your location');
    });

    it('sets navigationDestination label for the destination field (L713-736)', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(null, null);
      });

      act(() => {
        result.current.handleSearchSelect('destination', 'Alpha Hall', 'A1');
      });

      expect(result.current.navigationDestination).toBe('Alpha Hall (A1)');
    });

    it('sets tapMarkerCoordinate to building centroid when destination is a known building', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(null, null);
      });

      // Use a real building code from BUILDING_POLYGONS ('H' = Henry F. Hall Building)
      act(() => {
        result.current.handleSearchSelect('destination', 'Henry F. Hall Building', 'H');
      });

      // tapMarkerCoordinate should be set to the centroid of Hall Building (~SGW coords)
      expect(result.current.tapMarkerCoordinate).not.toBeNull();
      expect(result.current.tapMarkerCoordinate?.latitude).toBeGreaterThan(45.49);
      expect(result.current.tapMarkerCoordinate?.latitude).toBeLessThan(45.51);
    });
  });

  // ── setStartToCurrentLocation / setStartToCurrentLocationBuilding ─────────

  describe('setStartToCurrentLocation', () => {
    it('sets navigationStart to "Your location" and updates origin (L743-745)', () => {
      const { result } = renderNavHook();

      const coord = { latitude: 45.497, longitude: -73.578 };

      act(() => {
        result.current.setStartToCurrentLocation(coord);
      });

      expect(result.current.navigationStart).toBe('Your location');
    });
  });

  describe('setStartToCurrentLocationBuilding', () => {
    it('sets navigationStart to "Current location - <label>" (L752-755)', () => {
      const { result } = renderNavHook();

      const coord = { latitude: 45.497, longitude: -73.578 };

      act(() => {
        result.current.setStartToCurrentLocationBuilding('Alpha Hall', 'A1', coord);
      });

      expect(result.current.navigationStart).toBe('Current location - Alpha Hall (A1)');
    });

    it('omits code suffix when code is null', () => {
      const { result } = renderNavHook();

      const coord = { latitude: 45.497, longitude: -73.578 };

      act(() => {
        result.current.setStartToCurrentLocationBuilding('Some Place', null, coord);
      });

      expect(result.current.navigationStart).toBe('Current location - Some Place');
    });
  });

  // ── clearTapMarker ────────────────────────────────────────────────────────

  describe('clearTapMarker', () => {
    it('sets tapMarkerCoordinate back to null (L627-629)', () => {
      const { result } = renderNavHook();

      // First set a tap marker
      act(() => {
        result.current.handleMapBuildingPress('A1');
      });
      expect(result.current.tapMarkerCoordinate).not.toBeNull();

      // Now clear it
      act(() => {
        result.current.clearTapMarker();
      });
      expect(result.current.tapMarkerCoordinate).toBeNull();
    });
  });

  describe('rerouteFromLocation', () => {
    it('should be exposed by the hook (sanity check)', () => {
      const { result } = renderNavHook();
      expect(typeof result.current.rerouteFromLocation).toBe('function');
    });

    it('should update navigationOrigin to the supplied coordinate', async () => {
      // Provide an API key + a never-resolving fetch so we can inspect the request URL
      // before the loading state is cleared.
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID = 'test-key';
      (Platform as any).OS = 'android';
      const capturedUrls: string[] = [];
      globalThis.fetch = jest.fn().mockImplementation((url: string) => {
        capturedUrls.push(url);
        return new Promise(() => {}); // hang so isRouteLoading stays true
      });

      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      const newOrigin = { latitude: 45.496, longitude: -73.577 };
      act(() => {
        result.current.rerouteFromLocation(newOrigin);
      });

      // Wait for at least one fetch to be triggered with the new origin coords.
      await waitFor(() => expect(capturedUrls.length).toBeGreaterThan(0));
      expect(capturedUrls[0]).toContain('45.496');
      expect(capturedUrls[0]).toContain('-73.577');

      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;
    });

    it('should set isRouteLoading to true (resetRouteState is called)', async () => {
      // Provide an API key + a never-resolving fetch so the loading flag
      // fired by resetRouteState is still true when we assert.
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID = 'test-key';
      (Platform as any).OS = 'android';
      globalThis.fetch = jest.fn().mockReturnValue(new Promise(() => {}));

      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      act(() => {
        result.current.rerouteFromLocation({ latitude: 45.497, longitude: -73.579 });
      });

      await waitFor(() => expect(result.current.isRouteLoading).toBe(true));

      delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;
    });

    it('should clear shuttleInfo when called', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      act(() => {
        result.current.rerouteFromLocation({ latitude: 45.497, longitude: -73.579 });
      });

      expect(result.current.shuttleInfo).toBeNull();
    });

    it('should clear routeSummary when called', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      act(() => {
        result.current.rerouteFromLocation({ latitude: 45.497, longitude: -73.579 });
      });

      expect(result.current.routeSummary).toBeNull();
    });

    it('should accept different coordinates on successive calls (idempotent)', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      // Both calls should clear route state without throwing.
      act(() => {
        result.current.rerouteFromLocation({ latitude: 45.49, longitude: -73.57 });
      });
      act(() => {
        result.current.rerouteFromLocation({ latitude: 45.495, longitude: -73.575 });
      });

      // Route summary is reset to null on each reroute call.
      expect(result.current.routeSummary).toBeNull();
    });
  });

  // ── handleSearchSelect ───────────────────────────────────────────────────

  describe('handleSearchSelect', () => {
    it('sets navigationStart label for the start field', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      act(() => {
        result.current.handleSearchSelect('start', 'Alpha Hall', 'A1');
      });

      expect(result.current.navigationStart).toBe('Alpha Hall (A1)');
    });

    it('sets navigationStart to "Your location" and clears origin when name is "Your location"', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });

      act(() => {
        result.current.handleSearchSelect('start', 'Your location', null);
      });

      expect(result.current.navigationStart).toBe('Your location');
    });

    it('sets navigationDestination label for the destination field (L713-736)', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(null, null);
      });

      act(() => {
        result.current.handleSearchSelect('destination', 'Alpha Hall', 'A1');
      });

      expect(result.current.navigationDestination).toBe('Alpha Hall (A1)');
    });

    it('sets tapMarkerCoordinate to building centroid when destination is a known building', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openNavigationForBuilding(null, null);
      });

      // Use a real building code from BUILDING_POLYGONS ('H' = Henry F. Hall Building)
      act(() => {
        result.current.handleSearchSelect('destination', 'Henry F. Hall Building', 'H');
      });

      // tapMarkerCoordinate should be set to the centroid of Hall Building (~SGW coords)
      expect(result.current.tapMarkerCoordinate).not.toBeNull();
      expect(result.current.tapMarkerCoordinate?.latitude).toBeGreaterThan(45.49);
      expect(result.current.tapMarkerCoordinate?.latitude).toBeLessThan(45.51);
    });
  });

  // ── setStartToCurrentLocation / setStartToCurrentLocationBuilding ─────────

  describe('setStartToCurrentLocation', () => {
    it('sets navigationStart to "Your location" and updates origin (L743-745)', () => {
      const { result } = renderNavHook();

      const coord = { latitude: 45.497, longitude: -73.578 };

      act(() => {
        result.current.setStartToCurrentLocation(coord);
      });

      expect(result.current.navigationStart).toBe('Your location');
    });
  });

  describe('setStartToCurrentLocationBuilding', () => {
    it('sets navigationStart to "Current location - <label>" (L752-755)', () => {
      const { result } = renderNavHook();

      const coord = { latitude: 45.497, longitude: -73.578 };

      act(() => {
        result.current.setStartToCurrentLocationBuilding('Alpha Hall', 'A1', coord);
      });

      expect(result.current.navigationStart).toBe('Current location - Alpha Hall (A1)');
    });

    it('omits code suffix when code is null', () => {
      const { result } = renderNavHook();

      const coord = { latitude: 45.497, longitude: -73.578 };

      act(() => {
        result.current.setStartToCurrentLocationBuilding('Some Place', null, coord);
      });

      expect(result.current.navigationStart).toBe('Current location - Some Place');
    });
  });

  // ── clearTapMarker ────────────────────────────────────────────────────────

  describe('clearTapMarker', () => {
    it('sets tapMarkerCoordinate back to null (L627-629)', () => {
      const { result } = renderNavHook();

      // First set a tap marker
      act(() => {
        result.current.handleMapBuildingPress('A1');
      });
      expect(result.current.tapMarkerCoordinate).not.toBeNull();

      // Now clear it
      act(() => {
        result.current.clearTapMarker();
      });
      expect(result.current.tapMarkerCoordinate).toBeNull();
    });
  });

  // ── openIndoorOnlyNavigation / isIndoorOnlyRoute ─────────────────────────

  describe('openIndoorOnlyNavigation / isIndoorOnlyRoute', () => {
    it('isIndoorOnlyRoute starts as false', () => {
      const { result } = renderNavHook();
      expect(result.current.isIndoorOnlyRoute).toBe(false);
    });

    it('sets state correctly when called', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openIndoorOnlyNavigation('H-840', 'Hall Building');
      });

      expect(result.current.isIndoorOnlyRoute).toBe(true);
      expect(result.current.isNavigationOpen).toBe(true);
      expect(result.current.navigationDestination).toBe('H-840');
      expect(result.current.navigationStart).toBe('Hall Building');
      expect(result.current.isDestinationLocked).toBe(false);
    });

    it('uses default start label when none provided', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openIndoorOnlyNavigation('H-840');
      });

      expect(result.current.isIndoorOnlyRoute).toBe(true);
      expect(result.current.navigationStart).toBe('Building entrance');
    });

    it('closeNavigation resets isIndoorOnlyRoute to false', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openIndoorOnlyNavigation('H-840', 'Hall Building');
      });
      expect(result.current.isIndoorOnlyRoute).toBe(true);

      act(() => {
        result.current.closeNavigation();
      });
      expect(result.current.isIndoorOnlyRoute).toBe(false);
      expect(result.current.isNavigationOpen).toBe(false);
    });

    it('openNavigationForBuilding resets isIndoorOnlyRoute to false', () => {
      const { result } = renderNavHook();

      act(() => {
        result.current.openIndoorOnlyNavigation('H-840', 'Hall Building');
      });
      expect(result.current.isIndoorOnlyRoute).toBe(true);

      act(() => {
        result.current.openNavigationForBuilding(mockBuildings[0], null);
      });
      expect(result.current.isIndoorOnlyRoute).toBe(false);
    });
  });
});
