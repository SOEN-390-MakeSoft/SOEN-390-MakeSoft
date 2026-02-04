import React from "react";
import { View } from "react-native";
import MapView from "react-native-maps";

// A simple map screen centered on SGW campus

export default function MapScreen() {
    return (
        <View style={{ flex: 1 }}>
            <MapView
                style={{ flex: 1 }}
                provider="google"
                initialRegion={{
                    latitude: 45.4973,     // SGW
                    longitude: -73.5789,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }}
            />
        </View>
    );
}
