import React from "react";
import { Text, type TextProps } from "react-native";

type ThemedTextProps = TextProps & {
    type?: string;
};

export function ThemedText({ style, ...props }: ThemedTextProps) {
    return <Text {...props} style={style} />;
}
