import React, { useRef, useState, useCallback, useEffect } from "react";
import {
    Dimensions,
    Platform,
    StyleSheet,
    View,
    Text,
} from "react-native";
import MapView, { Marker, Polygon, Polyline } from "react-native-maps";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTheme } from "tamagui";
import CampusSwitch from "./CampusSwitch";
import BuildingInfoCard from "./BuildingInfoCard";
import QuickPickPanel from "./QuickPickPanel";
import MapMenu from "./MapMenu";
import NavigationScreen from "./NavigationScreen";
import SearchBar from "./SearchBar";
import { useSettings } from "../context/settings";
import { useNavigationBetweenBuildings } from "../hooks/useNavigationBetweenBuildings";
import { useSelectedBuilding } from "../hooks/useSelectedBuilding";
import { useSearch } from "../hooks/useSearch";
import { useUserLocation } from "../hooks/useUserLocation";
import { useMapUI } from "../hooks/useMapUI";
import { useCampusContext } from "../hooks/useCampusContext";
import { polygonCentroid } from "../utils/mapUtils";
import { normalizeLabel } from "../utils/stringUtils";

type QuickPick = {
    code: string;
    label: string;
    color: string;
    colorBlind?: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    hint?: string;
};
type Campus = "sgw" | "loyola";

const POLYGON_STROKE = "rgba(178, 27, 44, 0.9)";
const POLYGON_FILL = "rgba(178, 27, 44, 0.25)";
const POLYGON_FILL_SELECTED = "rgba(178, 27, 44, 0.7)";

const DEFAULT_REGION = {
    latitude: 45.4973,
    longitude: -73.5789,
    latitudeDelta: 0.008,
    longitudeDelta: 0.008,
};

const FEATURED_BUILDINGS: Record<Campus, QuickPick[]> = {
    sgw: [
        {
            code: "H",
            label: "Pavillon\nHenry F Hall",
            color: "#b24a53",
            colorBlind: "#f3e0a6",
            icon: "location-city",
            hint: "Hall",
        },
        {
            code: "LB",
            label: "Pavillon\nMcConnell Bldg",
            color: "#4f7f86",
            colorBlind: "#cfd6df",
            icon: "place",
            hint: "McConnell",
        },
        {
            code: "EV",
            label: "Pavillon EV",
            color: "#d5964a",
            colorBlind: "#bcd0e8",
            icon: "location-city",
            hint: "EV",
        },
        {
            code: "MB",
            label: "John Molson\nSchool of Business",
            color: "#6b8f76",
            colorBlind: "#a7b6ad",
            icon: "location-city",
            hint: "Molson",
        },
    ],
    loyola: [
        {
            code: "AD",
            label: "AD Building",
            color: "#7ba56e",
            colorBlind: "#a3b097",
            icon: "location-city",
            hint: "Administration",
        },
        {
            code: "FC",
            label: "F.C. Smith\nBuilding",
            color: "#4f7f9b",
            colorBlind: "#8fa3b8",
            icon: "location-city",
            hint: "Smith",
        },
        {
            code: "CC",
            label: "Central\nBuilding",
            color: "#d5964a",
            colorBlind: "#c8d1e3",
            icon: "location-city",
            hint: "Central",
        },
        {
            code: "SP",
            label: "Richard J. Renaud\nScience Complex",
            color: "#b24a6a",
            colorBlind: "#d5cfb7",
            icon: "place",
            hint: "Renaud",
        },
    ],
};

const isSearchDisabled = false;

