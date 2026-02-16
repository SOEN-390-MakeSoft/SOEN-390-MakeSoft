import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
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

    describe("transport mode chips", () => {
        it("should render driving and walking mode chips", () => {
            render(<NavigationScreen {...defaultProps} />);
            expect(screen.getByTestId("mode-chip-driving")).toBeTruthy();
            expect(screen.getByTestId("mode-chip-walking")).toBeTruthy();
        });

        it("should render disabled shuttle bus chip", () => {
            render(<NavigationScreen {...defaultProps} />);
            expect(screen.getByTestId("mode-chip-shuttle-disabled")).toBeTruthy();
        });

        it("should display mode durations when provided", () => {
            render(
                <NavigationScreen
                    {...defaultProps}
                    modeDurations={{ driving: "15 mins", walking: "45 mins" }}
                />
            );
            expect(screen.getByText("15 mins")).toBeTruthy();
            expect(screen.getByText("45 mins")).toBeTruthy();
        });

        it("should display '--' when mode durations are not provided", () => {
            render(<NavigationScreen {...defaultProps} />);
            const dashes = screen.getAllByText("--");
            expect(dashes.length).toBe(2);
        });

        it("should call onTransportModeChange with 'walking' when walking chip is pressed", () => {
            const onTransportModeChange = jest.fn();
            render(
                <NavigationScreen
                    {...defaultProps}
                    selectedTransportMode="driving"
                    onTransportModeChange={onTransportModeChange}
                />
            );
            fireEvent.press(screen.getByTestId("mode-chip-walking"));
            expect(onTransportModeChange).toHaveBeenCalledWith("walking");
        });

        it("should call onTransportModeChange with 'driving' when driving chip is pressed", () => {
            const onTransportModeChange = jest.fn();
            render(
                <NavigationScreen
                    {...defaultProps}
                    selectedTransportMode="walking"
                    onTransportModeChange={onTransportModeChange}
                />
            );
            fireEvent.press(screen.getByTestId("mode-chip-driving"));
            expect(onTransportModeChange).toHaveBeenCalledWith("driving");
        });

        it("should not throw when shuttle chip is pressed (it is not a Pressable)", () => {
            render(<NavigationScreen {...defaultProps} />);
            const shuttleChip = screen.getByTestId("mode-chip-shuttle-disabled");
            // View does not respond to press, this should not throw
            expect(() => fireEvent.press(shuttleChip)).not.toThrow();
        });
    });
});
