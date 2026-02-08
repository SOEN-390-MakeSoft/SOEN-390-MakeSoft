import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    Linking,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import * as Location from "expo-location";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SafeAreaView } from "react-native-safe-area-context";
import { BUILDING_POLYGONS } from "../data/buildingPolygons";
import { LOYOLA_BUILDING_POLYGONS } from "../data/buildingPolygonsLoyola";
import { BUILDING_ADDRESSES } from "../data/building-addresses";
import { BuildingResponse, getBuildingById } from "../services/api";
import CampusSwitch from "./CampusSwitch";

type LatLng = { latitude: number; longitude: number };
type BuildingRecord =
    | (typeof BUILDING_POLYGONS)[keyof typeof BUILDING_POLYGONS]
    | (typeof LOYOLA_BUILDING_POLYGONS)[keyof typeof LOYOLA_BUILDING_POLYGONS];
type Building = { id: string; name: string; address: string | null; code: string | null; polygon: readonly LatLng[] };
type Campus = "sgw" | "loyola";
type QuickPick = {
    code: string;
    label: string;
    color: string;
    colorBlind?: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    hint?: string;
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

const POLYGON_STROKE = "rgba(178, 27, 44, 0.9)";
const POLYGON_FILL = "rgba(178, 27, 44, 0.25)";
const POLYGON_FILL_SELECTED = "rgba(178, 27, 44, 0.7)";
const COLOR_BLIND_CARD_TEXT = "#4b4b4b";

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

export default function MapScreen() {
    const mapRef = useRef<MapView>(null);
    const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLocating, setIsLocating] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [activeCampus, setActiveCampus] = useState<Campus>("sgw");
    const [remoteBuilding, setRemoteBuilding] = useState<BuildingResponse | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isColorBlind, setIsColorBlind] = useState(false);
    const [isQuickPickOpen, setIsQuickPickOpen] = useState(true);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [quickPickContentHeight, setQuickPickContentHeight] = useState(0);
    const quickPickVisibleHeight = useRef(new Animated.Value(0)).current;
    const searchInputRef = useRef<TextInput>(null);
    const isSearchDisabled = true;

    const openAppSettings = async () => {
        await Linking.openSettings();
    };

    const promptToOpenSettings = () => {
        Alert.alert(
            'Location permission needed',
            'Location access is disabled. Please enable it in Settings to use "My Location".',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => void openAppSettings() },
            ]
        );
    };

    const ensureLocationPermission = async (): Promise<boolean> => {
        // Check current permission
        const current = await Location.getForegroundPermissionsAsync();

        if (current.status === "granted") return true;

        // Try requesting (OS may show popup only if allowed)
        const requested = await Location.requestForegroundPermissionsAsync();

        if (requested.status === "granted") return true;

        // If still denied, direct user to settings (this covers "Don't ask again" cases)
        promptToOpenSettings();
        return false;
    };

    const goToUserLocation = async () => {
        setIsLocating(true);
        try {
            const ok = await ensureLocationPermission();
            if (!ok) {
                setIsLocating(false);
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const { latitude, longitude } = location.coords;

            mapRef.current?.animateToRegion(
                {
                    latitude,
                    longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                },
                500
            );
        } catch (error) {
            console.error("Error getting location:", error);
            Alert.alert("Error", "Could not get your location.");
        } finally {
            setIsLocating(false);
        }
    };

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

    const buildings = useMemo<Building[]>(() => {
        const campusPolygons =
            activeCampus === "loyola" ? LOYOLA_BUILDING_POLYGONS : BUILDING_POLYGONS;

        return (Object.entries(campusPolygons) as [string, BuildingRecord][])
            .map(([id, record]) => {
                const lookup = addressLookup.get(normalizeLabel(record.name));
                const address = formatAddress(record) ?? lookup?.address ?? null;
                const code = lookup?.code ?? extractCodeFromName(record.name);
                return { id, name: record.name, address, code, polygon: record.polygon };
            })
            .filter((building) => building.polygon.length > 0);
    }, [activeCampus, addressLookup]);

    const selectedBuilding = useMemo(
        () => buildings.find((b) => b.id === selectedBuildingId) ?? null,
        [buildings, selectedBuildingId]
    );

    const quickPickMaxHeight = Math.max(0, quickPickContentHeight);

    const searchResults = useMemo(() => {
        const query = normalizeLabel(searchQuery);
        if (!query) return [];
        return buildings
            .filter((building) => {
                const name = normalizeLabel(building.name);
                const code = building.code ? normalizeLabel(building.code) : "";
                const address = building.address ? normalizeLabel(building.address) : "";
                return (
                    name.includes(query) ||
                    code.includes(query) ||
                    address.includes(query)
                );
            })
            .slice(0, 6);
    }, [buildings, searchQuery]);

    useEffect(() => {
        if (!quickPickContentHeight) return;
        if (isQuickPickOpen) {
            quickPickVisibleHeight.setValue(quickPickContentHeight);
        }
    }, [isQuickPickOpen, quickPickContentHeight, quickPickVisibleHeight]);

    useEffect(() => {
        if (!selectedBuildingId || !selectedBuilding) {
            setRemoteBuilding(null);
            setIsLoading(false);
            setErrorMessage(null);
            return;
        }

        const numericId = Number(selectedBuildingId);
        const requestId = Number.isFinite(numericId) ? numericId : null;

        if (!requestId) {
            setRemoteBuilding(null);
            setIsLoading(false);
            setErrorMessage("Invalid building ID.");
            return;
        }

        let isActive = true;
        setIsLoading(true);
        setErrorMessage(null);
        getBuildingById(requestId)
            .then((data) => {
                if (!isActive) return;
                setRemoteBuilding(data);
            })
            .catch((error) => {
                if (!isActive) return;
                setRemoteBuilding(null);
                const status = (error as { response?: { status?: number } })?.response?.status;
                if (status === 404) {
                    setErrorMessage("Building details not available.");
                } else {
                    setErrorMessage("Unable to load building details.");
                }
            })
            .finally(() => {
                if (!isActive) return;
                setIsLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, [selectedBuilding, selectedBuildingId]);

    const handleSelectBuilding = (id: string) => {
        setSelectedBuildingId(id);
        setErrorMessage(null);
        setIsLoading(false);
        setRemoteBuilding(null);
        const building = buildings.find((item) => item.id === id);
        if (building) {
            const centroid = polygonCentroid(building.polygon);
            mapRef.current?.animateToRegion(
                { ...centroid, latitudeDelta: 0.0032, longitudeDelta: 0.0032 },
                500
            );
        }
    };

    const handleSelectCampus = (campus: Campus) => {
        if (campus === activeCampus) return;
        setActiveCampus(campus);
        setSelectedBuildingId(null);
        setErrorMessage(null);
        setIsLoading(false);
        setRemoteBuilding(null);
        setSearchQuery("");
        setIsSearchFocused(false);
        searchInputRef.current?.blur();
        const region = campus === "loyola" ? LOYOLA_REGION : DEFAULT_REGION;
        mapRef.current?.animateToRegion(region, 500);
    };

    const handleSearchSubmit = () => {
        if (searchResults.length === 0) return;
        handleSelectSearchResult(searchResults[0]);
    };

    const handleSelectSearchResult = (building: Building) => {
        setSearchQuery(building.name);
        setIsSearchFocused(false);
        searchInputRef.current?.blur();
        handleSelectBuilding(building.id);
        const centroid = polygonCentroid(building.polygon);
        mapRef.current?.animateToRegion(
            { ...centroid, latitudeDelta: 0.0032, longitudeDelta: 0.0032 },
            500
        );
    };

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

    const handleCloseCard = () => {
        setSelectedBuildingId(null);
        setErrorMessage(null);
        setIsLoading(false);
        setRemoteBuilding(null);
    };

    const displayName = remoteBuilding?.name ?? selectedBuilding?.name ?? "";
    const displayAddress =
        remoteBuilding?.address ?? selectedBuilding?.address ?? "Address unavailable";
    const displayCode = remoteBuilding?.code ?? selectedBuilding?.code ?? "Unavailable";
    const displayCampus = remoteBuilding?.campus ?? (activeCampus === "loyola" ? "LOY" : "SGW");
    const elevatorValue = remoteBuilding?.hasElevator ?? null;
    const accessibilityValue = remoteBuilding?.hasAccessibility ?? null;
    const metroValue = remoteBuilding?.hasMetroAccess ?? null;
    const elevatorColor = getFeatureColor(elevatorValue);
    const accessColor = getFeatureColor(accessibilityValue);
    const metroColor = getMetroColor(metroValue);

    const polygonStroke = isColorBlind ? "rgba(37, 99, 235, 0.9)" : POLYGON_STROKE;
    const polygonFill = isColorBlind ? "rgba(37, 99, 235, 0.25)" : POLYGON_FILL;
    const polygonFillSelected = isColorBlind
        ? "rgba(37, 99, 235, 0.6)"
        : POLYGON_FILL_SELECTED;

    return (
        <View style={styles.container} testID="map-screen">
            <MapView
                ref={mapRef}
                style={styles.map}
                provider="google"
                initialRegion={DEFAULT_REGION}
                testID="campus-map"
                showsUserLocation
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
                            handleSelectCampus(campus === "SGW" ? "sgw" : "loyola")
                        }
                    />
                </View>
            </View>

            {!!selectedBuilding && (
                <View style={styles.infoOverlay} pointerEvents="box-none">
                    <Pressable style={styles.infoBackdrop} onPress={handleCloseCard} />
                    <View style={styles.infoCardWrapper} pointerEvents="box-none">
                        <View style={styles.infoCard}>
                            <Pressable
                                onPress={handleCloseCard}
                                accessibilityRole="button"
                                accessibilityLabel="Close building details"
                                style={styles.infoClose}
                            >
                                <MaterialIcons name="close" size={21} color="#b21b2c" />
                            </Pressable>

                            <Text style={styles.infoTitle} numberOfLines={2}>
                                {displayName}
                            </Text>
                            <Text style={styles.infoAddress} numberOfLines={1}>
                                {displayAddress}
                            </Text>

                            <View style={styles.infoFooterRow}>
                                <Text style={styles.infoMetaText}>
                                    {displayCampus} - {displayCode}
                                </Text>
                                <View style={styles.featureRow}>
                                    <View style={styles.featureIconWrap}>
                                        <MaterialIcons
                                            name="elevator"
                                            size={21}
                                            color={elevatorColor}
                                        />
                                    </View>
                                    <View style={styles.featureIconWrap}>
                                        <MaterialIcons
                                            name="accessible"
                                            size={21}
                                            color={accessColor}
                                        />
                                    </View>
                                    <View style={styles.featureIconWrap}>
                                        <MaterialIcons
                                            name="train"
                                            size={21}
                                            color={metroColor}
                                        />
                                    </View>
                                </View>
                            </View>

                            {isLoading && (
                                <View style={styles.loadingRow}>
                                <ActivityIndicator size="small" color="#b21b2c" />
                                    <Text style={styles.loadingText}>Loading details...</Text>
                                </View>
                            )}

                            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
                        </View>
                    </View>
                </View>
            )}

            {!isMenuOpen && (
                <View
                    style={styles.quickPickWrapper}
                    pointerEvents="auto"
                >
                    <Pressable
                        testID="location-button"
                        style={[styles.recenterButton, { opacity: isLocating ? 0.85 : 1 }]}
                        onPress={goToUserLocation}
                        disabled={isLocating}
                        accessibilityLabel="Go to my location"
                    >
                        {isLocating ? (
                            <ActivityIndicator testID="activity-indicator" size="small" color="#c41230" />
                        ) : (
                            <MaterialIcons name="my-location" size={32} color="#c41230" />
                        )}
                    </Pressable>
                    <Pressable
                        style={styles.quickPickHeader}
                        onPress={() => {
                            const nextOpen = !isQuickPickOpen;
                            const target = nextOpen ? quickPickMaxHeight : 0;
                            Animated.timing(quickPickVisibleHeight, {
                                toValue: target,
                                duration: 220,
                                useNativeDriver: false,
                            }).start();
                            setIsQuickPickOpen(nextOpen);
                        }}
                    >
                        <Text style={styles.quickPickTitle} testID="campus-label">
                            {activeCampus === "loyola" ? "LOYOLA" : "SGW"}
                        </Text>
                    </Pressable>
                    <Animated.View
                        style={[
                            styles.quickPickGridWrapper,
                            quickPickContentHeight ? { height: quickPickVisibleHeight } : null,
                        ]}
                    >
                        <View
                            style={styles.quickPickGrid}
                            onLayout={(event) => {
                                const height = event.nativeEvent.layout.height;
                                if (height > 0 && height !== quickPickContentHeight) {
                                    setQuickPickContentHeight(height);
                                }
                            }}
                        >
                            {FEATURED_BUILDINGS[activeCampus].map((pick) => {
                                const cardBackground =
                                    isColorBlind && pick.colorBlind ? pick.colorBlind : pick.color;
                                const cardTextColor = isColorBlind ? COLOR_BLIND_CARD_TEXT : "#fff";
                                return (
                                <Pressable
                                    key={pick.label}
                                    style={[styles.quickPickCard, { backgroundColor: cardBackground }]}
                                    onPress={() => handleQuickPick(pick)}
                                >
                                <MaterialIcons name={pick.icon} size={21} color={cardTextColor} />
                                <Text style={[styles.quickPickLabel, { color: cardTextColor }]} numberOfLines={3}>
                                    {pick.label}
                                </Text>
                                </Pressable>
                                );
                            })}
                        </View>
                    </Animated.View>
                </View>
            )}

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

function polygonCentroid(points: readonly LatLng[]): LatLng {
    if (points.length === 0) return DEFAULT_REGION;
    const sum = points.reduce(
        (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
        { latitude: 0, longitude: 0 }
    );
    return { latitude: sum.latitude / points.length, longitude: sum.longitude / points.length };
}

function formatAddress(record: BuildingRecord): string | null {
    const parts = [record.housenumber, record.street].filter(Boolean);
    return parts.length ? parts.join(" ") : null;
}

function normalizeLabel(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
}

function extractCodeFromName(name: string): string | null {
    const dashMatch = name.match(/^([A-Z]{1,3})\s*-/);
    if (dashMatch) return dashMatch[1];

    const parenMatch = name.match(/\(([A-Z]{1,3})\)\s*$/);
    if (parenMatch) return parenMatch[1];

    const trailingMatch = name.match(/(?:^|\s)([A-Z]{1,3})\s*$/);
    return trailingMatch ? trailingMatch[1] : null;
}

function getFeatureColor(value: boolean | null): string {
    if (value === true) return "#b21b2c";
    if (value === false) return "#b8b8b8";
    return "#d6d6d6";
}

function getMetroColor(value: boolean | null): string {
    if (value === true) return "#2f6fe4";
    if (value === false) return "#b8b8b8";
    return "#d6d6d6";
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    campusToggle: {
        alignSelf: "center",
        marginTop: 10,
    },
    topControls: {
        position: "absolute",
        top: 16,
        alignSelf: "center",
        backgroundColor: "transparent",
        borderRadius: 23,
        padding: 11,
        width: "90%",
    },
    infoOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    infoBackdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
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
    infoCardWrapper: {
        position: "absolute",
        left: 16,
        right: 16,
        top: "35%",
        alignItems: "center",
        zIndex: 2,
    },
    infoCard: {
        width: "100%",
        maxWidth: 456,
        backgroundColor: "#f7f2f2",
        borderRadius: 24,
        padding: 22,
        borderWidth: 1,
        borderColor: "#efd9d9",
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 6,
    },
    infoClose: {
        position: "absolute",
        top: 9,
        right: 9,
        padding: 4,
        zIndex: 3,
    },
    infoTitle: { fontSize: 22, fontWeight: "700", color: "#1c1c1e", paddingRight: 20 },
    infoAddress: { fontSize: 17, color: "#6b6b6b", marginTop: 4 },
    infoFooterRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 8,
    },
    infoMetaText: { fontSize: 16, fontWeight: "700", color: "#b21b2c" },
    loadingRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    loadingText: { fontSize: 16, color: "#6b6b6b", marginLeft: 8 },
    featureRow: { flexDirection: "row", columnGap: 6 },
    featureIconWrap: {
        width: 37,
        height: 37,
        borderRadius: 11,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    errorText: { fontSize: 16, color: "#b00020", marginTop: 8 },
    quickPickWrapper: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        backgroundColor: "#fff",
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        padding: 17,
        shadowColor: "#000",
        shadowOpacity: 0.14,
        shadowRadius: 8,
        elevation: 4,
        overflow: "visible",
        zIndex: 2,
    },
    quickPickHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    quickPickTitle: {
        textAlign: "center",
        fontSize: 16,
        fontWeight: "700",
        color: "#b21b2c",
        letterSpacing: 1,
    },
    quickPickGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        rowGap: 12,
        columnGap: 12,
    },
    quickPickGridWrapper: {
        width: "100%",
        overflow: "hidden",
    },
    quickPickCard: {
        width: "48%",
        borderRadius: 11,
        paddingVertical: 13,
        paddingHorizontal: 15,
        flexDirection: "row",
        alignItems: "center",
        columnGap: 11,
        shadowColor: "#000",
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 3,
        height: 83,
        justifyContent: "center",
    },
    quickPickLabel: { color: "#fff", fontSize: 14, fontWeight: "600", flex: 1, lineHeight: 18 },
    recenterButton: {
        position: "absolute",
        top: -44,
        right: 18,
        width: 65,
        height: 65,
        borderRadius: 32,
        backgroundColor: "rgba(255,255,255,0.9)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#d8d8d8",
        zIndex: 4,
        elevation: 6,
    },
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
