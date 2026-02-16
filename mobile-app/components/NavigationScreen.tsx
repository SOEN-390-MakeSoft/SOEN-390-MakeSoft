import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import type { NavigationStep } from "../hooks/useNavigationBetweenBuildings";
import NavigationMenu from "./NavigationMenu";
import { useSettings } from "../context/settings";

export type DirectionsErrorType = "same_origin_destination" | "missing_coordinates" | null;

type TransportMode = 'driving' | 'walking';

interface NavigationScreenProps {
    visible: boolean;
    startLabel: string;
    destinationLabel: string;
    onClose: () => void;
    onActiveFieldChange?: (field: "start" | "destination" | null) => void;
    modeDurations?: {
        driving?: string;
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
    selectedTransportMode?: TransportMode;
    onTransportModeChange?: (mode: TransportMode) => void;
    navigationSteps?: NavigationStep[];
}

const DIRECTIONS_ERROR_MESSAGES: Record<NonNullable<DirectionsErrorType>, string> = {
    same_origin_destination: "Origin and destination cannot be the same.",
    missing_coordinates: "Coordinates are missing for the selected name.",
};

const MANEUVER_ICONS: Record<string, keyof typeof MaterialIcons.glyphMap> = {
    "turn-left": "turn-left",
    "turn-right": "turn-right",
    "turn-slight-left": "turn-slight-left",
    "turn-slight-right": "turn-slight-right",
    "turn-sharp-left": "turn-left",
    "turn-sharp-right": "turn-right",
    "uturn-left": "u-turn-left",
    "uturn-right": "u-turn-right",
    "merge": "merge",
    "fork-left": "fork-left",
    "fork-right": "fork-right",
    "ramp-left": "turn-slight-left",
    "ramp-right": "turn-slight-right",
    "roundabout-left": "roundabout-left",
    "roundabout-right": "roundabout-right",
    "straight": "straight",
};

function getManeuverIcon(maneuver?: string): keyof typeof MaterialIcons.glyphMap {
    if (!maneuver) return "straight";
    return MANEUVER_ICONS[maneuver] ?? "straight";
}

function ModeChip({
    mode,
    icon,
    label,
    isSelected,
    chipColor,
    chipMutedColor,
    onPress,
}: Readonly<{
    mode: TransportMode;
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
    isSelected: boolean;
    chipColor: string;
    chipMutedColor: string;
    onPress: (mode: TransportMode) => void;
}>) {
    return (
        <Pressable
            onPress={() => onPress(mode)}
            testID={`mode-chip-${mode}`}
            style={
                isSelected
                    ? [styles.modeChip, { backgroundColor: chipColor }]
                    : [styles.modeChipMuted, { backgroundColor: chipMutedColor }]
            }
        >
            <MaterialIcons name={icon} size={18} color="#fff" />
            <Text style={styles.modeText}>{label}</Text>
        </Pressable>
    );
}

export default function NavigationScreen({
    visible,
    startLabel,
    destinationLabel,
    onClose,
    onActiveFieldChange,
    modeDurations,
    tripSummary,
    isLoading,
    directionsError = null,
    isGetDirectionsDisabled = true,
    selectedTransportMode = 'driving',
    onTransportModeChange,
    navigationSteps = [],
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
    const chipColor = isColorBlind ? "#6c7a85" : "#9a2d3a";
    const chipMutedColor = isColorBlind ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.15)";
    const closeBg = isColorBlind ? "#e6eaee" : "#f6dce0";
    const closeIcon = isColorBlind ? "#4b5862" : "#7f1f2a";
    const previewBg = isColorBlind ? "#e6eaee" : "#f6dce0";
    const previewTextColor = isColorBlind ? "#4b5862" : "#7f1f2a";

    return (
        <View style={styles.overlay} pointerEvents="box-none">
            <NavigationMenu
                startLabel={startLabel}
                destinationLabel={destinationLabel}
                onActiveFieldChange={onActiveFieldChange}
            />

            <View style={[styles.bottomCard, { backgroundColor: bottomCardColor }]}>
                <View style={styles.bottomHeader}>
                    <View style={styles.tripModeRow}>
                        <ModeChip
                            mode="driving"
                            icon="directions-car"
                            label={modeDurations?.driving ?? "--"}
                            isSelected={selectedTransportMode === 'driving'}
                            chipColor={chipColor}
                            chipMutedColor={chipMutedColor}
                            onPress={onTransportModeChange ?? (() => {})}
                        />
                        <ModeChip
                            mode="walking"
                            icon="directions-walk"
                            label={modeDurations?.walking ?? "--"}
                            isSelected={selectedTransportMode === 'walking'}
                            chipColor={chipColor}
                            chipMutedColor={chipMutedColor}
                            onPress={onTransportModeChange ?? (() => {})}
                        />
                        <View testID="mode-chip-shuttle-disabled" style={[styles.modeChipDisabled, { backgroundColor: chipMutedColor }]}>
                            <MaterialIcons name="directions-bus" size={18} color="rgba(255,255,255,0.4)" />
                        </View>
                    </View>
                    <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: closeBg }]}>
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

                {navigationSteps.length > 0 && (
                    <ScrollView
                        style={styles.stepsContainer}
                        testID="navigation-steps-list"
                        nestedScrollEnabled
                    >
                        {navigationSteps.map((step, index) => (
                            <View key={`step-${step.instruction.slice(0, 30)}-${step.distanceText}`} style={styles.stepRow} testID={`nav-step-${index}`}>
                                <View style={styles.stepIconCol}>
                                    <MaterialIcons
                                        name={getManeuverIcon(step.maneuver)}
                                        size={20}
                                        color="#fff"
                                    />
                                </View>
                                <View style={styles.stepContent}>
                                    <Text style={styles.stepInstruction} numberOfLines={3}>
                                        {step.instruction}
                                    </Text>
                                    <Text style={styles.stepMeta}>
                                        {step.distanceText}{step.durationText ? ` · ${step.durationText}` : ""}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )}
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
    tripModeRow: { flexDirection: "row", columnGap: 10 },
    modeChip: {
        flexDirection: "row",
        alignItems: "center",
        columnGap: 6,
        backgroundColor: "#9a2d3a",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    modeChipMuted: {
        flexDirection: "row",
        alignItems: "center",
        columnGap: 6,
        backgroundColor: "rgba(255,255,255,0.15)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    modeChipDisabled: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.08)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        opacity: 0.45,
    },
    modeText: { color: "#fff", fontSize: 13, fontWeight: "600" },
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
    stepsContainer: {
        marginTop: 14,
        maxHeight: 220,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(255,255,255,0.2)",
        paddingTop: 10,
    },
    stepRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 12,
    },
    stepIconCol: {
        width: 32,
        alignItems: "center",
        paddingTop: 2,
    },
    stepContent: {
        flex: 1,
    },
    stepInstruction: {
        fontSize: 14,
        color: "#fff",
        fontWeight: "500",
    },
    stepMeta: {
        fontSize: 12,
        color: "rgba(255,255,255,0.65)",
        marginTop: 2,
    },
});
