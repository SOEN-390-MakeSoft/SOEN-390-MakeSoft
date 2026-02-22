import { useMemo, useState } from "react";
import { BUILDING_POLYGONS } from "../data/buildingPolygons";
import { LOYOLA_BUILDING_POLYGONS } from "../data/buildingPolygonsLoyola";
import { BUILDING_ADDRESSES } from "../data/building-addresses";
import { normalizeLabel, extractCodeFromName } from "../utils/stringUtils";
import { formatAddress } from "../utils/mapUtils";

type LatLng = { latitude: number; longitude: number };
type Campus = "sgw" | "loyola";
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
export function useCampusContext(
    onCampusChange?: (campus: Campus) => void
) {
    const [activeCampus, setActiveCampus] = useState<Campus>("sgw");

    // Build address lookup map
    const addressLookup = useMemo(() => {
        const lookup = new Map<string, { name: string; address: string; code: string }>();
        for (const entry of BUILDING_ADDRESSES) {
            lookup.set(normalizeLabel(entry.name), {
                name: entry.name,
                address: entry.address,
                code: entry.code,
            });
            if (entry.aliases) {
                for (const alias of entry.aliases) {
                    lookup.set(normalizeLabel(alias), {
                        name: entry.name,
                        address: entry.address,
                        code: entry.code,
                    });
                }
            }
        }
        return lookup;
    }, []);

    const mapCampusPolygons = (
        campusPolygons: Record<string, BuildingRecord>
    ): Building[] =>
        (Object.entries(campusPolygons) as [string, BuildingRecord][])
            .map(([id, record]) => {
                const lookup = addressLookup.get(normalizeLabel(record.name));
                const address = formatAddress(record) ?? lookup?.address ?? null;
                const code = lookup?.code ?? extractCodeFromName(record.name);
                return { id, name: record.name, address, code, polygon: record.polygon };
            })
            .filter((building) => building.polygon.length > 0);

    const sgwBuildings = useMemo<Building[]>(() => {
        return mapCampusPolygons(BUILDING_POLYGONS as Record<string, BuildingRecord>);
    }, [addressLookup]);

    const loyolaBuildings = useMemo<Building[]>(() => {
        return mapCampusPolygons(LOYOLA_BUILDING_POLYGONS as Record<string, BuildingRecord>);
    }, [addressLookup]);

    const buildings = useMemo<Building[]>(() => {
        return [...sgwBuildings, ...loyolaBuildings];
    }, [loyolaBuildings, sgwBuildings]);

    /**
     * Handles campus switching with map region change
     */
    const handleSelectCampus = (campus: Campus, mapRef?: React.RefObject<any>) => {
        setActiveCampus(campus);
        if (mapRef?.current) {
            const region = campus === "loyola" ? LOYOLA_REGION : DEFAULT_REGION;
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
