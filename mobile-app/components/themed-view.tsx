import React from "react";
import { View, type ViewProps } from "react-native";

export function ThemedView({ style, ...props }: ViewProps) {
    return <View {...props} style={style} />;
}
