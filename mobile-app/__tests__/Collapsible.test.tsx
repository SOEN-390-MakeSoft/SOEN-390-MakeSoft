import React from "react";
import { Text } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { Collapsible } from "../components/ui/collapsible";

jest.mock("@/components/ui/icon-symbol", () => {
    const React = require("react");
    const { Text } = require("react-native");
    return {
        __esModule: true,
        IconSymbol: (props: any) =>
            React.createElement(Text, { testID: "icon-symbol", ...props }),
    };
});

jest.mock("@/hooks/use-color-scheme", () => ({
    __esModule: true,
    useColorScheme: () => "light",
}));

describe("Collapsible", () => {
    it("toggles content when pressed", () => {
        const { queryByText, getByText } = render(
            <Collapsible title="Details">
                <Text>Hidden content</Text>
            </Collapsible>
        );

        expect(queryByText("Hidden content")).toBeNull();
        fireEvent.press(getByText("Details"));
        expect(getByText("Hidden content")).toBeTruthy();
    });
});
