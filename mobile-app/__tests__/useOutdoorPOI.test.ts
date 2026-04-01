import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useOutdoorPOI } from '../hooks/useOutdoorPOI';
import type { LatLng } from '../utils/mapUtils';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetchNearbyPOIs = jest.fn();
const mockIsSupportedPOICategory = jest.fn();
const mockGetCampusCenterForPOI = jest.fn();
const mockReverseGeocodeAsync = jest.fn();
const mockGetCurrentPositionAsync = jest.fn();

jest.mock('../services/outdoorPOIService', () => ({
  isSupportedPOICategory: (...args: any[]) => mockIsSupportedPOICategory(...args),
  fetchNearbyPOIs: (...args: any[]) => mockFetchNearbyPOIs(...args),
  getCampusCenterForPOI: (...args: any[]) => mockGetCampusCenterForPOI(...args),
}));

jest.mock('expo-location', () => ({
  reverseGeocodeAsync: (...args: any[]) => mockReverseGeocodeAsync(...args),
  getCurrentPositionAsync: (...args: any[]) => mockGetCurrentPositionAsync(...args),
  Accuracy: { Balanced: 3 },
}));

const SGW_CENTER = { latitude: 45.4973, longitude: -73.5789 };
let warnSpy: jest.SpiedFunction<typeof console.warn>;

function expectAbortSignal(signal: unknown) {
  expect(signal).toEqual(expect.objectContaining({ aborted: false }));
}

