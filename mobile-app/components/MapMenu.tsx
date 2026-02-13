import React from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTheme } from "tamagui";
import { useSettings } from "../context/settings";

interface MapMenuProps {
    visible: boolean;
    onClose: () => void;
    fullScreen?: boolean;
}

export default function MapMenu({ visible, onClose, fullScreen = false }: MapMenuProps) {
    const { colourBlindMode, setColourBlindMode } = useSettings();
    const theme = useTheme();
    const brandRed = theme?.cred?.get?.() ?? "#b21b2c";

    if (!visible) return null;

    const content = (
        <SafeAreaView style={styles.menuScreen}>
            <View style={styles.menuHeader}>
                <Pressable onPress={onClose} style={styles.menuBack}>
                    <MaterialIcons name="chevron-left" size={43} color={brandRed} />
                </Pressable>
                <Text style={styles.menuTitle}>Menu</Text>
                <View style={styles.menuSpacer} />
            </View>
            <Text style={styles.menuSubtitle}>Customize your map experience</Text>
            <View style={styles.menuRow}>
                <View style={styles.menuRowLeft}>
                    <MaterialIcons name="remove-red-eye" size={21} color={brandRed} />
                    <Text style={styles.menuRowText}>Color-blind mode</Text>
                </View>
                <Switch
                    value={colourBlindMode}
                    onValueChange={setColourBlindMode}
                    trackColor={{ false: "#ddd", true: "#f3b6bf" }}
                    thumbColor={colourBlindMode ? brandRed : "#fff"}
                />
            </View>
        </SafeAreaView>
    );

    if (fullScreen) {
        return (
            <Modal
                visible
                animationType="fade"
                transparent={false}
                presentationStyle="fullScreen"
                onRequestClose={onClose}
            >
                {content}
            </Modal>
        );
    }

    return <View style={styles.menuOverlay}>{content}</View>;
}

const styles = StyleSheet.create({
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
