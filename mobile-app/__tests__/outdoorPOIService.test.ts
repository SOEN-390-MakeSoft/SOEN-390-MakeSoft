import {
  isSupportedPOICategory,
  fetchNearbyPOIs,
  fetchPlaceDetails,
  getCampusCenterForPOI,
  SUPPORTED_CATEGORIES,
} from '../services/outdoorPOIService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const MOCK_KEY = 'test-api-key';
let originalIosKey: string | undefined;
let originalAndroidKey: string | undefined;

beforeAll(() => {
  originalIosKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS;
  originalAndroidKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;
});

beforeEach(() => {
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS = MOCK_KEY;
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID = MOCK_KEY;
});

afterEach(() => {
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS = originalIosKey;
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID = originalAndroidKey;
  jest.restoreAllMocks();
});

const SGW_CENTER = { latitude: 45.4973, longitude: -73.5789 };
const LOYOLA_CENTER = { latitude: 45.4581, longitude: -73.6402 };

// ---------------------------------------------------------------------------
// isSupportedPOICategory
// ---------------------------------------------------------------------------

describe('isSupportedPOICategory', () => {
  it('resolves "restaurant" to the restaurant type', () => {
    expect(isSupportedPOICategory('restaurant')).toBe('restaurant');
  });

  it('resolves "restaurants" (plural) to the restaurant type', () => {
    expect(isSupportedPOICategory('restaurants')).toBe('restaurant');
  });

  it('resolves "food" to the restaurant type', () => {
    expect(isSupportedPOICategory('food')).toBe('restaurant');
  });

  it('resolves "pharmacy" to the pharmacy type', () => {
    expect(isSupportedPOICategory('pharmacy')).toBe('pharmacy');
  });

  it('resolves "drugstore" to the pharmacy type', () => {
    expect(isSupportedPOICategory('drugstore')).toBe('pharmacy');
  });

  it('resolves "cafe" to the cafe type', () => {
    expect(isSupportedPOICategory('cafe')).toBe('cafe');
  });

  it('resolves "coffee" to the cafe type', () => {
    expect(isSupportedPOICategory('coffee')).toBe('cafe');
  });

  it('resolves "coffeeshop" to the cafe type', () => {
    expect(isSupportedPOICategory('coffeeshop')).toBe('cafe');
  });

  it('resolves "gym" to the gym type', () => {
    expect(isSupportedPOICategory('gym')).toBe('gym');
  });

  it('resolves "bank" to the bank type', () => {
    expect(isSupportedPOICategory('bank')).toBe('bank');
  });

  it('resolves "supermarket" to the supermarket type', () => {
    expect(isSupportedPOICategory('supermarket')).toBe('supermarket');
  });

  it('resolves "grocery" to the supermarket type', () => {
    expect(isSupportedPOICategory('grocery')).toBe('supermarket');
  });

  it('resolves "bar" to the bar type', () => {
    expect(isSupportedPOICategory('bar')).toBe('bar');
  });

  it('resolves "hospital" to the hospital type', () => {
    expect(isSupportedPOICategory('hospital')).toBe('hospital');
  });

  it('resolves "parking" to the parking type', () => {
    expect(isSupportedPOICategory('parking')).toBe('parking');
  });

  it('resolves "gas" to the gas_station type', () => {
    expect(isSupportedPOICategory('gas')).toBe('gas_station');
  });

  it('resolves "hotel" to the hotel type', () => {
    expect(isSupportedPOICategory('hotel')).toBe('hotel');
  });

  it('is case-insensitive', () => {
    expect(isSupportedPOICategory('RESTAURANT')).toBe('restaurant');
    expect(isSupportedPOICategory('Cafe')).toBe('cafe');
    expect(isSupportedPOICategory('  Pharmacy  ')).toBe('pharmacy');
  });

  it('returns null for unsupported queries', () => {
    expect(isSupportedPOICategory('bixi')).toBeNull();
    expect(isSupportedPOICategory('hall building')).toBeNull();
    expect(isSupportedPOICategory('')).toBeNull();
  });

  it('SUPPORTED_CATEGORIES contains expected values', () => {
    expect(SUPPORTED_CATEGORIES).toContain('restaurant');
    expect(SUPPORTED_CATEGORIES).toContain('cafe');
    expect(SUPPORTED_CATEGORIES).toContain('pharmacy');
  });
});

// ---------------------------------------------------------------------------
// fetchNearbyPOIs
// ---------------------------------------------------------------------------

