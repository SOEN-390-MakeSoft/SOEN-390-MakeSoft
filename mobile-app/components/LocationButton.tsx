import React from "react";
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

interface LocationButtonProps {
    isLocating: boolean;
    onPress: () => void;
}

/**
 * Button component for navigating to user's current location
 */
export default function LocationButton({ isLocating, onPress }: LocationButtonProps) {
    return (
        <Pressable
            testID="location-button"
            style={[styles.recenterButton, { opacity: isLocating ? 0.85 : 1 }]}
            onPress={onPress}
            disabled={isLocating}
            accessibilityLabel="Go to my location"
        >
            {isLocating ? (
                <ActivityIndicator testID="activity-indicator" size="small" color="#c41230" />
            ) : (
                <MaterialIcons name="my-location" size={32} color="#c41230" />
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
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
});
