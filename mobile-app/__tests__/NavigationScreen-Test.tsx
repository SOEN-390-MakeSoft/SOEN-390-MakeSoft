import React from "react";
import { render, screen } from "@testing-library/react-native";
import NavigationScreen from "../components/NavigationScreen";

jest.mock("../context/settings", () => ({
    useSettings: () => ({ colourBlindMode: false }),
}));

jest.mock("../components/NavigationMenu", () => {
    const React = require("react");
    const { View } = require("react-native");
    return function MockNavigationMenu() {
        return React.createElement(View, { testID: "navigation-menu" });
    };
});

jest.mock("@expo/vector-icons/MaterialIcons", () => {
    const React = require("react");
    const { View } = require("react-native");
    return {
        __esModule: true,
        default: (props: unknown) =>
            React.createElement(View, { testID: "icon", ...(props as object) }),
    };
});

describe("NavigationScreen", () => {
    const defaultProps = {
        visible: true,
        startLabel: "Your location",
        destinationLabel: "Hall (H)",
        onClose: jest.fn(),
    };

    describe("Get Directions button", () => {
        it("should disable Get Directions button when isGetDirectionsDisabled is true", () => {
            // Arrange
            render(
                <NavigationScreen
                    {...defaultProps}
                    isGetDirectionsDisabled={true}
                />
            );

            // Assert
            const button = screen.getByTestId("get-directions-button");
            expect(button.props.accessibilityState?.disabled).toBe(true);
        });

        it("should enable Get Directions button when isGetDirectionsDisabled is false", () => {
            // Arrange
            render(
                <NavigationScreen
                    {...defaultProps}
                    isGetDirectionsDisabled={false}
                />
            );

            // Assert
            const button = screen.getByTestId("get-directions-button");
            expect(button.props.accessibilityState?.disabled).toBe(false);
        });
    });

    describe("directions error messages", () => {
        it("should show error message when Origin equals Destination", () => {
            // Arrange
            render(
                <NavigationScreen
                    {...defaultProps}
                    directionsError="same_origin_destination"
                />
            );

            // Assert
            expect(
                screen.getByText("Origin and destination cannot be the same.")
            ).toBeTruthy();
            expect(screen.getByTestId("directions-error")).toBeTruthy();
        });

        it("should show error message when coordinates are missing for selected name", () => {
            // Arrange
            render(
                <NavigationScreen
                    {...defaultProps}
                    directionsError="missing_coordinates"
                />
            );

            // Assert
            expect(
                screen.getByText("Coordinates are missing for the selected name.")
            ).toBeTruthy();
            expect(screen.getByTestId("directions-error")).toBeTruthy();
        });

        it("should not show error message when directionsError is null", () => {
            // Arrange
            render(
                <NavigationScreen
                    {...defaultProps}
                    directionsError={null}
                />
            );

            // Assert
            expect(
                screen.queryByText("Origin and destination cannot be the same.")
            ).toBeNull();
            expect(
                screen.queryByText("Coordinates are missing for the selected name.")
            ).toBeNull();
            expect(screen.queryByTestId("directions-error")).toBeNull();
        });
    });
});
