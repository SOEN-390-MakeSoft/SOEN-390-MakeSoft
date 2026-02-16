import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import NavigationMenu from "./NavigationMenu";
import { useSettings } from "../context/settings";

export type DirectionsErrorType = "same_origin_destination" | "missing_coordinates" | null;

interface NavigationScreenProps {
    visible: boolean;
    startLabel: string;
    destinationLabel: string;
    onClose: () => void;
    onActiveFieldChange?: (field: "start" | "destination" | null) => void;
    activeMode?: "driving" | "transit" | "walking";
    onModeChange?: (mode: "driving" | "transit" | "walking") => void;
    modeDurations?: {
        driving?: string;
        transit?: string;
        walking?: string;
    };
    tripSummary?: {
        arrivalText: string;
        distanceText: string;
        durationText: string;
        viaText: string;
    } | null;
    isLoading?: boolean;
    directionsError?: DirectionsErrorType;
    isGetDirectionsDisabled?: boolean;
}

const DIRECTIONS_ERROR_MESSAGES: Record<NonNullable<DirectionsErrorType>, string> = {
    same_origin_destination: "Origin and destination cannot be the same.",
    missing_coordinates: "Coordinates are missing for the selected name.",
};

export default function NavigationScreen({
    visible,
    startLabel,
    destinationLabel,
    onClose,
    onActiveFieldChange,
    activeMode = "driving",
    onModeChange,
    modeDurations,
    tripSummary,
    isLoading,
    directionsError = null,
    isGetDirectionsDisabled = true,
}: Readonly<NavigationScreenProps>) {
    const { colourBlindMode } = useSettings();
    const isColorBlind = colourBlindMode;
    if (!visible) return null;

    let tripTitleText: string;
    if (tripSummary)
        tripTitleText = `Arrive at ${tripSummary.arrivalText} - via ${tripSummary.viaText}`;
    else if (isLoading) tripTitleText = "Loading route...";
    else tripTitleText = "Select start and destination";

    const bottomCardColor = isColorBlind ? "#9aa7b2" : "#8e2334";
    const chipColor = isColorBlind ? "#6c7a85" : "#f6dce0";
    const chipMutedColor = isColorBlind ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.15)";
    const closeBg = isColorBlind ? "#e6eaee" : "#f6dce0";
    const closeIcon = isColorBlind ? "#4b5862" : "#7f1f2a";
    const previewBg = isColorBlind ? "#e6eaee" : "#f6dce0";
    const previewTextColor = isColorBlind ? "#4b5862" : "#7f1f2a";
    const segmentTextColor = isColorBlind ? "#4b5862" : "#7f1f2a";

    const modes: Array<{
        key: "walking" | "driving" | "transit";
        label: string;
        icon: keyof typeof MaterialIcons.glyphMap;
        duration?: string;
    }> = [
        { key: "walking", label: "Walk", icon: "directions-walk", duration: modeDurations?.walking },
        { key: "driving", label: "Car", icon: "directions-car", duration: modeDurations?.driving },
        { key: "transit", label: "Shuttle", icon: "directions-bus", duration: modeDurations?.transit },
    ];

    return (
        <View style={styles.overlay} pointerEvents="box-none">
            <NavigationMenu
                startLabel={startLabel}
                destinationLabel={destinationLabel}
                onActiveFieldChange={onActiveFieldChange}
            />

            <View style={[styles.bottomCard, { backgroundColor: bottomCardColor }]}>
                <View style={styles.bottomHeader}>
                    <View style={[styles.segmentedControl, { backgroundColor: chipMutedColor }]}>
                        {modes.map((mode) => {
                            const isActive = activeMode === mode.key;
                            return (
                                <Pressable
                                    key={mode.key}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: isActive }}
                                    accessibilityLabel={`Select ${mode.label} mode`}
                                    onPress={() => onModeChange?.(mode.key)}
                                    style={[
                                        styles.segment,
                                        isActive && [
                                            styles.segmentActive,
                                            { backgroundColor: chipColor },
                                        ],
                                    ]}
                                >
                                    <MaterialIcons
                                        name={mode.icon}
                                        size={16}
                                        color={isActive ? segmentTextColor : "#fff"}
                                    />
                                    <View style={styles.segmentTextWrap}>
                                        <Text
                                            style={[
                                                styles.segmentText,
                                                isActive && { color: segmentTextColor },
                                            ]}
                                        >
                                            {mode.label}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.segmentMeta,
                                                isActive && { color: segmentTextColor },
                                            ]}
                                        >
                                            {mode.duration ?? "--"}
                                        </Text>
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                    <Pressable
                        onPress={onClose}
                        style={[styles.closeButton, { backgroundColor: closeBg }]}
                    >
                        <MaterialIcons name="close" size={18} color={closeIcon} />
                    </Pressable>
                </View>
                <Text style={styles.tripTitle} numberOfLines={2}>
                    {tripTitleText}
                </Text>
                {tripSummary && (
                    <Text style={styles.tripMeta} numberOfLines={1}>
                        {tripSummary.distanceText} - {tripSummary.durationText}
                    </Text>
                )}
                {directionsError && (
                    <Text style={styles.errorText} testID="directions-error">
                        {DIRECTIONS_ERROR_MESSAGES[directionsError]}
                    </Text>
                )}
                <Pressable
                    style={[
                        styles.getDirectionsButton,
                        { backgroundColor: previewBg },
                        isGetDirectionsDisabled && styles.getDirectionsButtonDisabled,
                    ]}
                    disabled={isGetDirectionsDisabled}
                    accessibilityRole="button"
                    accessibilityLabel="Get directions"
                    testID="get-directions-button"
                >
                    <MaterialIcons
                        name="arrow-forward"
                        size={16}
                        color={isGetDirectionsDisabled ? "#9b9b9b" : previewTextColor}
                    />
                    <Text
                        style={[
                            styles.getDirectionsText,
                            {
                                color: isGetDirectionsDisabled ? "#9b9b9b" : previewTextColor,
                            },
                        ]}
                    >
                        Get Directions
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "space-between",
    },
    bottomCard: {
        backgroundColor: "#8e2334",
        paddingTop: 14,
        paddingHorizontal: 18,
        paddingBottom: 22,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    bottomHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    segmentedControl: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 18,
        padding: 4,
        flex: 1,
        marginRight: 12,
        columnGap: 4,
    },
    segment: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        columnGap: 6,
        paddingVertical: 6,
        borderRadius: 14,
    },
    segmentActive: {
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    segmentTextWrap: { alignItems: "center" },
    segmentText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    segmentMeta: { color: "#fff", fontSize: 11, fontWeight: "600" },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#f6dce0",
        alignItems: "center",
        justifyContent: "center",
        position: "absolute",
        right: 0,
        top: 0,
        zIndex: 2,
        elevation: 3,
    },
    tripTitle: {
        marginTop: 12,
        fontSize: 16,
        color: "#fff",
        fontWeight: "700",
    },
    tripMeta: { marginTop: 4, fontSize: 14, color: "#f3d7dc" },
    errorText: {
        marginTop: 8,
        fontSize: 14,
        color: "#fff",
        textAlign: "center",
    },
    getDirectionsButton: {
        marginTop: 14,
        alignSelf: "center",
        flexDirection: "row",
        alignItems: "center",
        columnGap: 6,
        backgroundColor: "#f6dce0",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 18,
    },
    getDirectionsButtonDisabled: {
        opacity: 0.6,
    },
    getDirectionsText: { fontSize: 14, fontWeight: "700" },
});
