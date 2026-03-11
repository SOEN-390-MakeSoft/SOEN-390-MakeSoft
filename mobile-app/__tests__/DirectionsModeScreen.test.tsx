import React from 'react';
import { render, act, waitFor, fireEvent } from '@testing-library/react-native';
import * as Location from 'expo-location';
import DirectionsModeScreen from '../components/DirectionsModeScreen';
import type { NavigationStep } from '../hooks/useNavigationBetweenBuildings';
import type { LatLng } from '../utils/mapUtils';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

jest.mock('expo-location');

jest.mock('../context/settings', () => ({
  useSettings: () => ({ colourBlindMode: false }),
}));

jest.mock('tamagui', () => ({
  useTheme: () => ({
    colourBlind1: { get: () => '#B3D4FF' },
    colourBlind2: { get: () => '#1F4E8C' },
  }),
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: unknown) =>
      React.createElement(View, { testID: 'material-icon', ...(props as object) }),
  };
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const STEPS: NavigationStep[] = [
  {
    instruction: 'Head north on Rue Guy',
    distanceText: '100 m',
    durationText: '1 min',
    maneuver: 'straight',
    focusCoordinate: { latitude: 45.498, longitude: -73.579 },
  },
  {
    instruction: 'Turn left onto Blvd de Maisonneuve',
    distanceText: '200 m',
    durationText: '2 min',
    maneuver: 'turn-left',
    focusCoordinate: { latitude: 45.498, longitude: -73.581 },
  },
];

/**
 * A vertical polyline segment running roughly north from lat 45.497 to 45.498
 * along longitude -73.579.  At latitude 45° → 1° lat ≈ 111 320 m.
 */
const ROUTE_POLYLINE: LatLng[] = [
  { latitude: 45.497, longitude: -73.579 },
  { latitude: 45.498, longitude: -73.579 },
];

/**
 * Exactly mid-way on the segment → 0 m from the polyline.
 */
const ON_ROUTE_COORD = { latitude: 45.4975, longitude: -73.579 };

/**
 * Displaced ~31.5 m east of the segment mid-point (0.0004° lng × 78 710 m/° ≈ 31.5 m).
 * Consistently above the 30 m off-route threshold.
 */
const OFF_ROUTE_COORD = { latitude: 45.4975, longitude: -73.5794 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Captured watchPositionAsync callback, populated by the mock below. */
let capturedLocationCallback: ((loc: Location.LocationObject) => void) | null = null;
const mockSubscriptionRemove = jest.fn();

function makeMockLocation(coord: { latitude: number; longitude: number }): Location.LocationObject {
  return {
    coords: {
      latitude: coord.latitude,
      longitude: coord.longitude,
      accuracy: 5,
      altitude: 0,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  } as unknown as Location.LocationObject;
}

/** Render the component and wait until watchPositionAsync has been called. */
async function renderAndTrack(
  props: Partial<React.ComponentProps<typeof DirectionsModeScreen>> = {},
) {
  const merged = {
    visible: true,
    steps: STEPS,
    onClose: jest.fn(),
    ...props,
  };
  const utils = render(<DirectionsModeScreen {...merged} />);
  await waitFor(() => expect(capturedLocationCallback).not.toBeNull());
  return utils;
}

// ---------------------------------------------------------------------------
// Before / after hooks
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  capturedLocationCallback = null;
  mockSubscriptionRemove.mockReset();

  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
    status: 'granted',
  });
  (Location.watchPositionAsync as jest.Mock).mockImplementation(async (_opts, cb) => {
    capturedLocationCallback = cb;
    return { remove: mockSubscriptionRemove };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DirectionsModeScreen', () => {
  // ── visibility ──────────────────────────────────────────────────────────

  describe('visibility', () => {
    it('renders nothing when visible is false', () => {
      const { queryByTestId } = render(
        <DirectionsModeScreen visible={false} steps={STEPS} onClose={jest.fn()} />,
      );
      expect(queryByTestId('directions-mode-screen')).toBeNull();
    });

    it('renders the screen when visible is true', async () => {
      const { getByTestId } = await renderAndTrack();
      expect(getByTestId('directions-mode-screen')).toBeTruthy();
    });

    it('does NOT start location tracking when visible is false', () => {
      render(<DirectionsModeScreen visible={false} steps={STEPS} onClose={jest.fn()} />);
      expect(Location.watchPositionAsync).not.toHaveBeenCalled();
    });

    it('starts location tracking when visible is true', async () => {
      await renderAndTrack();
      expect(Location.watchPositionAsync).toHaveBeenCalled();
    });
  });

  // ── tracking badge ───────────────────────────────────────────────────────

  describe('tracking badge label', () => {
    it('shows "Locating…" before permissions are granted (loading state)', async () => {
      // Make permission request hang so tracking never starts.
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockReturnValue(
        new Promise(() => {}),
      );
      const { getByText } = render(
        <DirectionsModeScreen visible={true} steps={STEPS} onClose={jest.fn()} />,
      );
      expect(getByText('Locating\u2026')).toBeTruthy();
    });

    it('shows "Live" once location tracking has started', async () => {
      const { getByText } = await renderAndTrack();
      expect(getByText('Live')).toBeTruthy();
    });

    it('shows "Recalculating…" when isRerouting prop is true', async () => {
      const { getByText } = await renderAndTrack({ isRerouting: true });
      expect(getByText('Recalculating\u2026')).toBeTruthy();
    });

    it('shows "Live" when isRerouting returns to false after being true', async () => {
      const { getByText, rerender } = await renderAndTrack({ isRerouting: true });
      expect(getByText('Recalculating\u2026')).toBeTruthy();

      rerender(
        <DirectionsModeScreen
          visible={true}
          steps={STEPS}
          onClose={jest.fn()}
          isRerouting={false}
        />,
      );
      expect(getByText('Live')).toBeTruthy();
    });
  });

  // ── step display ─────────────────────────────────────────────────────────

  describe('step display', () => {
    it('renders the first step instruction on mount', async () => {
      const { getByText } = await renderAndTrack();
      expect(getByText('Head north on Rue Guy')).toBeTruthy();
    });

    it('shows step counter correctly', async () => {
      const { getByTestId } = await renderAndTrack();
      const counter = getByTestId('directions-mode-position');
      expect(counter.props.children.join('')).toContain('Step 1 of 2');
    });

    it('shows "Done" button on the last step', async () => {
      const { getByTestId } = await renderAndTrack({
        steps: [STEPS[0]],
      });
      // Advance to the only (last) step by simulating a location near its focusCoordinate.
      act(() => {
        capturedLocationCallback!(makeMockLocation({ latitude: 45.498, longitude: -73.579 }));
      });
      expect(getByTestId('directions-mode-done')).toBeTruthy();
    });

    it('calls onClose when Done button is pressed', async () => {
      const onClose = jest.fn();
      const { getByTestId } = await renderAndTrack({
        steps: [STEPS[0]],
        onClose,
      });
      act(() => {
        capturedLocationCallback!(makeMockLocation({ latitude: 45.498, longitude: -73.579 }));
      });
      fireEvent.press(getByTestId('directions-mode-done'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ── onLocationUpdate callback ────────────────────────────────────────────

  describe('onLocationUpdate callback', () => {
    it('fires onLocationUpdate with the current coordinate and step index', async () => {
      const onLocationUpdate = jest.fn();
      await renderAndTrack({ onLocationUpdate });

      act(() => {
        capturedLocationCallback!(makeMockLocation(ON_ROUTE_COORD));
      });

      expect(onLocationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: ON_ROUTE_COORD.latitude,
          longitude: ON_ROUTE_COORD.longitude,
        }),
        expect.any(Number),
      );
    });

    it('does not fire onLocationUpdate when no callback is provided', async () => {
      // Should not throw.
      await renderAndTrack({ onLocationUpdate: undefined });
      act(() => {
        capturedLocationCallback!(makeMockLocation(ON_ROUTE_COORD));
      });
    });

    it('advances to the next step when user approaches a later step focusCoordinate (covers L129-130)', async () => {
      /**
       * STEPS[0].focusCoordinate = { latitude: 45.498, longitude: -73.579 }
       * STEPS[1].focusCoordinate = { latitude: 45.498, longitude: -73.581 }
       *
       * Sending location very close to STEPS[1] forces findBestStepIndex()
       * to return 1, which differs from the initial currentStepIndexRef=0.
       * This executes the `if (newIndex !== currentStepIndexRef.current)` body
       * at lines 129-130 of DirectionsModeScreen.tsx.
       */
      const onLocationUpdate = jest.fn();
      const { getByText } = await renderAndTrack({ steps: STEPS, onLocationUpdate });

      // Coordinate very close to step-1 focusCoordinate (0.0001° away lng → ~8 m)
      const nearStep1 = { latitude: 45.498, longitude: -73.5811 };

      act(() => {
        capturedLocationCallback!(makeMockLocation(nearStep1));
      });

      // The component should display step 1's instruction.
      await waitFor(() => {
        expect(getByText(/Turn left onto Blvd de Maisonneuve/i)).toBeTruthy();
      });

      // onLocationUpdate should have been called with step index 1 (not 0).
      expect(onLocationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: nearStep1.latitude,
          longitude: nearStep1.longitude,
        }),
        1,
      );
    });
  });

  // ── off-route detection ──────────────────────────────────────────────────

  describe('off-route detection (onOffRoute)', () => {
    it('does NOT call onOffRoute when user is on the polyline', async () => {
      const onOffRoute = jest.fn();
      await renderAndTrack({ routePolyline: ROUTE_POLYLINE, onOffRoute });

      act(() => {
        capturedLocationCallback!(makeMockLocation(ON_ROUTE_COORD));
      });

      expect(onOffRoute).not.toHaveBeenCalled();
    });

    it('calls onOffRoute when user is more than 30 m from the polyline', async () => {
      const onOffRoute = jest.fn();
      await renderAndTrack({ routePolyline: ROUTE_POLYLINE, onOffRoute });

      act(() => {
        capturedLocationCallback!(makeMockLocation(OFF_ROUTE_COORD));
      });

      expect(onOffRoute).toHaveBeenCalledTimes(1);
      expect(onOffRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: OFF_ROUTE_COORD.latitude,
          longitude: OFF_ROUTE_COORD.longitude,
        }),
      );
    });

    it('does NOT call onOffRoute when routePolyline is not provided', async () => {
      const onOffRoute = jest.fn();
      await renderAndTrack({ routePolyline: undefined, onOffRoute });

      act(() => {
        capturedLocationCallback!(makeMockLocation(OFF_ROUTE_COORD));
      });

      expect(onOffRoute).not.toHaveBeenCalled();
    });

    it('does NOT call onOffRoute when routePolyline is empty', async () => {
      const onOffRoute = jest.fn();
      await renderAndTrack({ routePolyline: [], onOffRoute });

      act(() => {
        capturedLocationCallback!(makeMockLocation(OFF_ROUTE_COORD));
      });

      expect(onOffRoute).not.toHaveBeenCalled();
    });

    it('does NOT call onOffRoute when onOffRoute callback is not provided', async () => {
      // Should not throw even when the user is off-route.
      await renderAndTrack({ routePolyline: ROUTE_POLYLINE, onOffRoute: undefined });
      act(() => {
        capturedLocationCallback!(makeMockLocation(OFF_ROUTE_COORD));
      });
    });
  });

  // ── reroute cooldown ─────────────────────────────────────────────────────

  describe('reroute cooldown (15 s)', () => {
    /**
     * The initial value of lastRerouteRef is 0.  The cooldown condition is
     * `now - lastRerouteRef.current > REROUTE_COOLDOWN_MS (15 000 ms)`, so the
     * first off-route event must have `now > 15 000` to fire at all.
     * We start mockNow at 20 000 ms throughout these tests.
     */

    it('fires onOffRoute only once within the 15 s cooldown window', async () => {
      const onOffRoute = jest.fn();
      let mockNow = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

      await renderAndTrack({ routePolyline: ROUTE_POLYLINE, onOffRoute });

      // First off-route event at t=20 000 ms → fires (20 000 > 15 000).
      mockNow = 20_000;
      act(() => {
        capturedLocationCallback!(makeMockLocation(OFF_ROUTE_COORD));
      });
      expect(onOffRoute).toHaveBeenCalledTimes(1);

      // Second event at t=25 000 ms (only 5 s after first) → should NOT fire.
      mockNow = 25_000;
      act(() => {
        capturedLocationCallback!(makeMockLocation(OFF_ROUTE_COORD));
      });
      expect(onOffRoute).toHaveBeenCalledTimes(1);
    });

    it('fires onOffRoute again after the 15 s cooldown has elapsed', async () => {
      const onOffRoute = jest.fn();
      let mockNow = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

      await renderAndTrack({ routePolyline: ROUTE_POLYLINE, onOffRoute });

      // First trigger at t=20 000 ms (fires).
      mockNow = 20_000;
      act(() => {
        capturedLocationCallback!(makeMockLocation(OFF_ROUTE_COORD));
      });
      expect(onOffRoute).toHaveBeenCalledTimes(1);

      // Second trigger at t=36 000 ms (16 s after first) → should fire again.
      mockNow = 36_000;
      act(() => {
        capturedLocationCallback!(makeMockLocation(OFF_ROUTE_COORD));
      });
      expect(onOffRoute).toHaveBeenCalledTimes(2);
    });

    it('resets the cooldown timer when visible toggles to false then back to true', async () => {
      const onOffRoute = jest.fn();
      let mockNow = 0;
      jest.spyOn(Date, 'now').mockImplementation(() => mockNow);

      const { rerender } = await renderAndTrack({ routePolyline: ROUTE_POLYLINE, onOffRoute });

      // Step 1: fire at t=20 000 ms → lastRerouteRef becomes 20 000.
      mockNow = 20_000;
      act(() => {
        capturedLocationCallback!(makeMockLocation(OFF_ROUTE_COORD));
      });
      expect(onOffRoute).toHaveBeenCalledTimes(1);

      // Step 2: hide component → lastRerouteRef is reset to 0.
      rerender(
        <DirectionsModeScreen
          visible={false}
          steps={STEPS}
          routePolyline={ROUTE_POLYLINE}
          onOffRoute={onOffRoute}
          onClose={jest.fn()}
        />,
      );

      // Step 3: show again → tracking restarts.
      capturedLocationCallback = null;
      rerender(
        <DirectionsModeScreen
          visible={true}
          steps={STEPS}
          routePolyline={ROUTE_POLYLINE}
          onOffRoute={onOffRoute}
          onClose={jest.fn()}
        />,
      );
      await waitFor(() => expect(capturedLocationCallback).not.toBeNull());

      // Step 4: trigger at t=21 000 ms.
      // WITHOUT reset: 21 000 - 20 000 = 1 000 < 15 000 → would be blocked.
      // WITH reset (lastRerouteRef = 0): 21 000 - 0 = 21 000 > 15 000 → fires.
      mockNow = 21_000;
      act(() => {
        capturedLocationCallback!(makeMockLocation(OFF_ROUTE_COORD));
      });
      expect(onOffRoute).toHaveBeenCalledTimes(2);
    });
  });

  // ── subscription cleanup ─────────────────────────────────────────────────

  describe('subscription cleanup', () => {
    it('removes the location subscription when visible becomes false', async () => {
      const { rerender } = await renderAndTrack();

      rerender(<DirectionsModeScreen visible={false} steps={STEPS} onClose={jest.fn()} />);

      expect(mockSubscriptionRemove).toHaveBeenCalled();
    });

    it('removes the location subscription on unmount', async () => {
      const { unmount } = await renderAndTrack();
      unmount();
      expect(mockSubscriptionRemove).toHaveBeenCalled();
    });

    it('does not start tracking when location permission is denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });
      render(<DirectionsModeScreen visible={true} steps={STEPS} onClose={jest.fn()} />);
      // Give async startTracking a tick to complete.
      await act(async () => {});
      expect(Location.watchPositionAsync).not.toHaveBeenCalled();
    });
  });

  // ── close button ─────────────────────────────────────────────────────────

  describe('close button', () => {
    it('calls onClose when the close button is pressed', async () => {
      const onClose = jest.fn();
      const { getByTestId } = await renderAndTrack({ onClose });
      fireEvent.press(getByTestId('directions-mode-close'));
      expect(onClose).toHaveBeenCalled();
    });
  });
});
