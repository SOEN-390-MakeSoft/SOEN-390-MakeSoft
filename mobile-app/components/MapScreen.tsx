import React, { useEffect, useRef, useState, useMemo } from "react";
import { View, Pressable, ActivityIndicator, Alert, Linking, StyleSheet, Modal } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { MaterialIcons } from "@expo/vector-icons";
import { Text, YStack, useTheme } from "tamagui";
import { BUILDING_POLYGONS } from "../data/buildingPolygons";
import { BUILDING_ADDRESSES } from "../data/building-addresses";
import { LOYOLA_BUILDING_POLYGONS } from "../data/buildingPolygonsLoyola";


type LatLng = { latitude: number; longitude: number };
type BuildingRecord =
    | (typeof BUILDING_POLYGONS)[keyof typeof BUILDING_POLYGONS]
    | (typeof LOYOLA_BUILDING_POLYGONS)[keyof typeof LOYOLA_BUILDING_POLYGONS];

export default function MapScreen() {
    const mapRef = useRef<MapView>(null);
    const [isLocating, setIsLocating] = useState(false);
    const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

    // store user location
    const [userLocation, setUserLocation] = useState<LatLng | null>(null);
    const theme = useTheme();

    const polygonRed = theme.cred?.get() ?? "#912338";
    const polygonFill = toRgba(polygonRed, 0.3);
    const polygonFillSelected = toRgba(polygonRed, 0.90);

    // --- Building logic ---
    const handleSelectBuilding = (id: string) => {
        setSelectedBuildingId(id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    };

    const addressLookup = useMemo(() => {
        const lookup = new Map<string, { name: string; address: string }>();
        for (const entry of BUILDING_ADDRESSES) {
            lookup.set(normalizeLabel(entry.name), {
                name: entry.name,
                address: entry.address,
            });
            if (entry.aliases) {
                for (const alias of entry.aliases) {
                    lookup.set(normalizeLabel(alias), {
                        name: entry.name,
                        address: entry.address,
                    });
                }
            }
        }
        return lookup;
    }, []);

    const buildings = useMemo(() => {
        const allPolygons = {
            ...BUILDING_POLYGONS,
            ...LOYOLA_BUILDING_POLYGONS,
        };

        return (Object.entries(allPolygons) as [string, BuildingRecord][])
            .map(([id, record]) => {
                const lookup = addressLookup.get(normalizeLabel(record.name));
                const address = formatAddress(record) ?? lookup?.address ?? null;
                const name = lookup?.name ?? record.name;
                return { id, name, address, polygon: record.polygon };
            })
            .filter((building) => building.polygon.length > 0);
    }, [addressLookup]);

    const selectedBuilding = useMemo(
        () => buildings.find((b) => b.id === selectedBuildingId) ?? null,
        [buildings, selectedBuildingId]
    );

    // CHECK IF USER IS INSIDE ANY CONCORDIA BUILDING
    const isUserInsideConcordia = useMemo(() => {
        if (!userLocation) return false;
        return buildings.some((b) =>
            isPointInPolygon(userLocation, b.polygon)
        );
    }, [userLocation, buildings]);

    // --- Location logic ---
    const openAppSettings = async () => {
        await Linking.openSettings();
    };

    const promptToOpenSettings = () => {
        Alert.alert(
            "Location permission needed",
            "Location access is disabled. Please enable it in Settings to use “My Location”.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Open Settings", onPress: openAppSettings },
            ]
        );
    };

    const ensureLocationPermission = async (): Promise<boolean> => {
        const current = await Location.getForegroundPermissionsAsync();
        if (current.status === "granted") return true;

        const requested = await Location.requestForegroundPermissionsAsync();
        if (requested.status === "granted") return true;

        promptToOpenSettings();
        return false;
    };

    useEffect(() => {
        (async () => {
            try {
                await ensureLocationPermission();
            } catch (e) {
                console.log("Permission check error:", e);
            }
        })();
    }, []);

    const goToUserLocation = async () => {
        setIsLocating(true);
        try {
            const ok = await ensureLocationPermission();
            if (!ok) return;

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const currentPoint = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };

            // const currentPoint = { // FOR TESTING. THIS ASSUMES THE USER IS IN CONCORDIA.
            //     latitude: 45.497092,
            //     longitude: -73.578800,
            // };
            
            
            // const currentPoint = { // FOR TESTING. THIS ASSUMES THE USER IS IN LOYOLA.
            //     latitude: 45.456180572509766,
            //     longitude: -73.6386489868164,
            // };

            setUserLocation(currentPoint);

            mapRef.current?.animateToRegion(
                {
                    latitude: currentPoint.latitude,
                    longitude: currentPoint.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                },
                500
            );

            // Auto-select the building if the user is inside
            const buildingInside = buildings.find((b) =>
                isPointInPolygon(currentPoint, b.polygon)
            );

            if (buildingInside) {
                setSelectedBuildingId(buildingInside.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            } else {
                setSelectedBuildingId(null);
            }

        } catch (e) {
            console.error("Error getting location:", e);
            Alert.alert("Error", "Could not get your location.");
        } finally {
            setIsLocating(false);
        }
    };

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                provider="google"
                initialRegion={{
                    latitude: 45.4973,
                    longitude: -73.5789,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }}
                showsUserLocation={!!userLocation && !isUserInsideConcordia}
            // (Original google map location blue icon)
            >
                {buildings.map((building) => {
                    const centroid = polygonCentroid(building.polygon);
                    const isSelected = building.id === selectedBuildingId;
                    return (
                        <React.Fragment key={building.id}>
                            <Polygon
                                coordinates={[...building.polygon]}
                                strokeColor={polygonRed}
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

                {/* Custom user location icon, so that it can be the top element on maps */}
                {userLocation && isUserInsideConcordia && (
                    <Marker coordinate={userLocation} zIndex={1000}
                        anchor={{ x: 0.5, y: 0.5 }}
                    >
                        <View
                            style={{
                                width: 20,
                                height: 20,
                                borderRadius: 10,
                                backgroundColor: "#4A90E2",
                                borderWidth: 3,
                                borderColor: "#FFFFFF",
                                shadowColor: "#000",
                                shadowOpacity: 0.35,
                                shadowRadius: 4,
                                elevation: 6,
                            }}
                        />
                    </Marker>
                )}
            </MapView>

            <Pressable
                onPress={goToUserLocation}
                disabled={isLocating}
                style={{
                    position: "absolute",
                    bottom: 20,
                    right: 20,
                    backgroundColor: "#ffffff",
                    borderRadius: 50,
                    width: 52,
                    height: 52,
                    justifyContent: "center",
                    alignItems: "center",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 3,
                    elevation: 5,
                    opacity: isLocating ? 0.85 : 1,
                }}
            >
                {isLocating ? (
                    <ActivityIndicator size="small" color="#c41230" />
                ) : (
                    <MaterialIcons name="my-location" size={24} color="#c41230" />
                )}
            </Pressable>

            
            <Modal
                transparent
                visible={!!selectedBuilding}
                animationType="fade"
                onRequestClose={() => setSelectedBuildingId(null)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setSelectedBuildingId(null)}>
                    <YStack style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{selectedBuilding?.name}</Text>
                        <Text style={styles.modalAddress}>
                            {selectedBuilding?.address ?? "Address unavailable"}
                        </Text>
                    </YStack>
                </Pressable>
            </Modal>
        </View>
    );
}

// --- Helper functions ---

function isPointInPolygon(
    point: LatLng,
    polygon: ReadonlyArray<LatLng>
): boolean {
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].latitude;
        const yi = polygon[i].longitude;
        const xj = polygon[j].latitude;
        const yj = polygon[j].longitude;

        const intersect =
            yi > point.longitude !== yj > point.longitude &&
            point.latitude <
            ((xj - xi) * (point.longitude - yi)) / (yj - yi) + xi;

        if (intersect) inside = !inside;
    }

    return inside;
}

function polygonCentroid(points: ReadonlyArray<LatLng>): LatLng {
    if (points.length === 0) return { latitude: 45.4973, longitude: -73.5789 };
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
    return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toRgba(color: string, alpha: number): string {
    if (!color.startsWith("#")) return color;
    const hex = color.replace("#", "");
    const fullHex = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    if (fullHex.length !== 6) return color;
    const red = parseInt(fullHex.slice(0, 2), 16);
    const green = parseInt(fullHex.slice(2, 4), 16);
    const blue = parseInt(fullHex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.35)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    modalContent: {
        width: "100%",
        maxWidth: 320,
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8, color: "#1c1c1e" },
    modalAddress: { fontSize: 14, color: "#5a5a5a", marginBottom: 16 },
});
