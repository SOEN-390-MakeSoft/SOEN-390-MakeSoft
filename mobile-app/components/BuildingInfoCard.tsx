import React from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTheme } from "tamagui";
import { BuildingResponse } from "../services/api";
import { getFeatureColor, getMetroColor } from "../utils/colorUtils";
import DirectionButton from "./DirectionButton";

type Building = {
    id: string;
    name: string;
    address: string | null;
    code: string | null;
    polygon: readonly { latitude: number; longitude: number }[];
};

interface BuildingInfoCardProps {
    selectedBuilding: Building | null;
    remoteBuilding: BuildingResponse | null;
    isLoading: boolean;
    errorMessage: string | null;
    onClose: () => void;
    isColorBlind: boolean;
    onDirections?: () => void;
}

/**
 * Card component displaying building information overlay
 * Shows building details fetched from API or local data
 */
export default function BuildingInfoCard({
    selectedBuilding,
    remoteBuilding,
    isLoading,
    errorMessage,
    onClose,
    isColorBlind,
    onDirections,
}: Readonly<BuildingInfoCardProps>) {
    const theme = useTheme();

    if (!selectedBuilding) return null;

    const displayName = remoteBuilding?.name ?? selectedBuilding?.name ?? "";
    const displayAddress =
        remoteBuilding?.address ?? selectedBuilding?.address ?? "Address unavailable";
    const displayCode = remoteBuilding?.code ?? selectedBuilding?.code ?? "Unavailable";
    const displayCampus = remoteBuilding?.campus ?? "Unknown";
    const elevatorValue = remoteBuilding?.hasElevator ?? null;
    const accessibilityValue = remoteBuilding?.hasAccessibility ?? null;
    const metroValue = remoteBuilding?.hasMetroAccess ?? null;

    const elevatorColor = getFeatureColor(elevatorValue);
    const accessColor = getFeatureColor(accessibilityValue);
    const metroColor = getMetroColor(metroValue);
    const brandRed = theme.cred?.val ?? "#b21b2c";
    const colourBlindPrimary = theme.colourBlind2?.val ?? brandRed;
    const colourBlindSecondary = theme.colourBlind1?.val ?? "#B3D4FF";
    const accentColor = isColorBlind ? colourBlindPrimary : brandRed;
    const directionTextColor = isColorBlind ? colourBlindPrimary : "#fff";
    const directionButtonColor = isColorBlind ? colourBlindSecondary : brandRed;

    return (
        <View style={styles.infoOverlay} pointerEvents="box-none">
            <Pressable style={styles.infoBackdrop} onPress={onClose} />
            <View style={styles.infoCardWrapper} pointerEvents="box-none">
                <View style={styles.infoCard}>
                    <Pressable
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Close building details"
                        style={styles.infoClose}
                    >
                        <MaterialIcons name="close" size={21} color={accentColor} />
                    </Pressable>

                    <Text style={styles.infoTitle} numberOfLines={2}>
                        {displayName}
                    </Text>
                    <Text style={styles.infoAddress} numberOfLines={1}>
                        {displayAddress}
                    </Text>

                    <View style={styles.infoFooterRow}>
                        <Text style={[styles.infoMetaText, { color: accentColor }] }>
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

                    <DirectionButton
                        onPress={onDirections}
                        disabled={!onDirections}
                        backgroundColor={directionButtonColor}
                        textColor={directionTextColor}
                        iconColor={directionTextColor}
                    />

                    {isLoading && (
                        <View style={styles.loadingRow}>
                            <ActivityIndicator size="small" color={accentColor} />
                            <Text style={styles.loadingText}>Loading details...</Text>
                        </View>
                    )}

                    {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    infoOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    infoBackdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1,
    },
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
    infoMetaText: { fontSize: 16, fontWeight: "700" },
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
});
