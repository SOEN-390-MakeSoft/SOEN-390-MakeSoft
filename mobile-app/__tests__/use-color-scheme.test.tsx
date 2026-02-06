import React from "react";
import { Text } from "react-native";
import { render, waitFor } from "@testing-library/react-native";

jest.mock("react-native/Libraries/Utilities/useColorScheme", () => ({
    __esModule: true,
    default: () => "dark",
}));

describe("useColorScheme hooks", () => {
    it("re-exports react-native useColorScheme", () => {
        const { useColorScheme } = require("../hooks/use-color-scheme");
        expect(useColorScheme()).toBe("dark");
    });

    it("returns light before hydration then updates on web", async () => {
        const { useColorScheme: useColorSchemeWeb } = require("../hooks/use-color-scheme.web");

        const Probe = () => {
            const scheme = useColorSchemeWeb();
            return <Text testID="scheme">{scheme}</Text>;
        };

        const { getByTestId } = render(<Probe />);
        await waitFor(() => {
            expect(getByTestId("scheme").props.children).toBe("dark");
        });
    });
});
