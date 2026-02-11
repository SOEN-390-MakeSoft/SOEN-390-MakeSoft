import React, { useRef } from "react";
import {
    Image,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SafeAreaView } from "react-native-safe-area-context";
import CampusSwitch from "./CampusSwitch";
import BuildingInfoCard from "./BuildingInfoCard";
import QuickPickPanel from "./QuickPickPanel";
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

const isSearchDisabled = true;

export default function MapScreen() {
    const mapRef = useRef<MapView>(null);

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
        isColorBlind,
        setIsColorBlind,
        isQuickPickOpen,
        quickPickContentHeight,
        setQuickPickContentHeight,
        quickPickVisibleHeight,
        quickPickMaxHeight,
        handleToggleQuickPick,
    } = useMapUI();
    const { isLocating, goToUserLocation } = useUserLocation(
        mapRef as React.RefObject<{ animateToRegion: (region: any, duration: number) => void }>
    );

    // Get selected building for info card
    const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId) ?? null;

    // Polygon colors for color blind mode
    const polygonStroke = isColorBlind ? "rgba(37, 99, 235, 0.9)" : POLYGON_STROKE;
    const polygonFill = isColorBlind ? "rgba(37, 99, 235, 0.25)" : POLYGON_FILL;
    const polygonFillSelected = isColorBlind
        ? "rgba(37, 99, 235, 0.6)"
        : POLYGON_FILL_SELECTED;

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
            >
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
                                onPress={() => handleSelectBuilding(building.id)}
                            />
                            <Marker
                                coordinate={centroid}
                                onPress={() => handleSelectBuilding(building.id)}
                                anchor={{ x: 0.5, y: 0.5 }}
                                opacity={0}
                            />
                        </React.Fragment>
                    );
                })}
            </MapView>

            {/* Top Controls: Search, Menu, Brand Badge */}
            <View style={styles.topControls} pointerEvents="box-none">
                <View style={styles.searchRow}>
                    <Pressable
                        style={styles.iconButton}
                        accessibilityLabel="Open menu"
                        onPress={() => setIsMenuOpen(true)}
                    >
                        <MaterialIcons name="menu" size={47} color="#b21b2c" />
                    </Pressable>
                    <View style={styles.searchInputWrap}>
                        <MaterialIcons name="search" size={19} color="#8c8c8c" />
                        <TextInput
                            ref={searchInputRef}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search"
                            placeholderTextColor="#9a9a9a"
                            style={styles.searchInput}
                            returnKeyType="search"
                            inputAccessoryViewID="searchBar"
                            onSubmitEditing={handleSearchSubmit}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setIsSearchFocused(false)}
                            editable={!isSearchDisabled}
                            showSoftInputOnFocus={!isSearchDisabled}
                        />
                    </View>
                    <View style={styles.brandBadge}>
                        <Image
                            source={require("../assets/images/Concordia_icon.png")}
                            style={styles.brandBadgeImage}
                            resizeMode="contain"
                        />
                    </View>
                </View>
                {!isSearchDisabled && isSearchFocused && searchResults.length > 0 && (
                    <View style={styles.searchResults}>
                        {searchResults.map((result, index) => (
                            <Pressable
                                key={`${result.id}-${result.name}`}
                                style={[
                                    styles.searchResultItem,
                                    index < searchResults.length - 1 && styles.searchResultDivider,
                                ]}
                                onPress={() => handleSelectSearchResult(result)}
                            >
                                <Text style={styles.searchResultTitle} numberOfLines={1}>
                                    {result.name}
                                </Text>
                                <Text style={styles.searchResultMeta} numberOfLines={1}>
                                    {result.code ? `${result.code} · ` : ""}{result.address ?? "Address unavailable"}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                )}
                <View style={styles.campusToggle}>
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
            />

            {/* Quick Pick Panel and Location Button */}
            {!isMenuOpen && (
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

            {/* Menu Overlay */}
            {isMenuOpen && (
                <View style={styles.menuOverlay}>
                    <SafeAreaView style={styles.menuScreen}>
                        <View style={styles.menuHeader}>
                            <Pressable
                                onPress={() => setIsMenuOpen(false)}
                                style={styles.menuBack}
                            >
                                <MaterialIcons name="chevron-left" size={43} color="#b21b2c" />
                            </Pressable>
                            <Text style={styles.menuTitle}>Menu</Text>
                            <View style={styles.menuSpacer} />
                        </View>
                        <Text style={styles.menuSubtitle}>Customize your map experience</Text>
                        <View style={styles.menuRow}>
                            <View style={styles.menuRowLeft}>
                                <MaterialIcons name="remove-red-eye" size={21} color="#b21b2c" />
                                <Text style={styles.menuRowText}>Color-blind mode</Text>
                            </View>
                            <Switch
                                value={isColorBlind}
                                onValueChange={setIsColorBlind}
                                trackColor={{ false: "#ddd", true: "#f3b6bf" }}
                                thumbColor={isColorBlind ? "#b21b2c" : "#fff"}
                            />
                        </View>
                    </SafeAreaView>
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
    searchRow: { flexDirection: "row", alignItems: "center", columnGap: 11 },
    iconButton: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
    },
    searchInputWrap: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.85)",
        borderRadius: 26,
        paddingHorizontal: 13,
        height: 52,
        borderWidth: 1,
        borderColor: "#b21b2c",
    },
    searchInput: { flex: 1, fontSize: 17, color: "#2b2b2b", marginLeft: 9 },
    searchResults: {
        marginTop: 10,
        backgroundColor: "rgba(255,255,255,0.96)",
        borderRadius: 17,
        borderWidth: 1,
        borderColor: "#d8d8d8",
        overflow: "hidden",
    },
    searchResultItem: {
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    searchResultDivider: {
        borderBottomWidth: 1,
        borderBottomColor: "#ececec",
    },
    searchResultTitle: { fontSize: 16, fontWeight: "600", color: "#2b2b2b" },
    searchResultMeta: { fontSize: 14, color: "#6b6b6b", marginTop: 2 },
    brandBadge: {
        width: 55,
        height: 55,
        borderRadius: 27.5,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    brandBadgeImage: { width: 40, height: 40 },
    menuOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.15)",
        justifyContent: "flex-start",
    },
    menuScreen: {
        flex: 1,
        backgroundColor: "#f9f1f4",
        paddingHorizontal: 26,
        paddingTop: 14,
    },
    menuHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 12,
        marginBottom: 19,
    },
    menuBack: {
        width: 53,
        height: 53,
        alignItems: "center",
        justifyContent: "center",
    },
    menuTitle: { fontSize: 24, fontWeight: "700", color: "#1c1c1e" },
    menuSpacer: { width: 53 },
    menuSubtitle: { fontSize: 17, color: "#b9a9ad", marginBottom: 22 },
    menuRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#fff",
        borderRadius: 22,
        padding: 19,
    },
    menuRowLeft: { flexDirection: "row", alignItems: "center", columnGap: 10 },
    menuRowText: { fontSize: 19, color: "#4a4a4a", fontWeight: "600" },
});
