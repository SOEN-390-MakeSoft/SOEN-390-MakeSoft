import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import NavigationMenu from "./NavigationMenu";
import { useSettings } from "../context/settings";

interface NavigationScreenProps {
    visible: boolean;
    startLabel: string;
    destinationLabel: string;
    onClose: () => void;
}

export default function NavigationScreen({
    visible,
    startLabel,
    destinationLabel,
    onClose,
}: NavigationScreenProps) {
    if (!visible) return null;
    const { colourBlindMode } = useSettings();
    const isColorBlind = colourBlindMode;
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
            />

            <View style={[styles.bottomCard, { backgroundColor: bottomCardColor }]}>
                <View style={styles.bottomHeader}>
                    <View style={styles.tripModeRow}>
                        <View style={[styles.modeChip, { backgroundColor: chipColor }]}>
                            <MaterialIcons name="directions-car" size={18} color="#fff" />
                            <Text style={styles.modeText}>1 min</Text>
                        </View>
                        <View style={[styles.modeChipMuted, { backgroundColor: chipMutedColor }]}>
                            <MaterialIcons name="directions-bus" size={18} color="#fff" />
                            <Text style={styles.modeText}>6 min</Text>
                        </View>
                        <View style={[styles.modeChipMuted, { backgroundColor: chipMutedColor }]}>
                            <MaterialIcons name="directions-walk" size={18} color="#fff" />
                            <Text style={styles.modeText}>2 min</Text>
                        </View>
                    </View>
                    <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: closeBg }]}>
                        <MaterialIcons name="close" size={18} color={closeIcon} />
                    </Pressable>
                </View>
                <Text style={styles.tripTitle} numberOfLines={2}>
                    Arrive at 9:44 PM - via Rue Mackay
                </Text>
                <Text style={styles.tripMeta} numberOfLines={1}>
                    210 m - Mostly flat road
                </Text>
                <Pressable style={[styles.previewButton, { backgroundColor: previewBg }]}>
                    <MaterialIcons name="arrow-forward" size={16} color={previewTextColor} />
                    <Text style={[styles.previewText, { color: previewTextColor }]}>Preview</Text>
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
    modeText: { color: "#fff", fontSize: 13, fontWeight: "600" },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#f6dce0",
        alignItems: "center",
        justifyContent: "center",
    },
    tripTitle: {
        marginTop: 12,
        fontSize: 16,
        color: "#fff",
        fontWeight: "700",
    },
    tripMeta: { marginTop: 4, fontSize: 14, color: "#f3d7dc" },
    previewButton: {
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
    previewText: { color: "#7f1f2a", fontSize: 14, fontWeight: "700" },
});
