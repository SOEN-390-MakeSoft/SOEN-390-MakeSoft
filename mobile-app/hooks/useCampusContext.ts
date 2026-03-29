import { useMemo, useState } from 'react';
import { BUILDING_POLYGONS } from '../data/buildingPolygons';
import { LOYOLA_BUILDING_POLYGONS } from '../data/buildingPolygonsLoyola';
import { BUILDING_ADDRESSES } from '../data/building-addresses';
import { normalizeLabel, extractCodeFromName } from '../utils/stringUtils';
import { formatAddress } from '../utils/mapUtils';

type LatLng = { latitude: number; longitude: number };
type Campus = 'sgw' | 'loyola';
type BuildingRecord =
  | (typeof BUILDING_POLYGONS)[keyof typeof BUILDING_POLYGONS]
  | (typeof LOYOLA_BUILDING_POLYGONS)[keyof typeof LOYOLA_BUILDING_POLYGONS];

type Building = {
  id: string;
  name: string;
  address: string | null;
  code: string | null;
  polygon: readonly LatLng[];
};

const DEFAULT_REGION = {
  latitude: 45.4973,
  longitude: -73.5789,
  latitudeDelta: 0.008,
  longitudeDelta: 0.008,
};

const LOYOLA_REGION = {
  latitude: 45.4581,
  longitude: -73.6402,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

/**
 * Hook to manage campus context including active campus, buildings, and campus switching
 */
export function useCampusContext(onCampusChange?: (campus: Campus) => void) {
  const [activeCampus, setActiveCampus] = useState<Campus>('sgw');

  // Build address lookup map + fuzzy list
  const { addressLookup, addressEntries } = useMemo(() => {
    const lookup = new Map<string, { name: string; address: string; code: string }>();
    const entries: { normalizedName: string; name: string; address: string; code: string }[] = [];

    const addEntry = (key: string, entry: { name: string; address: string; code: string }) => {
      const normalizedKey = normalizeLabel(key);
      if (!lookup.has(normalizedKey)) {
        lookup.set(normalizedKey, entry);
        entries.push({ normalizedName: normalizedKey, ...entry });
      }
    };

    for (const entry of BUILDING_ADDRESSES) {
      const data = { name: entry.name, address: entry.address, code: entry.code };
      addEntry(entry.name, data);
      if (entry.aliases) {
        for (const alias of entry.aliases) {
          addEntry(alias, data);
        }
      }
    }

    return { addressLookup: lookup, addressEntries: entries };
  }, []);

  const addressByCode = useMemo(() => {
    const lookup = new Map<string, { name: string; address: string; code: string }>();
    for (const entry of BUILDING_ADDRESSES) {
      lookup.set(entry.code.toUpperCase(), {
        name: entry.name,
        address: entry.address,
        code: entry.code,
      });
    }
    return lookup;
  }, []);

  const mapCampusPolygons = (campusPolygons: Record<string, BuildingRecord>): Building[] =>
    (Object.entries(campusPolygons) as [string, BuildingRecord][])
      .map(([id, record]) => {
        const normalizedName = normalizeLabel(record.name);
        let lookup = addressLookup.get(normalizedName);

        if (!lookup) {
          const fuzzyMatches = addressEntries.filter(
            (entry) =>
              normalizedName.includes(entry.normalizedName) ||
              entry.normalizedName.includes(normalizedName),
          );
          if (fuzzyMatches.length === 1) {
            lookup = {
              name: fuzzyMatches[0].name,
              address: fuzzyMatches[0].address,
              code: fuzzyMatches[0].code,
            };
          }
        }

        let code = lookup?.code ?? extractCodeFromName(record.name);
        const codeLookup = code ? addressByCode.get(code.toUpperCase()) : undefined;
        const address = formatAddress(record) ?? lookup?.address ?? codeLookup?.address ?? null;
        const name = codeLookup?.name ?? lookup?.name ?? record.name;
        if (!code && codeLookup?.code) code = codeLookup.code;

        return { id, name, address, code, polygon: record.polygon };
      })
      .filter((building) => building.polygon.length > 0);

  const sgwBuildings = useMemo<Building[]>(() => {
    return mapCampusPolygons(BUILDING_POLYGONS as Record<string, BuildingRecord>);
  }, [addressEntries, addressByCode, addressLookup]);

  const loyolaBuildings = useMemo<Building[]>(() => {
    return mapCampusPolygons(LOYOLA_BUILDING_POLYGONS as Record<string, BuildingRecord>);
  }, [addressEntries, addressByCode, addressLookup]);

  const buildings = useMemo<Building[]>(() => {
    return [...sgwBuildings, ...loyolaBuildings];
  }, [loyolaBuildings, sgwBuildings]);

  /**
   * Handles campus switching with map region change
   */
  const handleSelectCampus = (campus: Campus, mapRef?: React.RefObject<any>) => {
    setActiveCampus(campus);
    if (mapRef?.current) {
      const region = campus === 'loyola' ? LOYOLA_REGION : DEFAULT_REGION;
      mapRef.current.animateToRegion(region, 500);
    }
    onCampusChange?.(campus);
  };

  return {
    activeCampus,
    setActiveCampus,
    buildings,
    sgwBuildings,
    loyolaBuildings,
    addressLookup,
    handleSelectCampus,
  };
}
