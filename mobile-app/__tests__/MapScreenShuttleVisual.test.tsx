import React from "react";
import { render } from "@testing-library/react-native";
import MapScreen from "../components/MapScreen";
import { useNavigationBetweenBuildings } from "../hooks/useNavigationBetweenBuildings";

jest.mock("react-native-maps", () => {
    const React = require("react");
    const { View } = require("react-native");
    const MockMapView = React.forwardRef((props: any, _ref: any) =>
        React.createElement(View, { ...props, testID: props.testID || "map-view" })
    );
    return {
        __esModule: true,
        default: MockMapView,
        Marker: (props: any) => React.createElement(View, { ...props }),
        Polygon: (props: any) => React.createElement(View, { ...props }),
        Polyline: (props: any) => React.createElement(View, { ...props }),
    };
});

jest.mock("tamagui", () => ({
    useTheme: () => ({ cred: { get: () => "#912338" } }),
}));

jest.mock("../hooks/useCampusContext", () => ({
    useCampusContext: () => ({
        activeCampus: "sgw",
        buildings: [],
        handleSelectCampus: jest.fn(),
    }),
}));

jest.mock("../hooks/useSelectedBuilding", () => ({
    useSelectedBuilding: () => ({
        selectedBuildingId: null,
        remoteBuilding: null,
        isLoading: false,
        errorMessage: null,
        handleSelectBuilding: jest.fn(),
        handleCloseCard: jest.fn(),
    }),
}));

jest.mock("../hooks/useSearch", () => ({
    useSearch: () => ({
        searchQuery: "",
        setSearchQuery: jest.fn(),
        isSearchFocused: false,
        setIsSearchFocused: jest.fn(),
        searchInputRef: { current: { blur: jest.fn() } },
        searchResults: [],
        handleSearchSubmit: jest.fn(),
        handleSelectSearchResult: jest.fn(),
    }),
}));

jest.mock("../hooks/useUserLocation", () => ({
    useUserLocation: () => ({
        isLocating: false,
        goToUserLocation: jest.fn(),
    }),
}));

jest.mock("../hooks/useMapUI", () => ({
    useMapUI: () => ({
        isMenuOpen: false,
        setIsMenuOpen: jest.fn(),
        isQuickPickOpen: false,
        quickPickContentHeight: 0,
        setQuickPickContentHeight: jest.fn(),
        quickPickVisibleHeight: 0,
        quickPickMaxHeight: 300,
        handleToggleQuickPick: jest.fn(),
    }),
}));

jest.mock("../context/settings", () => ({
    useSettings: () => ({ colourBlindMode: false }),
}));

jest.mock("../hooks/useNavigationBetweenBuildings", () => ({
    useNavigationBetweenBuildings: jest.fn(),
}));

jest.mock("../components/CampusSwitch", () => {
    const React = require("react");
    const { View } = require("react-native");
    return () => React.createElement(View);
});
jest.mock("../components/BuildingInfoCard", () => {
    const React = require("react");
    const { View } = require("react-native");
    return () => React.createElement(View);
});
jest.mock("../components/QuickPickPanel", () => {
    const React = require("react");
    const { View } = require("react-native");
    return () => React.createElement(View);
});
jest.mock("../components/MapMenu", () => {
    const React = require("react");
    const { View } = require("react-native");
    return () => React.createElement(View);
});
jest.mock("../components/NavigationScreen", () => {
    const React = require("react");
    const { View } = require("react-native");
    return () => React.createElement(View);
});
jest.mock("../components/SearchBar", () => {
    const React = require("react");
    const { View } = require("react-native");
    return () => React.createElement(View);
});

describe("MapScreen shuttle visual distinction", () => {
    it("renders walking segments as dotted blue and shuttle as solid red", () => {
        (useNavigationBetweenBuildings as jest.Mock).mockReturnValue({
            isNavigationOpen: false,
            navigationStart: "",
            navigationDestination: "",
            routeSummary: null,
            activeMode: "driving",
            modeDurations: { shuttle: "20 min" },
            isRouteLoading: false,
            directionsError: null,
            isGetDirectionsDisabled: false,
            setNavigationActiveField: jest.fn(),
            setActiveMode: jest.fn(),
            openNavigationForBuilding: jest.fn(),
            handleMapBuildingPress: jest.fn(),
            handleMapCoordinatePress: jest.fn(),
            handleSearchSelect: jest.fn(),
            closeNavigation: jest.fn(),
            tapMarkerCoordinate: null,
            selectedTransportMode: "shuttle",
            setSelectedTransportMode: jest.fn(),
            routePolyline: [
                { latitude: 45.4972, longitude: -73.5791 },
                { latitude: 45.4576, longitude: -73.6387 },
            ],
            routeSegments: [
                {
                    kind: "walking",
                    polyline: [
                        { latitude: 45.4972, longitude: -73.5791 },
                        { latitude: 45.4970, longitude: -73.5790 },
                    ],
                },
                {
                    kind: "shuttle",
                    polyline: [
                        { latitude: 45.4970, longitude: -73.5790 },
                        { latitude: 45.4578, longitude: -73.6390 },
                    ],
                },
                {
                    kind: "walking",
                    polyline: [
                        { latitude: 45.4578, longitude: -73.6390 },
                        { latitude: 45.4576, longitude: -73.6387 },
                    ],
                },
            ],
            routeRegion: null,
            navigationSteps: [],
            isCrossCampus: true,
        });

        const { getByTestId } = render(<MapScreen />);

        const walkingSegment = getByTestId("route-shuttle-segment-walking-0");
        const shuttleSegment = getByTestId("route-shuttle-segment-shuttle-1");

        expect(walkingSegment.props.strokeColor).toBe("#4A89F3");
        expect(walkingSegment.props.lineDashPattern).toEqual([10, 6]);

        expect(shuttleSegment.props.strokeColor).toBe("#912338");
        expect(shuttleSegment.props.lineDashPattern).toBeUndefined();
    });
});
