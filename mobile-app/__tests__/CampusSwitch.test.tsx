import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import CampusSwitch from "../components/CampusSwitch";

jest.mock("tamagui", () => {
    const actual = jest.requireActual("tamagui");
    return {
        ...actual,
        useTheme: () => ({
            cred: { get: () => "#123456" },
        }),
    };
});

describe("CampusSwitch", () => {
    it("renders both campus options", () => {
        const { getByText } = render(
            <CampusSwitch selectedCampus="SGW" onCampusChange={jest.fn()} />
        );

        expect(getByText("SGW")).toBeTruthy();
        expect(getByText("Loyola")).toBeTruthy();
    });

    it("calls onCampusChange with SGW and Loyola", () => {
        const onCampusChange = jest.fn();
        const { getByText, rerender } = render(
            <CampusSwitch selectedCampus="SGW" onCampusChange={onCampusChange} />
        );

        fireEvent.press(getByText("Loyola"));
        expect(onCampusChange).toHaveBeenCalledWith("Loyola");

        rerender(<CampusSwitch selectedCampus="Loyola" onCampusChange={onCampusChange} />);
        fireEvent.press(getByText("SGW"));
        expect(onCampusChange).toHaveBeenCalledWith("SGW");
    });

    it("applies active styles to the selected campus", () => {
        const { getByText, rerender } = render(
            <CampusSwitch selectedCampus="SGW" onCampusChange={jest.fn()} />
        );

        expect(getByText("SGW")).toHaveStyle({ color: "#fff" });

        rerender(<CampusSwitch selectedCampus="Loyola" onCampusChange={jest.fn()} />);
        expect(getByText("Loyola")).toHaveStyle({ color: "#fff" });
    });
});