export default function MapScreen() {
    const mapRef = useRef<MapView>(null);
    const { width, height } = Dimensions.get("window");

    // Use custom hooks for state management
    const { activeCampus, buildings, handleSelectCampus } = useCampusContext();
    const {
        selectedBuildingId,
        remoteBuilding,
        isLoading,
        errorMessage,
        handleSelectBuilding,
        handleCloseCard,
    } = useSelectedBuilding(buildings, mapRef);
    const [buildingNotFoundToast, setBuildingNotFoundToast] = useState(false);
    const showBuildingNotFoundToast = useCallback(() => setBuildingNotFoundToast(true), []);
    useEffect(() => {
        if (!buildingNotFoundToast) return;
        const t = setTimeout(() => setBuildingNotFoundToast(false), 2500);
        return () => clearTimeout(t);
    }, [buildingNotFoundToast]);

    const {
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
        handleSearchSelect,
        closeNavigation,
        tapMarkerCoordinate,        
        selectedTransportMode,
        setSelectedTransportMode,
        routePolyline,
        routeSegments,
        routeRegion,
        navigationSteps,
        isCrossCampus,
    } = useNavigationBetweenBuildings({
        buildings,
        onSelectBuilding: handleSelectBuilding,
        onBuildingNotFound: showBuildingNotFoundToast,
    });
    const {
        searchQuery,
        setSearchQuery,
        isSearchFocused,
        setIsSearchFocused,
        searchInputRef,
        searchResults,
        handleSearchSubmit,
        handleSelectSearchResult,
    } = useSearch(buildings, (building) => {
        handleSelectBuilding(building.id);
        const centroid = polygonCentroid(building.polygon);
        mapRef.current?.animateToRegion(
            { ...centroid, latitudeDelta: 0.0032, longitudeDelta: 0.0032 },
            500
        );
    });
    const {
        isMenuOpen,
        setIsMenuOpen,
        isQuickPickOpen,
        quickPickContentHeight,
        setQuickPickContentHeight,
        quickPickVisibleHeight,
        quickPickMaxHeight,
        handleToggleQuickPick,
    } = useMapUI();
    const { colourBlindMode } = useSettings();
    const theme = useTheme();
    const { isLocating, goToUserLocation } = useUserLocation(
        mapRef as React.RefObject<{ animateToRegion: (region: any, duration: number) => void }>
    );

    // Get selected building for info card
    const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) ?? null;

    // Auto-zoom camera to fit the route polyline
    useEffect(() => {
        if (routeRegion) {
            mapRef.current?.animateToRegion(routeRegion, 600);
        }
    }, [routeRegion]);


    const menuTop =
        Platform.OS === "ios"
            ? Math.max(16, Math.round(height * 0.06))
            : Math.max(12, Math.round(height * 0.02));
    const menuLeft =
        Platform.OS === "ios"
            ? Math.max(10, Math.round(width * 0.04))
            : Math.max(8, Math.round(width * 0.02));

    const isColorBlind = colourBlindMode;
    const brandRed = theme?.cred?.get?.() ?? "#b21b2c";
    const defaultColor = theme?.cred?.get?.() ?? POLYGON_STROKE;
    let polygonFillBase = POLYGON_FILL;
    let polygonStrokeBase = POLYGON_STROKE;
    let polygonFillSelected = POLYGON_FILL_SELECTED;

    if (colourBlindMode) {
        if (theme?.colourBlind1?.get) {
            polygonFillBase = theme.colourBlind1.get() || defaultColor;
            polygonFillSelected = polygonFillBase;
        }
        if (theme?.colourBlind2?.get) {
            polygonStrokeBase = theme.colourBlind2.get() || defaultColor;
        }
    } else if (theme?.buildingPrimary?.get) {
        const primaryColor = theme.buildingPrimary.get() || defaultColor;
        polygonFillBase = primaryColor;
        polygonStrokeBase = primaryColor;
        polygonFillSelected = primaryColor;
    }

    const polygonStroke = polygonStrokeBase;
    const polygonFill = polygonFillBase;

    /**
     * Handle quick pick building selection
     */
    const handleQuickPick = (pick: QuickPick) => {
        const hint = pick.hint ? normalizeLabel(pick.hint) : null;
        const match =
            buildings.find(
                (building) =>
                    hint && normalizeLabel(building.name).includes(hint)
            ) ??
            buildings.find(
                (building) => building.code?.toUpperCase() === pick.code
            );
        if (!match) return;
        handleSelectBuilding(match.id);
        const centroid = polygonCentroid(match.polygon);
        mapRef.current?.animateToRegion(
            { ...centroid, latitudeDelta: 0.0032, longitudeDelta: 0.0032 },
            500
        );
    };

    /**
     * Handle campus selection - reset search and selection
     */
    const handleCampusChange = (campus: Campus) => {
        handleSelectCampus(campus, mapRef);
        setSearchQuery("");
        setIsSearchFocused(false);
        searchInputRef.current?.blur();
    };

    return (
        <View style={styles.container} testID="map-screen">
            <MapView
                ref={mapRef}
                style={styles.map}
                provider="google"
                initialRegion={DEFAULT_REGION}
                testID="campus-map"
                showsUserLocation
                showsCompass={false}
                showsMyLocationButton={false}
                onPress={(e) => {
                    const coordinate = e.nativeEvent?.coordinate;
                    if (coordinate?.latitude != null && coordinate?.longitude != null) {
                        handleMapCoordinatePress(coordinate);
                    }
                }}
            >
                {tapMarkerCoordinate && (
                    <Marker
                        coordinate={tapMarkerCoordinate}
                        testID="map-tap-marker"
                        pinColor={brandRed}
                    />
                )}
                {routePolyline.length > 0 && selectedTransportMode === 'driving' && (
                    <Polyline
                        key="route-driving"
                        coordinates={routePolyline}
                        strokeColor="#4A89F3"
                        strokeWidth={5}
                    />
                )}
                {routePolyline.length > 0 && selectedTransportMode === 'walking' && (
                    <Polyline
                        key="route-walking"
                        coordinates={routePolyline}
                        strokeColor="#4A89F3"
                        strokeWidth={5}
                        lineDashPattern={[10, 6]}
                    />
                )}
                {selectedTransportMode === 'shuttle' && routeSegments.length > 0 && routeSegments.map((segment, index) => (
                    <Polyline
                        key={`route-shuttle-segment-${segment.kind}-${index}`}
                        testID={`route-shuttle-segment-${segment.kind}-${index}`}
                        coordinates={segment.polyline}
                        strokeColor={segment.kind === "walking" ? "#4A89F3" : brandRed}
                        strokeWidth={5}
                        lineDashPattern={segment.kind === "walking" ? [10, 6] : undefined}
                    />
                ))}
                {routePolyline.length > 0 && selectedTransportMode === 'shuttle' && routeSegments.length === 0 && (
                    <Polyline
                        key="route-shuttle"
                        coordinates={routePolyline}
                        strokeColor={brandRed}
                        strokeWidth={5}
                    />
                )}
                {buildings.map((building) => {
                    const centroid = polygonCentroid(building.polygon);
                    const isSelected = building.id === selectedBuildingId;
                    return (
                        <React.Fragment key={building.id}>
                            <Polygon
                                coordinates={[...building.polygon]}
                                strokeColor={polygonStroke}
                                fillColor={isSelected ? polygonFillSelected : polygonFill}
                                strokeWidth={2}
                                tappable
                                onPress={() => handleMapBuildingPress(building.id)}
                            />
                            <Marker
                                coordinate={centroid}
                                onPress={() => handleMapBuildingPress(building.id)}
                                anchor={{ x: 0.5, y: 0.5 }}
                                opacity={0}
                            />
                        </React.Fragment>
                    );
                })}
            </MapView>

            {/* Top Controls: Search, Menu, Brand Badge */}
            <View
                style={[
                    styles.topControls,
                    { top: menuTop, paddingHorizontal: menuLeft },
                ]}
                pointerEvents="box-none"
            >
                <SearchBar
                    searchQuery={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmit={handleSearchSubmit}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    isSearchFocused={isSearchFocused}
                    isSearchDisabled={isSearchDisabled}
                    searchResults={searchResults}
                    onSelectResult={handleSelectSearchResult}
                    onOpenMenu={() => setIsMenuOpen(true)}
                    inputRef={searchInputRef}
                    brandColor={brandRed}
                    logoSource={require("../assets/images/Concordia_icon.png")}
                />
                <View style={[styles.campusToggle, isNavigationOpen && styles.campusToggleNavigation]}>
                    <CampusSwitch
                        selectedCampus={activeCampus === "sgw" ? "SGW" : "Loyola"}
                        onCampusChange={(campus) =>
                            handleCampusChange(campus === "SGW" ? "sgw" : "loyola")
                        }
                    />
                </View>
            </View>

            {/* Building Info Card */}
            <BuildingInfoCard
                selectedBuilding={selectedBuilding}
                remoteBuilding={remoteBuilding}
                isLoading={isLoading}
                errorMessage={errorMessage}
                onClose={handleCloseCard}
                isColorBlind={isColorBlind}
                onDirections={() => {
                    openNavigationForBuilding(selectedBuilding, remoteBuilding);
                    handleCloseCard();
                }}
            />            
            <NavigationScreen
                visible={isNavigationOpen}
                startLabel={navigationStart}
                destinationLabel={navigationDestination}
                onClose={closeNavigation}
                onActiveFieldChange={setNavigationActiveField}
                onBuildingSelect={handleSearchSelect}
                modeDurations={modeDurations}
                tripSummary={routeSummary}
                isLoading={isRouteLoading}
                directionsError={directionsError}
                isGetDirectionsDisabled={isGetDirectionsDisabled}
                selectedTransportMode={selectedTransportMode}
                onTransportModeChange={setSelectedTransportMode}
                navigationSteps={navigationSteps}
                isCrossCampus={isCrossCampus}
            />

            {/* Quick Pick Panel and Location Button */}
            {!isMenuOpen && !isNavigationOpen && (
                <QuickPickPanel
                    activeCampus={activeCampus}
                    isColorBlind={isColorBlind}
                    isQuickPickOpen={isQuickPickOpen}
                    quickPickMaxHeight={quickPickMaxHeight}
                    quickPickVisibleHeight={quickPickVisibleHeight}
                    quickPickContentHeight={quickPickContentHeight}
                    featuredBuildings={FEATURED_BUILDINGS[activeCampus]}
                    isLocating={isLocating}
                    onToggleOpen={handleToggleQuickPick}
                    onHeightChange={setQuickPickContentHeight}
                    onQuickPick={handleQuickPick}
                    onLocationPress={goToUserLocation}
                />
            )}

            <MapMenu visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

            {buildingNotFoundToast && (
                <View style={styles.toast} testID="building-not-found-toast">
                    <Text style={styles.toastText}>Building not found</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    topControls: {
        position: "absolute",
        top: 16,
        alignSelf: "center",
        backgroundColor: "transparent",
        borderRadius: 23,
        padding: 11,
        width: "90%",
    },
    campusToggle: {
        alignSelf: "center",
        marginTop: 10,
    },
    campusToggleNavigation: {
        marginTop: Platform.OS === "ios" ? 56 : 80,
    },
    toast: {
        position: "absolute",
        bottom: 100,
        alignSelf: "center",
        backgroundColor: "rgba(0,0,0,0.8)",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    toastText: {
        color: "#fff",
        fontSize: 14,
    },
});
