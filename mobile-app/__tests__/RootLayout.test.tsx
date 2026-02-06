import React from "react";
import { render } from "@testing-library/react-native";
import { View } from "react-native";
import RootLayout from "../app/_layout";

jest.mock("expo-router", () => {
    const React = require("react");
    const { View } = require("react-native");
    const MockStack = ({ children, ...props }: any) =>
        React.createElement(View, { testID: "stack", ...props }, children);
    MockStack.Screen = ({ name, ...props }: any) =>
        React.createElement(View, { testID: `stack-screen-${name}`, ...props });
    return { Stack: MockStack };
});

describe("Root layout", () => {
    it("configures Stack and includes menu screen", () => {
        const { getByTestId } = render(<RootLayout />);
        const stack = getByTestId("stack");

        expect(stack.props.initialRouteName).toBe("index");
        expect(stack.props.screenOptions).toEqual({ headerShown: false });

        const menuScreen = getByTestId("stack-screen-menu");
        expect(menuScreen.props.options).toEqual({ animation: "slide_from_left" });
    });
});
