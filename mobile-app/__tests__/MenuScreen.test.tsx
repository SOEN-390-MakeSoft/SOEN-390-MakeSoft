import React from "react";
import { Platform } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { TamaguiProvider, Theme, Switch } from "tamagui";
import config from "../tamagui.config";
import MenuScreen from "../app/menu";

const mockBack = jest.fn();
const mockSetColourBlindMode = jest.fn();
let mockColourBlindMode = false;
let mockThemeHasCred = true;

const originalPlatformOS = Platform.OS;
const setPlatformOS = (value: "ios" | "android") => {
    try {
        Object.defineProperty(Platform, "OS", { configurable: true, value });
    } catch {
        (Platform as { OS: string }).OS = value;
    }
};

jest.mock("expo-router", () => ({
    useRouter: () => ({ back: mockBack }),
}));

jest.mock("../context/settings", () => ({
    useSettings: () => ({
        colourBlindMode: mockColourBlindMode,
        setColourBlindMode: mockSetColourBlindMode,
    }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
    __esModule: true,
    default: () => ({
        width: 400,
        height: 800,
        scale: 2,
        fontScale: 2,
    }),
}));

jest.mock("tamagui", () => {
    const actual = jest.requireActual("tamagui");
    return {
        ...actual,
        useTheme: () =>
            mockThemeHasCred
                ? { cred: { get: () => "#912338" } }
                : {},
    };
});

const renderWithProviders = (component: React.ReactElement) =>
    render(
        <TamaguiProvider config={config}>
            <Theme name="light">{component}</Theme>
        </TamaguiProvider>
    );

describe("MenuScreen", () => {
    beforeEach(() => {
        mockBack.mockClear();
        mockSetColourBlindMode.mockClear();
        mockColourBlindMode = false;
        mockThemeHasCred = true;
        setPlatformOS("ios");
    });

    afterAll(() => {
        setPlatformOS(originalPlatformOS as "ios" | "android");
    });

    it("navigates back when the back button is pressed", () => {
        const { getByLabelText } = renderWithProviders(<MenuScreen />);
        fireEvent.press(getByLabelText("Go back"));
        expect(mockBack).toHaveBeenCalled();
    });

    it("toggles colour blind mode", () => {
        const { UNSAFE_getByType } = renderWithProviders(<MenuScreen />);
        const switchNode = UNSAFE_getByType(Switch);
        expect(switchNode.props.backgroundColor).toBe("#D1D5DB");
        fireEvent(switchNode, "onCheckedChange", true);
        expect(mockSetColourBlindMode).toHaveBeenCalledWith(true);
    });

    it("uses fallback red when colour blind mode is on", () => {
        mockColourBlindMode = true;
        mockThemeHasCred = false;
        setPlatformOS("android");

        const { UNSAFE_getByType } = renderWithProviders(<MenuScreen />);
        const switchNode = UNSAFE_getByType(Switch);
        expect(switchNode.props.backgroundColor).toBe("#912338");
    });
});
