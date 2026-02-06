import React from "react";
import { render } from "@testing-library/react-native";
import Map from "../app/(tabs)/Map";

jest.mock("@/components/MapScreen", () => {
    const React = require("react");
    const { View } = require("react-native");
    return () => React.createElement(View, { testID: "map-screen" });
});

describe("Map tab", () => {
    it("renders MapScreen", () => {
        const { getByTestId } = render(<Map />);
        expect(getByTestId("map-screen")).toBeTruthy();
    });
});