describe('fetchNearbyPOIs', () => {
  const center = SGW_CENTER;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('preserves API distance order and maps fields correctly', async () => {
    const mockResults = [
      {
        place_id: 'p2',
        name: 'Nearby Cafe',
        vicinity: '1 Close St',
        geometry: { location: { lat: 45.498, lng: -73.579 } },
        rating: 4.5,
        opening_hours: { open_now: false },
      },
      {
        place_id: 'p1',
        name: 'Faraway Cafe',
        vicinity: '100 Far St',
        geometry: { location: { lat: 45.51, lng: -73.57 } },
        rating: 4.2,
        opening_hours: { open_now: true },
      },
    ];

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'OK', results: mockResults }),
    } as Response);

    const pois = await fetchNearbyPOIs('cafe', center, 5000);

    expect(pois).toHaveLength(2);
    expect(pois[0].name).toBe('Nearby Cafe');
    expect(pois[1].name).toBe('Faraway Cafe');
    expect(pois[0].id).toBe('p2');
    expect(pois[0].category).toBe('cafe');
    expect(pois[0].rating).toBe(4.5);
    expect(pois[0].openNow).toBe(false);
    expect(pois[1].openNow).toBe(true);
  });

  it('returns all results within radius (no artificial cap)', async () => {
    const mockResults = Array.from({ length: 15 }, (_, i) => ({
      place_id: `p${i}`,
      name: `Place ${i}`,
      vicinity: `${i} St`,
      geometry: { location: { lat: 45.497 + i * 0.0001, lng: -73.578 } },
    }));

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'OK', results: mockResults }),
    } as Response);

    const pois = await fetchNearbyPOIs('restaurant', center, 5000);
    expect(pois).toHaveLength(15);
  });

  it('filters out POIs beyond the radius', async () => {
    const mockResults = [
      {
        place_id: 'near',
        name: 'Near Place',
        vicinity: '1 Close St',
        geometry: { location: { lat: 45.498, lng: -73.579 } },
      },
      {
        place_id: 'far',
        name: 'Far Place',
        vicinity: '100 Far St',
        geometry: { location: { lat: 46.0, lng: -73.0 } },
      },
    ];

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'OK', results: mockResults }),
    } as Response);

    const pois = await fetchNearbyPOIs('restaurant', center, 5000);
    expect(pois).toHaveLength(1);
    expect(pois[0].name).toBe('Near Place');
  });

  it('returns empty array on ZERO_RESULTS', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ZERO_RESULTS', results: [] }),
    } as Response);

    const pois = await fetchNearbyPOIs('restaurant', center, 5000);
    expect(pois).toEqual([]);
  });

  it('returns empty array when response is not ok', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    const pois = await fetchNearbyPOIs('restaurant', center, 5000);
    expect(pois).toEqual([]);
  });

  it('returns empty array on API error status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'REQUEST_DENIED', results: [] }),
    } as Response);

    const pois = await fetchNearbyPOIs('restaurant', center, 5000);
    expect(pois).toEqual([]);
  });
it('returns empty array when API key is empty', async () => {
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS = '';
  const pois = await fetchNearbyPOIs('restaurant', center, 5000);
  expect(pois).toEqual([]);
});

  it('constructs the correct URL', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'OK', results: [] }),
    } as Response);

    await fetchNearbyPOIs('pharmacy', center, 5000);

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('type=pharmacy');
    expect(calledUrl).toContain(`location=${center.latitude},${center.longitude}`);
    expect(calledUrl).toContain('rankby=distance');
    expect(calledUrl).toContain(`key=${MOCK_KEY}`);
  });

  it('passes AbortSignal to fetch when provided', async () => {
    const signal = new AbortController().signal;
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'OK', results: [] }),
    } as Response);

    await fetchNearbyPOIs('pharmacy', center, 5000, signal);

    expect(fetchSpy).toHaveBeenCalledWith(expect.any(String), { signal });
  });
});

// ---------------------------------------------------------------------------
// fetchPlaceDetails
// ---------------------------------------------------------------------------

describe('fetchPlaceDetails', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns address, rating, and openNow from the API', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        result: {
          formatted_address: '123 Main St, Montreal, QC',
          rating: 4.3,
          opening_hours: { open_now: true },
        },
      }),
    } as Response);

    const details = await fetchPlaceDetails('ChIJ123');
    expect(details.address).toBe('123 Main St, Montreal, QC');
    expect(details.rating).toBe(4.3);
    expect(details.openNow).toBe(true);
  });

  it('returns empty address when API response is not OK', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'NOT_FOUND' }),
    } as Response);

    const details = await fetchPlaceDetails('bad-id');
    expect(details.address).toBe('');
  });

  it('returns empty address when fetch fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response);

    const details = await fetchPlaceDetails('ChIJ123');
    expect(details.address).toBe('');
  });

  it('returns empty address when API key is empty', async () => {
    const original = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS;
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS = '';
    const details = await fetchPlaceDetails('ChIJ123');
    expect(details.address).toBe('');
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS = original;
  });

  it('constructs the correct URL with place_id and fields', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'OK', result: { formatted_address: 'Abc' } }),
    } as Response);

    await fetchPlaceDetails('ChIJ_test');
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('place_id=ChIJ_test');
    expect(calledUrl).toContain('fields=formatted_address,rating,opening_hours');
    expect(calledUrl).toContain(`key=${MOCK_KEY}`);
  });
});

// ---------------------------------------------------------------------------
// getCampusCenterForPOI
// ---------------------------------------------------------------------------

describe('getCampusCenterForPOI', () => {
  it('returns user location when user is on SGW campus', () => {
    const userOnSGW = { latitude: 45.4965, longitude: -73.578 };
    const result = getCampusCenterForPOI(userOnSGW, 'loyola');
    expect(result).toEqual(userOnSGW);
  });

  it('returns user location when user is on Loyola campus', () => {
    const userOnLoyola = { latitude: 45.458, longitude: -73.64 };
    const result = getCampusCenterForPOI(userOnLoyola, 'sgw');
    expect(result).toEqual(userOnLoyola);
  });

  it('returns SGW center when user is off-campus and active campus is sgw', () => {
    const userOffCampus = { latitude: 45.52, longitude: -73.6 };
    const result = getCampusCenterForPOI(userOffCampus, 'sgw');
    expect(result).toEqual(SGW_CENTER);
  });

  it('returns Loyola center when user is off-campus and active campus is loyola', () => {
    const userOffCampus = { latitude: 45.52, longitude: -73.6 };
    const result = getCampusCenterForPOI(userOffCampus, 'loyola');
    expect(result).toEqual(LOYOLA_CENTER);
  });

  it('returns SGW center when user location is null and active campus is sgw', () => {
    expect(getCampusCenterForPOI(null, 'sgw')).toEqual(SGW_CENTER);
  });

  it('returns Loyola center when user location is null and active campus is loyola', () => {
    expect(getCampusCenterForPOI(null, 'loyola')).toEqual(LOYOLA_CENTER);
  });
});
