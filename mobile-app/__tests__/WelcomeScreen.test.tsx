import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { TamaguiProvider, Theme } from "tamagui";
import config from "../tamagui.config";
import WelcomeScreen from "../app/index";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
    useRouter: () => ({ push: mockPush }),
}));

const renderWithProviders = (component: React.ReactElement) =>
    render(
        <TamaguiProvider config={config}>
            <Theme name="light">{component}</Theme>
        </TamaguiProvider>
    );

describe("WelcomeScreen", () => {
    beforeEach(() => {
        mockPush.mockClear();
    });

    it("renders the title and description", () => {
        const { getByText } = renderWithProviders(<WelcomeScreen />);
        expect(getByText("Campus Guide")).toBeTruthy();
        expect(
            getByText("Navigate campus effortlessly with interactive maps and real-time directions")
        ).toBeTruthy();
    });

    it("navigates to the Map tab when Get Started is pressed", () => {
        const { getByText } = renderWithProviders(<WelcomeScreen />);
        fireEvent.press(getByText("Get Started"));
        expect(mockPush).toHaveBeenCalledWith("../(tabs)/Map");
    });
});
