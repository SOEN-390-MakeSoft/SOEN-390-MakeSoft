import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import RoutePreviewScreen from "../components/RoutePreviewScreen";
import { SettingsProvider } from "../context/settings";

jest.mock("tamagui", () => {
    return {
        useTheme: () => ({
            colourBlind1: { get: () => "#B3D4FF" },
            colourBlind2: { get: () => "#1F4E8C" },
        }),
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

describe("RoutePreviewScreen", () => {
    const steps = [
        {
            instruction: "Head north on Rue Guy",
            distanceText: "0.3 km",
            durationText: "1 min",
            maneuver: "straight",
        },
        {
            instruction: "Turn left onto Blvd de Maisonneuve",
            distanceText: "0.5 km",
            durationText: "2 mins",
            maneuver: "turn-left",
        },
    ];
    const noop = () => {};

    it("should not render when not visible", () => {
        const { queryByTestId } = render(
            <SettingsProvider>
                <RoutePreviewScreen
                    visible={false}
                    steps={steps}
                    selectedStepIndex={0}
                    onSelectStep={noop}
                    onClose={noop}
                />
            </SettingsProvider>
        );
        expect(queryByTestId("route-preview-screen")).toBeNull();
    });

    it("should render and display current step info", () => {
        const { getByTestId, getByText } = render(
            <SettingsProvider>
                <RoutePreviewScreen
                    visible={true}
                    steps={steps}
                    selectedStepIndex={0}
                    onSelectStep={noop}
                    onClose={noop}
                />
            </SettingsProvider>
        );
        expect(getByTestId("route-preview-screen")).toBeTruthy();
        expect(getByText("Head north on Rue Guy")).toBeTruthy();
        expect(getByText("0.3 km · 1 min")).toBeTruthy();
        expect(getByTestId("route-preview-position").props.children.join("")).toContain("Step 1 of 2");
    });

    it("should call onClose when close button is pressed", () => {
        const onClose = jest.fn();
        const { getByTestId } = render(
            <SettingsProvider>
                <RoutePreviewScreen
                    visible={true}
                    steps={steps}
                    selectedStepIndex={0}
                    onSelectStep={noop}
                    onClose={onClose}
                />
            </SettingsProvider>
        );
        fireEvent.press(getByTestId("route-preview-close"));
        expect(onClose).toHaveBeenCalled();
    });

    it("should call onSelectStep when next/prev pressed", () => {
        const onSelectStep = jest.fn();
        const { getByTestId } = render(
            <SettingsProvider>
                <RoutePreviewScreen
                    visible={true}
                    steps={steps}
                    selectedStepIndex={0}
                    onSelectStep={onSelectStep}
                    onClose={noop}
                />
            </SettingsProvider>
        );
        fireEvent.press(getByTestId("route-preview-next"));
        expect(onSelectStep).toHaveBeenCalledWith(1);
        fireEvent.press(getByTestId("route-preview-prev"));
        expect(onSelectStep).toHaveBeenCalledWith(0);
    });

    it("should call onClose when Done is pressed on last step", () => {
        const onClose = jest.fn();
        const { getByTestId } = render(
            <SettingsProvider>
                <RoutePreviewScreen
                    visible={true}
                    steps={steps}
                    selectedStepIndex={1}
                    onSelectStep={noop}
                    onClose={onClose}
                />
            </SettingsProvider>
        );
        fireEvent.press(getByTestId("route-preview-done"));
        expect(onClose).toHaveBeenCalled();
    });

    it("should handle empty steps array gracefully", () => {
        const { getByTestId, getByText } = render(
            <SettingsProvider>
                <RoutePreviewScreen
                    visible={true}
                    steps={[]}
                    selectedStepIndex={0}
                    onSelectStep={noop}
                    onClose={noop}
                />
            </SettingsProvider>
        );
        expect(getByTestId("route-preview-screen")).toBeTruthy();
        expect(getByText("No route steps available")).toBeTruthy();
        expect(getByTestId("route-preview-position").props.children.join("")).toContain("Step 0 of 0");
    });
});
