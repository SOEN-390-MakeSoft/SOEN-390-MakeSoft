import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
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

type RouteApiResponse = {
    mode: string;
    durationSeconds: number;
    distanceMeters: number;
    eta?: string;
    summary?: string;
    polyline?: string | null;
};

interface UseNavigationBetweenBuildingsParams {
    buildings: Building[];
    onSelectBuilding: (buildingId: string) => void;
    /** Called when user taps the map and the tap is far from any campus building */
    onBuildingNotFound?: () => void;
}

const ROUTE_MODES: RouteMode[] = ["driving", "walking", "transit"];

const normalizeMode = (value: string): RouteMode | null => {
    switch (value.toLowerCase()) {
        case "driving":
        case "car":
            return "driving";
        case "walking":
        case "walk":
            return "walking";
        case "transit":
        case "shuttle":
            return "transit";
        default:
            return null;
    }
};

const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return "--";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining === 0 ? `${hours} h` : `${hours} h ${remaining} min`;
};

const formatDistance = (meters: number) => {
    if (!Number.isFinite(meters) || meters <= 0) return "--";
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
};

const getBackendBaseUrl = () => {
    const explicit =
        process.env.EXPO_PUBLIC_API_BASE_URL ||
        process.env.EXPO_PUBLIC_BACKEND_URL ||
        process.env.EXPO_PUBLIC_API_URL;
    if (explicit) return explicit.replace(/\/$/, "");

    const extra = Constants.expoConfig?.extra as { PC_IP?: string } | undefined;
    const manifestExtra = (Constants as { manifest?: { extra?: { PC_IP?: string } } }).manifest
        ?.extra;
    const pcIp =
        process.env.EXPO_PUBLIC_PC_IP ||
        extra?.PC_IP ||
        manifestExtra?.PC_IP;
    if (!pcIp) return null;
    return `http://${pcIp}:8080`;
};

const fetchRoutesFromBackend = async (
    origin: LatLng,
    destination: LatLng
): Promise<Record<RouteMode, RouteInfo | null> | null> => {
    const baseUrl = getBackendBaseUrl();
    if (!baseUrl) return null;

    const modeParam = encodeURIComponent(ROUTE_MODES.join(","));
    const url = `${baseUrl}/api/routes?originLat=${origin.latitude}&originLng=${origin.longitude}&destLat=${destination.latitude}&destLng=${destination.longitude}&mode=${modeParam}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as RouteApiResponse[];
    if (!Array.isArray(data)) return null;

    const result: Record<RouteMode, RouteInfo | null> = {
        driving: null,
        walking: null,
        transit: null,
    };

    data.forEach((route) => {
        const mode = normalizeMode(route.mode);
        if (!mode) return;
        result[mode] = {
            durationText: formatDuration(route.durationSeconds),
            durationSec: route.durationSeconds,
            distanceText: formatDistance(route.distanceMeters),
            viaText: route.summary ?? "Suggested route",
        };
    });

    const hasAny = Object.values(result).some((value) => value !== null);
    return hasAny ? result : null;
};

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

        let cancelled = false;

        const fetchDirections = async (mode: RouteMode): Promise<RouteInfo | null> => {
            const key = getDirectionsKey();
            if (!key) return null;
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
                let routes: Record<RouteMode, RouteInfo | null> | null = null;
                try {
                    routes = await fetchRoutesFromBackend(
                        navigationOrigin,
                        navigationDestinationCoord
                    );
                } catch {
                    routes = null;
                }
                if (cancelled) return;
                if (!routes) {
                    const [driving, transit, walking] = await Promise.all([
                        fetchDirections("driving"),
                        fetchDirections("transit"),
                        fetchDirections("walking"),
                    ]);
                    if (cancelled) return;
                    routes = { driving, transit, walking };
                }
                setRouteDetails(routes);
                setModeDurations({
                    driving: routes.driving?.durationText,
                    transit: routes.transit?.durationText,
                    walking: routes.walking?.durationText,
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

    const handleNavigationLocationSelect = useCallback(
        (
            field: "start" | "destination",
            selection: {
                label: string;
                coordinate: LatLng | null;
                isUserLocation?: boolean;
            }
        ) => {
            if (field === "start") {
                setNavigationStart(selection.label);
                if (selection.isUserLocation || selection.label === "Your location") {
                    setNavigationOrigin(null);
                } else {
                    setNavigationOrigin(selection.coordinate);
                }
            } else {
                setNavigationDestination(selection.label);
                setNavigationDestinationCoord(selection.coordinate);
            }
            clearRouteState();
        },
        [clearRouteState]
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
        handleNavigationLocationSelect,
        handleMapBuildingPress,
        handleMapCoordinatePress,
        closeNavigation,
        tapMarkerCoordinate,
    };
}
