import React from 'react';
import { View } from 'react-native';
import { Animated } from 'react-native';

// ---------------------------------------------------------------------------
// Generic stub component – used to replace heavy UI components in tests
// ---------------------------------------------------------------------------
export function MockStubView(props: any) {
  return React.createElement(View, props);
}
MockStubView.displayName = 'MockStubView';

// ---------------------------------------------------------------------------
// useMapUI mock
// ---------------------------------------------------------------------------
export function mockUseMapUIReturn() {
  return {
    isMenuOpen: false,
    setIsMenuOpen: jest.fn(),
    isColorBlind: false,
    setIsColorBlind: jest.fn(),
    isQuickPickOpen: true,
    setIsQuickPickOpen: jest.fn(),
    quickPickContentHeight: 0,
    setQuickPickContentHeight: jest.fn(),
    quickPickVisibleHeight: new Animated.Value(0),
    quickPickMaxHeight: 0,
    handleToggleQuickPick: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// useSearch mock
// ---------------------------------------------------------------------------
export function mockUseSearchReturn() {
  return {
    searchQuery: '',
    setSearchQuery: jest.fn(),
    isSearchFocused: false,
    setIsSearchFocused: jest.fn(),
    searchInputRef: { current: null },
    searchResults: [],
    handleSearchSubmit: jest.fn(),
    handleSelectSearchResult: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// useSelectedBuilding mock
// ---------------------------------------------------------------------------
export function mockUseSelectedBuildingReturn() {
  return {
    selectedBuildingId: null,
    selectedBuilding: null,
    remoteBuilding: null,
    isLoading: false,
    errorMessage: null,
    handleSelectBuilding: jest.fn(),
    handleCloseCard: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// useUserLocation mock
// ---------------------------------------------------------------------------
export function mockUseUserLocationReturn() {
  return {
    isLocating: false,
    goToUserLocation: jest.fn(async (options?: { onResolved?: (c: any) => void }) => {
      if (options?.onResolved) {
        await options.onResolved({ latitude: 45.4971, longitude: -73.5791 });
      }
    }),
  };
}
