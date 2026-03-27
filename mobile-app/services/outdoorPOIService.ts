import { Platform } from 'react-native';
import { getCampusFromCoordinate, distanceMeters, type LatLng } from '../utils/mapUtils';

export type OutdoorPOI = {
  id: string;
  name: string;
  address: string;
  coordinate: LatLng;
  category: string;
  rating?: number;
  openNow?: boolean;
};

const SGW_CENTER: LatLng = { latitude: 45.4973, longitude: -73.5789 };
const LOYOLA_CENTER: LatLng = { latitude: 45.4581, longitude: -73.6402 };

const POI_CATEGORY_MAP: Record<string, string> = {
  restaurant: 'restaurant',
  restaurants: 'restaurant',
  food: 'restaurant',
  pharmacy: 'pharmacy',
  drugstore: 'pharmacy',
  cafe: 'cafe',
  coffee: 'cafe',
  coffeeshop: 'cafe',
  gym: 'gym',
  bank: 'bank',
  supermarket: 'supermarket',
  grocery: 'supermarket',
  bar: 'bar',
  hospital: 'hospital',
  library: 'library',
  parking: 'parking',
  gas_station: 'gas_station',
  gas: 'gas_station',
  hotel: 'hotel',
};

export const SUPPORTED_CATEGORIES = [...new Set(Object.values(POI_CATEGORY_MAP))];

/**
 * Returns the Google Places type if the query matches a supported outdoor POI
 * category, or null otherwise.
 */
export function isSupportedPOICategory(query: string): string | null {
  const normalized = query.trim().toLowerCase();
  return POI_CATEGORY_MAP[normalized] ?? null;
}

function getPlacesKey(): string {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS ?? '';
  }
  return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID ?? '';
}

/**
 * Fetch nearby outdoor POIs from Google Places Nearby Search.
 * Uses `rankby=distance` so the API returns results ordered by proximity
 * to `center`, then applies a client-side distance cap at `radiusMeters`.
 */
export async function fetchNearbyPOIs(
  type: string,
  center: LatLng,
  radiusMeters: number,
  signal?: AbortSignal,
): Promise<OutdoorPOI[]> {
  const key = getPlacesKey();
  if (!key) return [];

  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${center.latitude},${center.longitude}` +
    `&rankby=distance` +
    `&type=${type}` +
    `&key=${key}`;

  const response = await fetch(url, { signal });
  if (!response.ok) return [];

  const data = await response.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') return [];
  if (!Array.isArray(data.results)) return [];

  const pois: OutdoorPOI[] = data.results
    .map((place: any) => ({
      id: place.place_id ?? '',
      name: place.name ?? '',
      address: place.vicinity ?? '',
      coordinate: {
        latitude: place.geometry?.location?.lat ?? 0,
        longitude: place.geometry?.location?.lng ?? 0,
      },
      category: type,
      rating: place.rating,
      openNow: place.opening_hours?.open_now,
    }))
    .filter((poi: OutdoorPOI) => distanceMeters(center, poi.coordinate) <= radiusMeters);

  return pois;
}

/**
 * Fetch place details (address, rating, hours) from Google Places Details API.
 * Used to enrich POIs selected via the map's onPoiClick which only provides
 * placeId, name, and coordinate.
 */
export async function fetchPlaceDetails(
  placeId: string,
): Promise<{ address: string; rating?: number; openNow?: boolean }> {
  const key = getPlacesKey();
  if (!key) return { address: '' };

  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${placeId}` +
    `&fields=formatted_address,rating,opening_hours` +
    `&key=${key}`;

  const response = await fetch(url);
  if (!response.ok) return { address: '' };

  const data = await response.json();
  if (data.status !== 'OK' || !data.result) return { address: '' };

  return {
    address: data.result.formatted_address ?? '',
    rating: data.result.rating,
    openNow: data.result.opening_hours?.open_now,
  };
}

/**
 * Determine the center point for a POI search.
 * If the user is on a campus, use their location; otherwise fall back to
 * the center of the currently active campus.
 */
export function getCampusCenterForPOI(
  userLocation: LatLng | null,
  activeCampus: 'sgw' | 'loyola',
): LatLng {
  if (userLocation) {
    const campus = getCampusFromCoordinate(userLocation);
    if (campus) return userLocation;
  }
  return activeCampus === 'loyola' ? LOYOLA_CENTER : SGW_CENTER;
}
