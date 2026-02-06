import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { SettingsProvider, useSettings } from "../context/settings";

describe("settings context", () => {
    it("throws if used outside provider", () => {
        const Consumer = () => {
            useSettings();
            return null;
        };

        expect(() => render(<Consumer />)).toThrow("useSettings must be used within SettingsProvider");
    });

    it("provides values when inside provider", () => {
        const Consumer = () => {
            const { colourBlindMode } = useSettings();
            return <Text>{colourBlindMode ? "on" : "off"}</Text>;
        };

        const { getByText } = render(
            <SettingsProvider>
                <Consumer />
            </SettingsProvider>
        );

        expect(getByText("off")).toBeTruthy();
    });
});
