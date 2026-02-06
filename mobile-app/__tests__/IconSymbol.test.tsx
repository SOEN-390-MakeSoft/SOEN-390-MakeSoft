import React from "react";
import path from "path";
import { render } from "@testing-library/react-native";

jest.mock("@expo/vector-icons/MaterialIcons", () => {
    const React = require("react");
    const { Text } = require("react-native");
    return {
        __esModule: true,
        default: (props: any) => React.createElement(Text, { testID: "material-icon", ...props }),
    };
});

jest.mock("expo-symbols", () => {
    const React = require("react");
    const { View } = require("react-native");
    return {
        __esModule: true,
        SymbolView: (props: any) => React.createElement(View, { testID: "symbol-view", ...props }),
    };
});

describe("IconSymbol", () => {
    it("maps symbol names to Material Icons", () => {
        const iconSymbolAndroidPath = path.resolve(
            __dirname,
            "../components/ui/icon-symbol.tsx"
        );
        const { IconSymbol: IconSymbolAndroid } = require(iconSymbolAndroidPath);
        const { getByTestId } = render(
            <IconSymbolAndroid name="house.fill" color="#123" />
        );

        const icon = getByTestId("material-icon");
        expect(icon.props.name).toBe("home");
        expect(icon.props.color).toBe("#123");
    });

    it("renders SymbolView on iOS version", () => {
        const iconSymbolIOSPath = path.resolve(
            __dirname,
            "../components/ui/icon-symbol.ios.tsx"
        );
        const { IconSymbol: IconSymbolIOS } = require(iconSymbolIOSPath);
        const { getByTestId } = render(
            <IconSymbolIOS name="house.fill" color="#456" size={30} />
        );

        const symbol = getByTestId("symbol-view");
        expect(symbol.props.name).toBe("house.fill");
        expect(symbol.props.tintColor).toBe("#456");
        expect(symbol.props.style[0]).toEqual({ width: 30, height: 30 });
    });
});
