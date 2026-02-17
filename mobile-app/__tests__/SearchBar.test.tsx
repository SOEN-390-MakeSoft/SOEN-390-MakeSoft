import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import SearchBar from "../components/SearchBar";

describe("SearchBar", () => {
  const baseProps = {
    searchQuery: "",
    onChangeText: jest.fn(),
    onSubmit: jest.fn(),
    onFocus: jest.fn(),
    onBlur: jest.fn(),
    isSearchFocused: false,
    isSearchDisabled: false,
    searchResults: [],
    onSelectResult: jest.fn(),
    onOpenMenu: jest.fn(),
    inputRef: React.createRef(),
    brandColor: "#b21b2c",
    logoSource: { uri: "test" },
  };

  it("renders placeholder", () => {
    const { getByPlaceholderText } = render(<SearchBar {...baseProps} />);
    expect(getByPlaceholderText("Search")).toBeTruthy();
  });

  it("shows clear button when text exists and clears on press", () => {
    const onChangeText = jest.fn();
    const { getByLabelText } = render(
      <SearchBar {...baseProps} searchQuery="Hall" onChangeText={onChangeText} />
    );

    fireEvent.press(getByLabelText("Clear search"));
    expect(onChangeText).toHaveBeenCalledWith("");
  });
});
