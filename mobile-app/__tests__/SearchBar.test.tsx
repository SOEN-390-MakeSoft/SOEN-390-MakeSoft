import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import SearchBar from "../components/SearchBar";

jest.mock("@expo/vector-icons", () => {
    const React = require("react");
    const { Text } = require("react-native");
    return {
        MaterialIcons: (props: any) => React.createElement(Text, { testID: "search-icon", ...props }),
    };
});

describe("SearchBar", () => {
    it("renders the placeholder and icon", () => {
        const { getByPlaceholderText, getByTestId } = render(
            <SearchBar value="" onChangeText={jest.fn()} placeholder="Find a building" />
        );

        expect(getByPlaceholderText("Find a building")).toBeTruthy();
        expect(getByTestId("search-icon")).toBeTruthy();
    });

    it("renders the provided value and calls onChangeText", () => {
        const onChangeText = jest.fn();
        const { getByDisplayValue, getByPlaceholderText } = render(
            <SearchBar value="Hall" onChangeText={onChangeText} placeholder="Search" />
        );

        expect(getByDisplayValue("Hall")).toBeTruthy();

        fireEvent.changeText(getByPlaceholderText("Search"), "Library");
        expect(onChangeText).toHaveBeenCalledWith("Library");
    });

    it("uses the default placeholder when not provided", () => {
        const { getByPlaceholderText } = render(
            <SearchBar value="" onChangeText={jest.fn()} />
        );

        expect(getByPlaceholderText("Search")).toBeTruthy();
    });
});
