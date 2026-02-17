import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Location from "expo-location";
import {
    polygonCentroid,
    findBuildingAtOrNearCoordinate,
    coordsEqual,
    type LatLng,
} from "../utils/mapUtils";

const MAX_TAP_DISTANCE_METERS = 80;

type Building = {
    id: string;
    name: string;
    code: string | null;
    polygon: readonly LatLng[];
};

type RemoteBuilding = {
    name?: string | null;
    code?: string | null;
} | null;

type RouteSummary = {
    arrivalText: string;
    distanceText: string;
    durationText: string;
    viaText: string;
};

type RouteMode = "driving" | "transit" | "walking";

type RouteInfo = {
    durationText: string;
    durationSec: number;
    distanceText: string;
    viaText: string;
};

type ModeDurations = {
    driving?: string;
    transit?: string;
    walking?: string;
};

interface UseNavigationBetweenBuildingsParams {
    buildings: Building[];
    onSelectBuilding: (buildingId: string) => void;
    /** Called when user taps the map and the tap is far from any campus building */
    onBuildingNotFound?: () => void;
}

export function useNavigationBetweenBuildings({
    buildings,
    onSelectBuilding,
    onBuildingNotFound,
}: UseNavigationBetweenBuildingsParams) {
    const [isNavigationOpen, setIsNavigationOpen] = useState(false);
    const [navigationStart, setNavigationStart] = useState<string>("Your location");
    const [navigationDestination, setNavigationDestination] = useState<string>("");
    const [navigationOrigin, setNavigationOrigin] = useState<LatLng | null>(null);
    const [navigationDestinationCoord, setNavigationDestinationCoord] = useState<LatLng | null>(
        null
    );
    const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
    const [routeDetails, setRouteDetails] = useState<Record<RouteMode, RouteInfo | null>>({
        driving: null,
        transit: null,
        walking: null,
    });
    const [modeDurations, setModeDurations] = useState<ModeDurations>({});
    const [isRouteLoading, setIsRouteLoading] = useState(false);
    const [activeMode, setActiveMode] = useState<RouteMode>("driving");
    const [navigationActiveField, setNavigationActiveField] = useState<
        "start" | "destination" | null
    >(null);
    const [tapMarkerCoordinate, setTapMarkerCoordinate] = useState<LatLng | null>(null);

    const hasOrigin = navigationOrigin !== null;
    const hasDestinationLabel = navigationDestination.trim() !== "";
    const hasDestinationCoord = navigationDestinationCoord !== null;
    const sameOriginDestination =
        hasOrigin &&
        hasDestinationCoord &&
        navigationOrigin !== null &&
        navigationDestinationCoord !== null &&
        coordsEqual(navigationOrigin, navigationDestinationCoord);
    const missingCoordinates = hasDestinationLabel && !hasDestinationCoord;

    let directionsError: "same_origin_destination" | "missing_coordinates" | null = null;
    if (sameOriginDestination) directionsError = "same_origin_destination";
    else if (missingCoordinates) directionsError = "missing_coordinates";
    const isGetDirectionsDisabled =
        !hasOrigin ||
        !hasDestinationLabel ||
        sameOriginDestination ||
        missingCoordinates;

    const clearRouteState = useCallback(() => {
        setRouteSummary(null);
        setModeDurations({});
        setRouteDetails({ driving: null, transit: null, walking: null });
    }, []);

    const formatBuildingLabel = useCallback((name: string, code: string | null) => {
        if (!code) return name;
        return name.includes(`(${code})`) ? name : `${name} (${code})`;
    }, []);

    const getDirectionsKey = () => {
        if (Platform.OS === "ios") {
            return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS;
        }
        return process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID;
    };

    useEffect(() => {
        if (!isNavigationOpen) return;
        if (navigationStart !== "Your location") return;
        if (navigationOrigin) return;

        let cancelled = false;
        const resolveLocation = async () => {
            try {
                const permission = await Location.requestForegroundPermissionsAsync();
                if (permission.status !== "granted") return;
                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                });
                if (cancelled) return;
                setNavigationOrigin({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                });
            } catch {
                // Ignore location errors for now.
            }
        };
        void resolveLocation();
        return () => {
            cancelled = true;
        };
    }, [isNavigationOpen, navigationStart, navigationOrigin]);

    useEffect(() => {
        if (!isNavigationOpen) return;
        if (!navigationOrigin || !navigationDestinationCoord) return;
        if (sameOriginDestination || missingCoordinates) return;

        const key = getDirectionsKey();
        if (!key) return;

        let cancelled = false;

        const fetchDirections = async (mode: RouteMode): Promise<RouteInfo | null> => {
            const origin = `${navigationOrigin.latitude},${navigationOrigin.longitude}`;
            const destination = `${navigationDestinationCoord.latitude},${navigationDestinationCoord.longitude}`;
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${mode}&key=${key}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.status !== "OK" || !data.routes?.length) return null;
            const route = data.routes[0];
            const leg = route.legs?.[0];
            if (!leg) return null;
            return {
                durationText: leg.duration?.text ?? "",
                durationSec: leg.duration?.value ?? 0,
                distanceText: leg.distance?.text ?? "",
                viaText: route.summary || "",
            };
        };

        const load = async () => {
            setIsRouteLoading(true);
            setModeDurations({});
            setRouteDetails({ driving: null, transit: null, walking: null });
            try {
                const [driving, transit, walking] = await Promise.all([
                    fetchDirections("driving"),
                    fetchDirections("transit"),
                    fetchDirections("walking"),
                ]);
                if (cancelled) return;
                setRouteDetails({ driving, transit, walking });
                setModeDurations({
                    driving: driving?.durationText,
                    transit: transit?.durationText,
                    walking: walking?.durationText,
                });
            } finally {
                if (!cancelled) setIsRouteLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [
        isNavigationOpen,
        navigationOrigin,
        navigationDestinationCoord,
        sameOriginDestination,
        missingCoordinates,
    ]);

    useEffect(() => {
        if (!isNavigationOpen) return;
        const fallback =
            routeDetails[activeMode] ??
            routeDetails.driving ??
            routeDetails.transit ??
            routeDetails.walking;
        if (!fallback) {
            setRouteSummary(null);
            return;
        }
        const arrival = new Date(Date.now() + fallback.durationSec * 1000);
        const arrivalText = arrival.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
        });
        setRouteSummary({
            arrivalText,
            distanceText: fallback.distanceText,
            durationText: fallback.durationText,
            viaText: fallback.viaText || "Suggested route",
        });
    }, [activeMode, isNavigationOpen, routeDetails]);

    const openNavigationForBuilding = useCallback(
        (selectedBuilding: Building | null, remoteBuilding: RemoteBuilding) => {
            const destinationName =
                remoteBuilding?.name ?? selectedBuilding?.name ?? "Destination";
            const destinationCode =
                remoteBuilding?.code ?? selectedBuilding?.code ?? null;
            setNavigationDestination(formatBuildingLabel(destinationName, destinationCode));
            setActiveMode("driving");
            if (selectedBuilding) {
                setNavigationDestinationCoord(polygonCentroid(selectedBuilding.polygon));
            }
            clearRouteState();
            setIsNavigationOpen(true);
        },
        [clearRouteState, formatBuildingLabel]
    );

    const handleMapBuildingPress = useCallback(
        (buildingId: string) => {
            const building = buildings.find((b) => b.id === buildingId);
            if (!building) return;
            const centroid = polygonCentroid(building.polygon);
            setTapMarkerCoordinate(centroid);
            if (!isNavigationOpen) {
                onSelectBuilding(buildingId);
                return;
            }
            const label = formatBuildingLabel(building.name, building.code);
            if (navigationActiveField === "start") {
                setNavigationStart(label);
                setNavigationOrigin(centroid);
                clearRouteState();
                return;
            }
            if (navigationActiveField === "destination") {
                setNavigationDestination(label);
                setNavigationDestinationCoord(centroid);
                clearRouteState();
                return;
            }
            if (navigationDestination) {
                setNavigationStart(label);
                setNavigationOrigin(centroid);
                clearRouteState();
            } else {
                setNavigationDestination(label);
                setNavigationDestinationCoord(centroid);
                clearRouteState();
            }
        },
        [
            buildings,
            clearRouteState,
            formatBuildingLabel,
            isNavigationOpen,
            navigationActiveField,
            navigationDestination,
            onSelectBuilding,
        ]
    );

    const handleMapCoordinatePress = useCallback(
        (coordinate: LatLng) => {
            const building = findBuildingAtOrNearCoordinate(
                coordinate,
                buildings,
                MAX_TAP_DISTANCE_METERS
            );
            if (building) {
                handleMapBuildingPress(building.id);
            } else {
                setTapMarkerCoordinate(null);
                onBuildingNotFound?.();
            }
        },
        [buildings, handleMapBuildingPress, onBuildingNotFound]
    );

    const closeNavigation = useCallback(() => {
        setIsNavigationOpen(false);
        setNavigationActiveField(null);
        setTapMarkerCoordinate(null);
    }, []);


    return {
        isNavigationOpen,
        navigationStart,
        navigationDestination,
        routeSummary,
        activeMode,
        modeDurations,
        isRouteLoading,
        directionsError,
        isGetDirectionsDisabled,
        setNavigationActiveField,
        setActiveMode,
        openNavigationForBuilding,
        handleMapBuildingPress,
        handleMapCoordinatePress,
        closeNavigation,
        tapMarkerCoordinate,
    };
}
