import React from "react";
import { render } from "@testing-library/react-native";
import { View } from "react-native";
import TabsLayout from "../app/(tabs)/_layout";

jest.mock("expo-router", () => {
    const React = require("react");
    const { View } = require("react-native");
    const MockTabs = ({ children, ...props }: any) =>
        React.createElement(View, { testID: "tabs", ...props }, children);
    MockTabs.Screen = ({ name, ...props }: any) =>
        React.createElement(View, { testID: `tab-screen-${name}`, ...props });
    return { Tabs: MockTabs };
});

describe("Tabs layout", () => {
    it("renders Tabs with the Map screen and hides header", () => {
        const { getByTestId } = render(<TabsLayout />);
        const tabs = getByTestId("tabs");

        expect(tabs.props.screenOptions).toEqual({ headerShown: false });
        expect(getByTestId("tab-screen-Map")).toBeTruthy();
    });
});
