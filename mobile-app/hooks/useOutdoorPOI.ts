import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import {
  isSupportedPOICategory,
  fetchNearbyPOIs,
  getCampusCenterForPOI,
  type OutdoorPOI,
} from '../services/outdoorPOIService';
import type { LatLng } from '../utils/mapUtils';

function formatGeocodedAddress(geo: Location.LocationGeocodedAddress): string {
  const street = [geo.streetNumber, geo.street].filter(Boolean).join(' ');
  return [street, geo.city, geo.region].filter(Boolean).join(', ');
}

const POI_SEARCH_RADIUS_METERS = 1000;

interface UseOutdoorPOIOptions {
  debouncedQuery: string;
  userLocation: LatLng | null;
  activeCampus: 'sgw' | 'loyola';
}

export function useOutdoorPOI({
  debouncedQuery,
  userLocation,
  activeCampus,
}: UseOutdoorPOIOptions) {
  const [outdoorPOIResults, setOutdoorPOIResults] = useState<OutdoorPOI[]>([]);
  const [selectedOutdoorPOI, setSelectedOutdoorPOI] = useState<OutdoorPOI | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const category = isSupportedPOICategory(debouncedQuery);
    if (!category) {
      setOutdoorPOIResults([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    const resolveCenter = async (): Promise<LatLng> => {
      if (userLocation) return userLocation;
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      } catch (error) {
        console.warn('useOutdoorPOI: failed to get current position for POI search', error);
        return getCampusCenterForPOI(null, activeCampus);
      }
    };

    const loadPOIs = async () => {
      try {
        const center = await resolveCenter();
        if (controller.signal.aborted) return;

        const results = await fetchNearbyPOIs(
          category,
          center,
          POI_SEARCH_RADIUS_METERS,
          controller.signal,
        );
        if (controller.signal.aborted) return;

        setOutdoorPOIResults(results);
      } catch {
        if (controller.signal.aborted) return;
        setOutdoorPOIResults([]);
      } finally {
        if (controller.signal.aborted) return;
        setIsLoading(false);
      }
    };

    void loadPOIs();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, userLocation, activeCampus]);

  const selectPOI = useCallback((poi: OutdoorPOI) => {
    setSelectedOutdoorPOI(poi);
  }, []);

  /** Select a POI from the map and resolve its address via device geocoding. */
  const selectPOIFromMap = useCallback((basePOI: OutdoorPOI) => {
    setSelectedOutdoorPOI(basePOI);
    if (!basePOI.address) {
      Location.reverseGeocodeAsync(basePOI.coordinate)
        .then((results) => {
          if (results.length === 0) return;
          const address = results[0].formattedAddress || formatGeocodedAddress(results[0]);
          if (!address) return;
          setSelectedOutdoorPOI((prev) => (prev?.id === basePOI.id ? { ...prev, address } : prev));
        })
        .catch((error) => {
          console.warn('useOutdoorPOI: reverse geocoding failed for selected POI', error);
        });
    }
  }, []);

  const clearSelectedPOI = useCallback(() => {
    setSelectedOutdoorPOI(null);
  }, []);

  return {
    outdoorPOIResults,
    selectedOutdoorPOI,
    isOutdoorPOILoading: isLoading,
    selectPOI,
    selectPOIFromMap,
    clearSelectedPOI,
  };
}
