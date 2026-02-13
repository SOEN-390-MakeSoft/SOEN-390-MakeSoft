import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { BUILDING_ADDRESSES } from "../data/building-addresses";
import { LOYOLA_BUILDING_POLYGONS } from "../data/buildingPolygonsLoyola";
import { extractCodeFromName, normalizeLabel } from "../utils/stringUtils";
import MapMenu from "./MapMenu";
import { useSettings } from "../context/settings";

type ActiveField = "start" | "destination" | null;

interface NavigationMenuProps {
    startLabel?: string;
    destinationLabel?: string;
}

type SearchEntry = {
    name: string;
    code: string | null;
    address: string | null;
    aliases?: string[];
};

const buildLabel = (name: string, code: string | null) => {
    if (!code) return name;
    return name.includes(`(${code})`) ? name : `${name} (${code})`;
};

export default function NavigationMenu({
    startLabel = "Your location",
    destinationLabel = "",
}: NavigationMenuProps) {
    const { colourBlindMode } = useSettings();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeField, setActiveField] = useState<ActiveField>(null);
    const [startQuery, setStartQuery] = useState(startLabel);
    const [destinationQuery, setDestinationQuery] = useState(destinationLabel);
    const isColorBlind = colourBlindMode;
    const topBarColor = isColorBlind ? "#9aa7b2" : "#8e2334";
    const routeCardColor = isColorBlind ? "#e6eaee" : "#f6dce0";
    const menuIconColor = isColorBlind ? "#b21b2c" : "#e8c9cf";
    const destinationIconColor = isColorBlind ? "#c1464f" : "#c1464f";
    const clearIconColor = isColorBlind ? "#b21b2c" : "#8e2334";
    const dividerColor = isColorBlind ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.15)";

    useEffect(() => {
        setStartQuery(startLabel);
    }, [startLabel]);

    useEffect(() => {
        setDestinationQuery(destinationLabel);
    }, [destinationLabel]);

    const activeQuery = activeField === "start" ? startQuery : destinationQuery;
    const buildingOptions = useMemo<SearchEntry[]>(() => {
        const sgw = BUILDING_ADDRESSES.map((entry) => ({
            name: entry.name,
            code: entry.code,
            address: entry.address,
            aliases: entry.aliases,
        }));
        const loyola = Object.values(LOYOLA_BUILDING_POLYGONS).map((entry) => ({
            name: entry.name,
            code: extractCodeFromName(entry.name),
            address: null,
        }));
        return [...sgw, ...loyola];
    }, []);

    const results = useMemo(() => {
        const query = normalizeLabel(activeQuery);
        if (!query) return [];
        return buildingOptions.filter((entry) => {
            const name = normalizeLabel(entry.name);
            const code = entry.code ? normalizeLabel(entry.code) : "";
            const address = entry.address ? normalizeLabel(entry.address) : "";
            const aliases = entry.aliases?.some((alias) =>
                normalizeLabel(alias).includes(query)
            );
            return (
                name.includes(query) ||
                code.includes(query) ||
                address.includes(query) ||
                aliases === true
            );
        }).slice(0, 6);
    }, [activeQuery, buildingOptions]);

    const handleSelect = (entry: SearchEntry) => {
        const label = buildLabel(entry.name, entry.code);
        if (activeField === "start") {
            setStartQuery(label);
        } else if (activeField === "destination") {
            setDestinationQuery(label);
        }
        setActiveField(null);
    };

    const renderInputRow = (
        field: ActiveField,
        value: string,
        setValue: (text: string) => void,
        icon: keyof typeof MaterialIcons.glyphMap,
        iconColor: string,
        placeholder: string,
        clearLabel: string
    ) => (
        <View style={styles.routeRow}>
            <MaterialIcons name={icon} size={20} color={iconColor} />
            <View style={styles.inputWrap}>
                <TextInput
                    value={value}
                    onChangeText={setValue}
                    onFocus={() => setActiveField(field)}
                    placeholder={placeholder}
                    placeholderTextColor="#6b6b6b"
                    style={styles.routeInput}
                />
                {!!value && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={clearLabel}
                        onPress={() => setValue("")}
                        style={styles.clearButton}
                    >
                        <MaterialIcons name="close" size={16} color={clearIconColor} />
                    </Pressable>
                )}
            </View>
        </View>
    );

    return (
        <View style={[styles.topBar, { backgroundColor: topBarColor }]}>
            <Pressable
                style={styles.menuIcon}
                accessibilityRole="button"
                accessibilityLabel="Open menu"
                onPress={() => setIsMenuOpen(true)}
            >
                <MaterialIcons name="menu" size={28} color={menuIconColor} />
            </Pressable>

            <View style={styles.searchColumn}>
                <View style={[styles.routeCard, { backgroundColor: routeCardColor }]}>
                    {renderInputRow(
                        "start",
                        startQuery,
                        setStartQuery,
                        "radio-button-unchecked",
                        "#1c1c1e",
                        "Start",
                        "Clear start"
                    )}
                    <View style={[styles.routeDivider, { backgroundColor: dividerColor }]} />
                    {renderInputRow(
                        "destination",
                        destinationQuery,
                        setDestinationQuery,
                        "location-on",
                        destinationIconColor,
                        "Destination",
                        "Clear destination"
                    )}
                </View>

                {activeField && results.length > 0 && (
                    <View style={styles.resultsCard}>
                        {results.map((entry, index) => {
                            const label = buildLabel(entry.name, entry.code);
                            return (
                                <Pressable
                                    key={`${entry.code}-${index}`}
                                    style={[
                                        styles.resultItem,
                                        index < results.length - 1 && styles.resultDivider,
                                    ]}
                                    onPress={() => handleSelect(entry)}
                                >
                                    <Text style={styles.resultTitle} numberOfLines={1}>
                                        {label}
                                    </Text>
                                    <Text style={styles.resultMeta} numberOfLines={1}>
                                        {entry.address ?? "Address unavailable"}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                )}
            </View>

            <MapMenu
                visible={isMenuOpen}
                onClose={() => setIsMenuOpen(false)}
                fullScreen
            />
        </View>
    );
}

const styles = StyleSheet.create({
    topBar: {
        backgroundColor: "#8e2334",
        paddingTop: 58,
        paddingHorizontal: 18,
        paddingBottom: 14,
        flexDirection: "row",
        alignItems: "flex-start",
        columnGap: 12,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
    },
    menuIcon: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
    },
    searchColumn: { flex: 1 },
    routeCard: {
        backgroundColor: "#f6dce0",
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    routeRow: {
        flexDirection: "row",
        alignItems: "center",
        columnGap: 10,
    },
    inputWrap: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    routeDivider: {
        height: 1,
        backgroundColor: "rgba(0,0,0,0.15)",
        marginVertical: 8,
        marginLeft: 28,
    },
    routeInput: {
        flex: 1,
        fontSize: 16,
        color: "#1c1c1e",
        fontWeight: "600",
        paddingVertical: 0,
    },
    clearButton: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    resultsCard: {
        marginTop: 8,
        backgroundColor: "#fff",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#e5c8cd",
        overflow: "hidden",
    },
    resultItem: { paddingVertical: 10, paddingHorizontal: 12 },
    resultDivider: {
        borderBottomWidth: 1,
        borderBottomColor: "#f0e0e3",
    },
    resultTitle: { fontSize: 15, fontWeight: "600", color: "#1c1c1e" },
    resultMeta: { fontSize: 13, color: "#6b6b6b", marginTop: 2 },
});
