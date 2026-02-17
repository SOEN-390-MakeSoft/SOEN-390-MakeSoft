import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import NavigationMenu from "../components/NavigationMenu";

jest.mock("../context/settings", () => ({
    useSettings: () => ({ colourBlindMode: false }),
}));

jest.mock("../data/building-addresses", () => ({
    BUILDING_ADDRESSES: [
        {
            code: "TB",
            name: "Test Building",
            address: "123 Test St",
        },
    ],
}));

jest.mock("../data/buildingPolygons", () => ({
    BUILDING_POLYGONS: {
        "1": {
            name: "TB - Test Building",
            street: "Test",
            housenumber: "123",
            polygon: [
                { latitude: 0, longitude: 0 },
                { latitude: 0, longitude: 2 },
                { latitude: 2, longitude: 2 },
                { latitude: 2, longitude: 0 },
            ],
        },
    },
}));

jest.mock("../data/buildingPolygonsLoyola", () => ({
    LOYOLA_BUILDING_POLYGONS: {},
}));

jest.mock("../components/MapMenu", () => {
    const React = require("react");
    const { View } = require("react-native");
    return function MockMapMenu() {
        return React.createElement(View, { testID: "map-menu" });
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

describe("NavigationMenu", () => {
    it("passes building coordinates when selecting a search result", () => {
        const onSelectLocation = jest.fn();

        render(
            <NavigationMenu
                startLabel="Your location"
                destinationLabel=""
                onSelectLocation={onSelectLocation}
            />
        );

        const startInput = screen.getByPlaceholderText("Start");
        fireEvent(startInput, "focus");
        fireEvent.changeText(startInput, "Test");

        fireEvent.press(screen.getByText("Test Building (TB)"));

        expect(onSelectLocation).toHaveBeenCalledWith("start", {
            label: "Test Building (TB)",
            coordinate: { latitude: 1, longitude: 1 },
            isUserLocation: undefined,
        });
    });

    it("passes user location marker when selecting 'Use your location'", () => {
        const onSelectLocation = jest.fn();

        render(
            <NavigationMenu
                startLabel="Your location"
                destinationLabel=""
                onSelectLocation={onSelectLocation}
            />
        );

        const startInput = screen.getByPlaceholderText("Start");
        fireEvent(startInput, "focus");

        fireEvent.press(screen.getByText("Use your location"));

        expect(onSelectLocation).toHaveBeenCalledWith("start", {
            label: "Your location",
            coordinate: null,
            isUserLocation: true,
        });
    });
});