const makePOI = (id: string, name: string) => ({
  id,
  name,
  address: `${name} St`,
  coordinate: { latitude: 45.497, longitude: -73.578 },
  category: 'restaurant',
  rating: 4.0,
  openNow: true,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useOutdoorPOI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetCampusCenterForPOI.mockReturnValue(SGW_CENTER);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns empty results when query is not a supported category', () => {
    mockIsSupportedPOICategory.mockReturnValue(null);

    const { result } = renderHook(() =>
      useOutdoorPOI({
        debouncedQuery: 'hall building',
        userLocation: null,
        activeCampus: 'sgw',
      }),
    );

    expect(result.current.outdoorPOIResults).toEqual([]);
    expect(result.current.isOutdoorPOILoading).toBe(false);
    expect(mockFetchNearbyPOIs).not.toHaveBeenCalled();
  });

  it('fetches POIs when query matches a category', async () => {
    const pois = [makePOI('p1', 'Cafe A'), makePOI('p2', 'Cafe B')];
    mockIsSupportedPOICategory.mockReturnValue('cafe');
    mockFetchNearbyPOIs.mockResolvedValue(pois);

    const { result } = renderHook(() =>
      useOutdoorPOI({
        debouncedQuery: 'cafe',
        userLocation: null,
        activeCampus: 'sgw',
      }),
    );

    await waitFor(() => {
      expect(result.current.outdoorPOIResults).toEqual(pois);
    });

    expect(mockFetchNearbyPOIs).toHaveBeenCalledWith(
      'cafe',
      SGW_CENTER,
      1000,
      expect.objectContaining({ aborted: false }),
    );
    expect(mockGetCampusCenterForPOI).toHaveBeenCalledWith(null, 'sgw');
    expect(result.current.isOutdoorPOILoading).toBe(false);
  });

  it('fetches and merges multiple selected categories from the menu', async () => {
    const restaurantPOIs = [makePOI('p1', 'Restaurant A')];
    const cafePOIs = [makePOI('p2', 'Cafe A'), makePOI('p1', 'Restaurant A')];
    const selectedCategories: Array<'restaurant' | 'cafe'> = ['restaurant', 'cafe'];
    mockIsSupportedPOICategory.mockReturnValue(null);
    mockFetchNearbyPOIs.mockResolvedValueOnce(restaurantPOIs).mockResolvedValueOnce(cafePOIs);

    const { result } = renderHook(() =>
      useOutdoorPOI({
        debouncedQuery: '',
        userLocation: null,
        activeCampus: 'sgw',
        selectedCategories,
      }),
    );

    await waitFor(() => {
      expect(result.current.outdoorPOIResults).toEqual([restaurantPOIs[0], cafePOIs[0]]);
    });

    expect(mockFetchNearbyPOIs).toHaveBeenNthCalledWith(
      1,
      'restaurant',
      SGW_CENTER,
      1000,
      expect.objectContaining({ aborted: false }),
    );
    expect(mockFetchNearbyPOIs).toHaveBeenNthCalledWith(
      2,
      'cafe',
      SGW_CENTER,
      1000,
      expect.objectContaining({ aborted: false }),
    );
  });

  it('clears results when query changes to non-category', async () => {
    const pois = [makePOI('p1', 'Cafe A')];
    mockIsSupportedPOICategory.mockReturnValue('cafe');
    mockFetchNearbyPOIs.mockResolvedValue(pois);

    const { result, rerender } = renderHook((props) => useOutdoorPOI(props), {
      initialProps: {
        debouncedQuery: 'cafe',
        userLocation: null as any,
        activeCampus: 'sgw' as const,
      },
    });

    await waitFor(() => {
      expect(result.current.outdoorPOIResults).toHaveLength(1);
    });

    mockIsSupportedPOICategory.mockReturnValue(null);
    rerender({
      debouncedQuery: 'hall',
      userLocation: null,
      activeCampus: 'sgw' as const,
    });

    await waitFor(() => {
      expect(result.current.outdoorPOIResults).toEqual([]);
    });
  });

  it('handles fetch errors gracefully', async () => {
    mockIsSupportedPOICategory.mockReturnValue('restaurant');
    mockFetchNearbyPOIs.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useOutdoorPOI({
        debouncedQuery: 'restaurant',
        userLocation: null,
        activeCampus: 'sgw',
      }),
    );

    await waitFor(() => {
      expect(result.current.isOutdoorPOILoading).toBe(false);
    });

    expect(result.current.outdoorPOIResults).toEqual([]);
  });

  it('selectPOI sets selectedOutdoorPOI', async () => {
    mockIsSupportedPOICategory.mockReturnValue(null);

    const { result } = renderHook(() =>
      useOutdoorPOI({
        debouncedQuery: '',
        userLocation: null,
        activeCampus: 'sgw',
      }),
    );

    const poi = makePOI('p1', 'Test Cafe');
    act(() => {
      result.current.selectPOI(poi);
    });

    expect(result.current.selectedOutdoorPOI).toEqual(poi);
  });

  it('clearSelectedPOI clears selectedOutdoorPOI', async () => {
    mockIsSupportedPOICategory.mockReturnValue(null);

    const { result } = renderHook(() =>
      useOutdoorPOI({
        debouncedQuery: '',
        userLocation: null,
        activeCampus: 'sgw',
      }),
    );

    const poi = makePOI('p1', 'Test Cafe');
    act(() => {
      result.current.selectPOI(poi);
    });
    expect(result.current.selectedOutdoorPOI).toEqual(poi);

    act(() => {
      result.current.clearSelectedPOI();
    });
    expect(result.current.selectedOutdoorPOI).toBeNull();
  });

  it('selectPOIFromMap resolves address via reverse geocoding', async () => {
    mockIsSupportedPOICategory.mockReturnValue(null);
    mockReverseGeocodeAsync.mockResolvedValue([
      {
        streetNumber: '456',
        street: 'Fetched Ave',
        city: 'Montreal',
        region: 'QC',
        formattedAddress: null,
      },
    ]);

    const { result } = renderHook(() =>
      useOutdoorPOI({
        debouncedQuery: '',
        userLocation: null,
        activeCampus: 'sgw',
      }),
    );

    const basePOI = {
      id: 'gmap-poi-1',
      name: 'Map POI',
      address: '',
      coordinate: { latitude: 45.497, longitude: -73.578 },
      category: 'place',
    };

    await act(async () => {
      result.current.selectPOIFromMap(basePOI);
    });

    await waitFor(() => {
      expect(result.current.selectedOutdoorPOI?.address).toBe('456 Fetched Ave, Montreal, QC');
    });

    expect(mockReverseGeocodeAsync).toHaveBeenCalledWith(basePOI.coordinate);
  });

  it('selectPOIFromMap uses formattedAddress when available', async () => {
    mockIsSupportedPOICategory.mockReturnValue(null);
    mockReverseGeocodeAsync.mockResolvedValue([
      { formattedAddress: '456 Fetched Ave, Montreal, QC H3G 1M8, Canada' },
    ]);

    const { result } = renderHook(() =>
      useOutdoorPOI({
        debouncedQuery: '',
        userLocation: null,
        activeCampus: 'sgw',
      }),
    );

    const basePOI = {
      id: 'gmap-poi-fmt',
      name: 'Formatted POI',
      address: '',
      coordinate: { latitude: 45.497, longitude: -73.578 },
      category: 'place',
    };

    await act(async () => {
      result.current.selectPOIFromMap(basePOI);
    });

    await waitFor(() => {
      expect(result.current.selectedOutdoorPOI?.address).toBe(
        '456 Fetched Ave, Montreal, QC H3G 1M8, Canada',
      );
    });
  });

  it('selectPOIFromMap keeps base POI if reverse geocoding fails', async () => {
    mockIsSupportedPOICategory.mockReturnValue(null);
    const error = new Error('fail');
    mockReverseGeocodeAsync.mockRejectedValue(error);

    const { result } = renderHook(() =>
      useOutdoorPOI({
        debouncedQuery: '',
        userLocation: null,
        activeCampus: 'sgw',
      }),
    );

    const basePOI = {
      id: 'gmap-poi-2',
      name: 'Another POI',
      address: '',
      coordinate: { latitude: 45.497, longitude: -73.578 },
      category: 'place',
    };

    await act(async () => {
      result.current.selectPOIFromMap(basePOI);
    });

    expect(result.current.selectedOutdoorPOI?.name).toBe('Another POI');
    expect(result.current.selectedOutdoorPOI?.address).toBe('');
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        'useOutdoorPOI: reverse geocoding failed for selected POI',
        error,
      );
    });
  });

  it('uses cached user location as search center when available', async () => {
    const userLocation = { latitude: 45.496, longitude: -73.578 };
    mockIsSupportedPOICategory.mockReturnValue('cafe');
    mockFetchNearbyPOIs.mockResolvedValue([]);

    renderHook(() =>
      useOutdoorPOI({
        debouncedQuery: 'cafe',
        userLocation,
        activeCampus: 'loyola',
      }),
    );

    await waitFor(() => {
      expect(mockFetchNearbyPOIs).toHaveBeenCalledWith(
        'cafe',
        userLocation,
        1000,
        expect.objectContaining({ aborted: false }),
      );
    });
    expect(mockGetCurrentPositionAsync).not.toHaveBeenCalled();
    expect(mockGetCampusCenterForPOI).not.toHaveBeenCalled();
  });

  it('requests GPS when cached location is null', async () => {
    const gpsLocation = { latitude: 45.499, longitude: -73.577 };
    mockIsSupportedPOICategory.mockReturnValue('cafe');
    mockFetchNearbyPOIs.mockResolvedValue([]);
    mockGetCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: gpsLocation.latitude, longitude: gpsLocation.longitude },
    });

    renderHook(() =>
      useOutdoorPOI({
        debouncedQuery: 'cafe',
        userLocation: null,
        activeCampus: 'loyola',
      }),
    );

    await waitFor(() => {
      expect(mockGetCurrentPositionAsync).toHaveBeenCalled();
      expect(mockFetchNearbyPOIs).toHaveBeenCalledWith(
        'cafe',
        gpsLocation,
        1000,
        expect.objectContaining({ aborted: false }),
      );
    });
    expect(mockGetCampusCenterForPOI).not.toHaveBeenCalled();
  });

  it('falls back to campus center when GPS also fails', async () => {
    mockIsSupportedPOICategory.mockReturnValue('cafe');
    mockFetchNearbyPOIs.mockResolvedValue([]);
    const error = new Error('GPS denied');
    mockGetCurrentPositionAsync.mockRejectedValue(error);

    renderHook(() =>
      useOutdoorPOI({
        debouncedQuery: 'cafe',
        userLocation: null,
        activeCampus: 'loyola',
      }),
    );

    await waitFor(() => {
      expect(mockGetCampusCenterForPOI).toHaveBeenCalledWith(null, 'loyola');
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'useOutdoorPOI: failed to get current position for POI search',
      error,
    );
  });

  it('aborts the previous POI request when a new search starts', async () => {
    const secondResults = [makePOI('p2', 'New Cafe')];
    mockIsSupportedPOICategory.mockImplementation((query: string) => query);
    mockGetCurrentPositionAsync.mockResolvedValue({
      coords: { latitude: SGW_CENTER.latitude, longitude: SGW_CENTER.longitude },
    });

    mockFetchNearbyPOIs
      .mockImplementationOnce(
        (_type: string, _center: unknown, _radius: number, signal?: AbortSignal) =>
          new Promise((_, reject) => {
            signal?.addEventListener('abort', () => {
              reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
            });
          }),
      )
      .mockResolvedValueOnce(secondResults);

    const { result, rerender } = renderHook((props) => useOutdoorPOI(props), {
      initialProps: {
        debouncedQuery: 'cafe',
        userLocation: null as LatLng | null,
        activeCampus: 'sgw' as const,
      },
    });

    await waitFor(() => {
      expect(mockFetchNearbyPOIs).toHaveBeenCalledTimes(1);
    });

    const firstSignal = mockFetchNearbyPOIs.mock.calls[0][3];
    expectAbortSignal(firstSignal);

    rerender({
      debouncedQuery: 'restaurant',
      userLocation: null,
      activeCampus: 'sgw' as const,
    });

    await waitFor(() => {
      expect(mockFetchNearbyPOIs).toHaveBeenCalledTimes(2);
    });

    expect(firstSignal.aborted).toBe(true);

    await waitFor(() => {
      expect(result.current.outdoorPOIResults).toEqual(secondResults);
    });
  });
});
