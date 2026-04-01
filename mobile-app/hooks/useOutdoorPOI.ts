import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import {
  isSupportedPOICategory,
  fetchNearbyPOIs,
  getCampusCenterForPOI,
  type OutdoorPOICategory,
  type OutdoorPOI,
} from '../services/outdoorPOIService';
import type { LatLng } from '../utils/mapUtils';

function formatGeocodedAddress(geo: Location.LocationGeocodedAddress): string {
  const street = [geo.streetNumber, geo.street].filter(Boolean).join(' ');
  return [street, geo.city, geo.region].filter(Boolean).join(', ');
}

const POI_SEARCH_RADIUS_METERS = 1000;
const EMPTY_SELECTED_CATEGORIES: OutdoorPOICategory[] = [];

interface UseOutdoorPOIOptions {
  debouncedQuery: string;
  userLocation: LatLng | null;
  activeCampus: 'sgw' | 'loyola';
  selectedCategories?: OutdoorPOICategory[];
}

export function useOutdoorPOI({
  debouncedQuery,
  userLocation,
  activeCampus,
  selectedCategories = EMPTY_SELECTED_CATEGORIES,
}: UseOutdoorPOIOptions) {
  const [outdoorPOIResults, setOutdoorPOIResults] = useState<OutdoorPOI[]>([]);
  const [selectedOutdoorPOI, setSelectedOutdoorPOI] = useState<OutdoorPOI | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const queryCategory = isSupportedPOICategory(debouncedQuery);
    const activeCategories =
      selectedCategories.length > 0 ? selectedCategories : queryCategory ? [queryCategory] : [];

    if (activeCategories.length === 0) {
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

        const resultsByCategory = await Promise.all(
          activeCategories.map((category) =>
            fetchNearbyPOIs(category, center, POI_SEARCH_RADIUS_METERS, controller.signal),
          ),
        );
        if (controller.signal.aborted) return;

        const deduplicatedResults: OutdoorPOI[] = [];
        const seenPoiIds = new Set<string>();

        for (const categoryResults of resultsByCategory) {
          for (const poi of categoryResults) {
            if (!poi.id || seenPoiIds.has(poi.id)) continue;
            seenPoiIds.add(poi.id);
            deduplicatedResults.push(poi);
          }
        }

        setOutdoorPOIResults(deduplicatedResults);
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
  }, [activeCampus, debouncedQuery, selectedCategories, userLocation]);

  const selectPOI = useCallback((poi: OutdoorPOI) => {
    setSelectedOutdoorPOI(poi);
  }, []);

  /** Select a POI from the map and resolve its address via device geocoding. */
  const selectPOIFromMap = useCallback((basePOI: OutdoorPOI) => {
    let isActive = true;

    setSelectedOutdoorPOI(basePOI);

    if (!basePOI.address) {
      Location.reverseGeocodeAsync(basePOI.coordinate)
        .then((results) => {
          if (!isActive || results.length === 0) return;

          const address = results[0].formattedAddress || formatGeocodedAddress(results[0]);

          if (!isActive || !address) return;

          setSelectedOutdoorPOI((prev) =>
            isActive && prev?.id === basePOI.id ? { ...prev, address } : prev,
          );
        })
        .catch((error) => {
          if (!isActive) return;
          console.warn('useOutdoorPOI: reverse geocoding failed for selected POI', error);
        });
    }

    return () => {
      isActive = false;
    };
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
