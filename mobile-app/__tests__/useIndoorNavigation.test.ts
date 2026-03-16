/**
 * Integration tests for the useIndoorNavigation hook.
 *
 * These tests exercise the React hook's stateful logic — activation,
 * route computation, pending-navigation retry, deactivation, etc. —
 * using the REAL indoor services and the real Hall Building GeoJSON.
 *
 * Unlike the pure system tests, these validate that the hook properly
 * manages React state transitions, including the race-condition fix
 * (pendingNavRef + useEffect retry).
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useIndoorNavigation } from '../hooks/useIndoorNavigation';
import { clearCache } from '../services/indoor/buildingRegistry';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  clearCache();
});

// ---------------------------------------------------------------------------
// 1. Activation & basic state
// ---------------------------------------------------------------------------

describe('useIndoorNavigation — activation', () => {
  it('starts with indoor inactive', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    expect(result.current.isIndoorActive).toBe(false);
    expect(result.current.activeBuildingCode).toBeNull();
    expect(result.current.buildingMeta).toBeNull();
    expect(result.current.levels).toEqual([]);
    expect(result.current.indoorRoute).toBeNull();
  });

  it('activates a building with an indoor map', () => {
    const { result } = renderHook(() => useIndoorNavigation());

    let success: boolean;
    act(() => {
      success = result.current.activateBuilding('H');
    });
    expect(success!).toBe(true);
    expect(result.current.isIndoorActive).toBe(true);
    expect(result.current.activeBuildingCode).toBe('H');
    expect(result.current.buildingMeta).not.toBeNull();
    expect(result.current.buildingMeta!.code).toBe('H');
    expect(result.current.levels.length).toBeGreaterThanOrEqual(7);
    expect(result.current.activeLevel).toBe('1'); // default level
  });

  it('returns false for a non-registered building code', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    let success: boolean;
    act(() => {
      success = result.current.activateBuilding('ZZZZZ');
    });
    expect(success!).toBe(false);
    expect(result.current.isIndoorActive).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it('deactivates and clears all state', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });
    expect(result.current.isIndoorActive).toBe(true);

    act(() => {
      result.current.deactivate();
    });
    expect(result.current.isIndoorActive).toBe(false);
    expect(result.current.activeBuildingCode).toBeNull();
    expect(result.current.indoorRoute).toBeNull();
    expect(result.current.destinationRoom).toBeNull();
    expect(result.current.selectedRoom).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Route computation (building already active)
// ---------------------------------------------------------------------------

describe('useIndoorNavigation — route computation', () => {
  it('computes an indoor route to H-840 from the entrance', async () => {
    const { result } = renderHook(() => useIndoorNavigation());

    // Activate the building first
    act(() => {
      result.current.activateBuilding('H');
    });
    expect(result.current.isIndoorActive).toBe(true);

    // Navigate to room
    act(() => {
      result.current.navigateToRoom('H-840');
    });

    // Route should be computed
    expect(result.current.indoorRoute).not.toBeNull();
    expect(result.current.indoorRoute!.totalDistanceMeters).toBeGreaterThan(0);
    expect(result.current.indoorRoute!.polyline.length).toBeGreaterThan(1);
    expect(result.current.indoorRoute!.startLevel).toBe('1');
    expect(result.current.indoorRoute!.endLevel).toBe('8');
    expect(result.current.indoorRoute!.steps.length).toBeGreaterThan(0);

    // Destination room should be set
    expect(result.current.destinationRoom).not.toBeNull();
    expect(result.current.destinationRoom!.ref).toContain('840');
    expect(result.current.destinationRoom!.level).toBe('8');

    // Active level should switch to the destination level
    expect(result.current.activeLevel).toBe('8');

    // No error
    expect(result.current.error).toBeNull();
  });

  it('computes a route to H-110 (resolves and produces a route)', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });

    act(() => {
      result.current.navigateToRoom('H-110');
    });

    // Destination should be resolved
    expect(result.current.destinationRoom).not.toBeNull();
    expect(result.current.destinationRoom!.ref).toContain('110');

    // Route should exist — start from entrance (level 1)
    expect(result.current.indoorRoute).not.toBeNull();
    expect(result.current.indoorRoute!.startLevel).toBe('1');
    expect(result.current.indoorRoute!.totalDistanceMeters).toBeGreaterThan(0);
  });

  it('computes an accessible route (elevator-only) to H-840', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });

    act(() => {
      result.current.navigateToRoomAccessible('H-840', {
        avoidStairs: true,
        preferElevator: true,
      });
    });

    expect(result.current.indoorRoute).not.toBeNull();
    // Verify no stairs steps in the route
    const hasStairs = result.current.indoorRoute!.steps.some((s) => s.edgeType === 'stairs');
    expect(hasStairs).toBe(false);
    expect(result.current.indoorRoute!.totalDistanceMeters).toBeGreaterThan(0);
  });

  it('sets error for a non-existent room', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });

    act(() => {
      result.current.navigateToRoom('H-99999');
    });

    expect(result.current.indoorRoute).toBeNull();
    expect(result.current.error).toBeTruthy();
    expect(result.current.error).toContain('99999');
  });

  it('includes floor-change steps in a cross-floor route', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });
    act(() => {
      result.current.navigateToRoom('H-840');
    });

    expect(result.current.indoorRoute).not.toBeNull();
    const floorChangeSteps = result.current.indoorRoute!.steps.filter(
      (s) => s.edgeType === 'stairs' || s.edgeType === 'elevator' || s.edgeType === 'escalator',
    );
    expect(floorChangeSteps.length).toBeGreaterThan(0);
  });

  it('route has valid step instructions', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });
    act(() => {
      result.current.navigateToRoom('H-840');
    });

    expect(result.current.indoorRoute).not.toBeNull();
    for (const step of result.current.indoorRoute!.steps) {
      expect(step.instruction).toBeTruthy();
      expect(step.distanceMeters).toBeGreaterThanOrEqual(0);
      expect(step.path.length).toBeGreaterThan(0);
      expect(step.fromLevel).toBeTruthy();
      expect(step.toLevel).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Pending navigation retry (race condition fix)
// ---------------------------------------------------------------------------

describe('useIndoorNavigation — pending navigation retry', () => {
  it('computes route when navigateToRoom is called before activateBuilding', async () => {
    const { result } = renderHook(() => useIndoorNavigation());

    // Call navigateToRoom BEFORE activateBuilding — simulates the race condition
    // where both are called in the same event handler (setState is async)
    act(() => {
      result.current.navigateToRoom('H-840');
    });

    // The hook should auto-detect and activate the building
    // After the effect fires, the route should be computed
    await waitFor(() => {
      expect(result.current.isIndoorActive).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.indoorRoute).not.toBeNull();
    });

    expect(result.current.activeBuildingCode).toBe('H');
    expect(result.current.indoorRoute!.totalDistanceMeters).toBeGreaterThan(0);
    expect(result.current.indoorRoute!.endLevel).toBe('8');
    expect(result.current.destinationRoom).not.toBeNull();
  });

  it('handles simultaneous activateBuilding + navigateToRoom (same handler)', async () => {
    const { result } = renderHook(() => useIndoorNavigation());

    // Simulate the MapScreen pattern: activate then navigate in same act()
    act(() => {
      result.current.activateBuilding('H');
      result.current.navigateToRoom('H-840');
    });

    // The pending navigation should be retried via useEffect
    await waitFor(() => {
      expect(result.current.indoorRoute).not.toBeNull();
    });

    expect(result.current.indoorRoute!.totalDistanceMeters).toBeGreaterThan(0);
    expect(result.current.indoorRoute!.startLevel).toBe('1');
    expect(result.current.indoorRoute!.endLevel).toBe('8');
  });
});

// ---------------------------------------------------------------------------
// 4. Room search
// ---------------------------------------------------------------------------

describe('useIndoorNavigation — room search', () => {
  it('returns matching rooms after building is activated', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });

    const rooms = result.current.searchRooms('H-8');
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.some((r) => r.ref.includes('8'))).toBe(true);
  });

  it('returns empty array when no building is active', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    const rooms = result.current.searchRooms('H-840');
    expect(rooms).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. Indoor destination detection
// ---------------------------------------------------------------------------

describe('useIndoorNavigation — detectIndoor', () => {
  it('detects H-840 as indoor', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    const detected = result.current.detectIndoor('H-840');
    expect(detected).not.toBeNull();
    expect(detected!.buildingCode).toBe('H');
    expect(detected!.roomRef).toBe('H-840');
  });

  it('returns null for non-indoor queries', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    expect(result.current.detectIndoor('just a building name')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Floor switching & features
// ---------------------------------------------------------------------------

describe('useIndoorNavigation — floor switching', () => {
  it('changes active level and returns features for that level', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });

    // Default level is '1'
    expect(result.current.activeLevel).toBe('1');
    expect(result.current.activeLevelFeatures.length).toBeGreaterThan(0);

    // Switch to level 8
    act(() => {
      result.current.setActiveLevel('8');
    });
    expect(result.current.activeLevel).toBe('8');
    expect(result.current.activeLevelFeatures.length).toBeGreaterThan(0);
  });

  it('has populated featuresByLevel map', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });

    expect(result.current.featuresByLevel.size).toBeGreaterThanOrEqual(7);
    expect(result.current.featuresByLevel.has('1')).toBe(true);
    expect(result.current.featuresByLevel.has('8')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Room selection
// ---------------------------------------------------------------------------

describe('useIndoorNavigation — room selection', () => {
  it('selects and deselects a room', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });

    // Search for a room to select
    const rooms = result.current.searchRooms('H-840');
    expect(rooms.length).toBeGreaterThan(0);

    const room = rooms[0];
    act(() => {
      result.current.selectRoom(room);
    });
    expect(result.current.selectedRoom).toEqual(room);

    // Deselect
    act(() => {
      result.current.selectRoom(null);
    });
    expect(result.current.selectedRoom).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8. Route polyline integrity
// ---------------------------------------------------------------------------

describe('useIndoorNavigation — route polyline integrity', () => {
  it('route polyline includes the start node position', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });
    act(() => {
      result.current.navigateToRoom('H-840');
    });

    expect(result.current.indoorRoute).not.toBeNull();
    const polyline = result.current.indoorRoute!.polyline;
    expect(polyline.length).toBeGreaterThan(1);

    // First point should be near the building entrance (level 1)
    const firstPt = polyline[0];
    expect(firstPt.latitude).toBeCloseTo(45.497, 2);
    expect(firstPt.longitude).toBeCloseTo(-73.579, 2);
  });

  it('route polyline last point is near the destination room', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });
    act(() => {
      result.current.navigateToRoom('H-840');
    });

    expect(result.current.indoorRoute).not.toBeNull();
    const polyline = result.current.indoorRoute!.polyline;
    const lastPt = polyline[polyline.length - 1];

    // H-840 is roughly at lat ~45.497, lng ~-73.579
    expect(lastPt.latitude).toBeCloseTo(45.497, 2);
    expect(lastPt.longitude).toBeCloseTo(-73.579, 2);
  });
});

// ---------------------------------------------------------------------------
// 9. listRooms
// ---------------------------------------------------------------------------

describe('useIndoorNavigation — listRooms', () => {
  it('returns [] when no building is active', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    expect(result.current.listRooms()).toEqual([]);
  });

  it('returns rooms sorted by ref', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });

    const rooms = result.current.listRooms();
    expect(rooms.length).toBeGreaterThan(0);

    for (let i = 1; i < rooms.length; i++) {
      expect(rooms[i - 1].ref.localeCompare(rooms[i].ref)).toBeLessThanOrEqual(0);
    }
  });

  it('respects the limit parameter', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });

    expect(result.current.listRooms(3)).toHaveLength(3);
    expect(result.current.listRooms(1)).toHaveLength(1);
  });

  it('default limit returns up to 50 rooms', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });

    const rooms = result.current.listRooms();
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.length).toBeLessThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------
// 10. estimateTimeToRoom
// ---------------------------------------------------------------------------

describe('useIndoorNavigation — estimateTimeToRoom', () => {
  it('returns null when no building is active', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    const fakeRoom = {
      featureId: 'fake',
      ref: 'H-840',
      level: '8',
      buildingCode: 'H',
      position: { latitude: 45.497, longitude: -73.579 },
      polygon: [],
    } as any;
    expect(result.current.estimateTimeToRoom(fakeRoom)).toBeNull();
  });

  it('returns a positive number for a valid room', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });

    const rooms = result.current.searchRooms('H-840');
    expect(rooms.length).toBeGreaterThan(0);

    const seconds = result.current.estimateTimeToRoom(rooms[0]);
    expect(seconds).not.toBeNull();
    expect(seconds).toBeGreaterThan(0);
  });

  it('returns null for a room with unreachable position', () => {
    const { result } = renderHook(() => useIndoorNavigation());
    act(() => {
      result.current.activateBuilding('H');
    });

    const unreachableRoom = {
      featureId: 'unreachable',
      ref: 'FAKE-999',
      level: '99',
      buildingCode: 'H',
      position: { latitude: 0, longitude: 0 },
      polygon: [],
    } as any;
    expect(result.current.estimateTimeToRoom(unreachableRoom)).toBeNull();
  });
});
