import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import MapScreen from '../components/MapScreen';

const mockAnimateToRegion = jest.fn();

jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMapView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      animateToRegion: mockAnimateToRegion,
    }));
    return React.createElement(View, { ...props, testID: props.testID || 'map-view' });
  });
  return {
    __esModule: true,
    default: MockMapView,
    Marker: (props: any) => React.createElement(View, { ...props }),
    Polygon: (props: any) => React.createElement(View, { ...props }),
    Polyline: (props: any) => React.createElement(View, { ...props }),
  };
});

jest.mock('tamagui', () => ({
  useTheme: () => ({ cred: { get: () => '#912338' } }),
}));

jest.mock('../context/settings', () => ({
  useSettings: () => ({ colourBlindMode: false, simulatedNow: null }),
}));

const mockBuildings = [
  {
    id: '2',
    name: 'Henry F Hall Building',
    code: 'H',
    polygon: [
      { latitude: 45.4973, longitude: -73.5793 },
      { latitude: 45.4973, longitude: -73.5789 },
      { latitude: 45.4969, longitude: -73.5789 },
      { latitude: 45.4969, longitude: -73.5793 },
    ],
  },
];

jest.mock('../hooks/useCampusContext', () => ({
  useCampusContext: () => ({
    activeCampus: 'sgw',
    buildings: mockBuildings,
    sgwBuildings: mockBuildings,
    loyolaBuildings: [],
    handleSelectCampus: jest.fn(),
  }),
}));

jest.mock('../hooks/useSelectedBuilding', () => ({
  useSelectedBuilding: () => ({
    selectedBuildingId: null,
    remoteBuilding: null,
    isLoading: false,
    errorMessage: null,
    handleSelectBuilding: jest.fn(),
    handleCloseCard: jest.fn(),
  }),
}));

jest.mock('../hooks/useSearch', () => ({
  useSearch: () => ({
    searchQuery: '',
    setSearchQuery: jest.fn(),
    isSearchFocused: false,
    setIsSearchFocused: jest.fn(),
    searchInputRef: { current: { blur: jest.fn() } },
    searchResults: [],
    handleSearchSubmit: jest.fn(),
    handleSelectSearchResult: jest.fn(),
  }),
}));

jest.mock('../hooks/useUserLocation', () => ({
  useUserLocation: () => ({
    isLocating: false,
    goToUserLocation: jest.fn(),
  }),
}));

jest.mock('../hooks/useMapUI', () => ({
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

jest.mock('../hooks/usePublicCalendar', () => {
  const actual = jest.requireActual('../hooks/usePublicCalendar');
  return {
    ...actual,
    usePublicCalendar: () => ({
      connectCalendar: jest.fn(),
      disconnect: jest.fn(),
      refreshEvents: jest.fn(),
      isConnected: false,
      events: [],
      loading: false,
      error: null,
    }),
  };
});

function mockMakeNavigationState(overrides: Record<string, unknown> = {}) {
  return {
    isNavigationOpen: false,
    navigationStart: '',
    navigationDestination: '',
    navigationOrigin: null,
    routeSummary: null,
    modeDurations: {},
    isRouteLoading: false,
    directionsError: null,
    isGetDirectionsDisabled: false,
    setNavigationActiveField: jest.fn(),
    openNavigationForBuilding: jest.fn(),
    handleMapBuildingPress: jest.fn(),
    handleMapCoordinatePress: jest.fn(),
    handleSearchSelect: jest.fn(),
    setStartToCurrentLocation: jest.fn(),
    setStartToCurrentLocationBuilding: jest.fn(),
    closeNavigation: jest.fn(),
    clearTapMarker: jest.fn(),
    tapMarkerCoordinate: null,
    selectedTransportMode: 'driving',
    setSelectedTransportMode: jest.fn(),
    routePolyline: [],
    routeRegion: null,
    navigationSteps: [],
    isShuttleRoute: false,
    isShuttleLoading: false,
    shuttleInfo: null,
    isWeekend: false,
    lateTransportModes: [],
    routeSegments: [],
    openNavigationForResolvedDestination: jest.fn(),
    isDestinationLocked: false,
    rerouteFromLocation: jest.fn(),
    ...overrides,
  };
}

jest.mock('../hooks/useNavigationBetweenBuildings', () => ({
  useNavigationBetweenBuildings: () => mockMakeNavigationState(),
}));

jest.mock('../hooks/useIndoorNavigation', () => ({
  useIndoorNavigation: () => ({
    isIndoorActive: true,
    activeBuildingCode: 'H',
    searchRooms: jest.fn(() => []),
    buildingMeta: { name: 'Henry F Hall Building', entrances: [] },
    activateBuilding: jest.fn(),
    selectRoom: jest.fn(),
    setActiveLevel: jest.fn(),
    navigateToRoom: jest.fn(),
    deactivate: jest.fn(),
    detectIndoor: jest.fn(() => null),
    indoorRoute: null,
    activeLevelFeatures: [],
    activeLevel: '1',
    destinationRoom: null,
    selectedRoom: null,
    levels: ['1', '2'],
    error: null,
  }),
}));

jest.mock('../components/CampusSwitch', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/BuildingInfoCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/QuickPickPanel', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/MapMenu', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/NavigationScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/RoutePreviewScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/DirectionsModeScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/SearchBar', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/CalendarModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/NextClassPanel', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/ClassesCalendarRequired', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/indoor/FloorSelector', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View, { testID: 'floor-selector' });
});

jest.mock('../components/indoor/RoomInfoBubble', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/indoor/IndoorMapOverlay', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return (props: any) =>
    React.createElement(
      View,
      { testID: 'indoor-overlay' },
      React.createElement(Text, { testID: 'overlay-category' }, props.categoryFilter ?? 'none'),
      React.createElement(
        Text,
        { testID: 'overlay-amenities' },
        (props.visiblePoiAmenities ?? []).join(','),
      ),
    );
});

describe('MapScreen indoor category filters', () => {
  it('updates overlay props when pressing indoor category chips', () => {
    const { getByTestId } = render(<MapScreen />);

    const categoryLabel = getByTestId('overlay-category');
    const amenitiesLabel = getByTestId('overlay-amenities');

    expect(categoryLabel.props.children).toBe('none');
    expect(amenitiesLabel.props.children).toBe('toilets,drinking_water');

    fireEvent.press(getByTestId('indoor-chip-washrooms'));
    expect(getByTestId('overlay-category').props.children).toBe('washrooms');
    expect(getByTestId('overlay-amenities').props.children).toBe('toilets');

    fireEvent.press(getByTestId('indoor-chip-washrooms'));
    expect(getByTestId('overlay-category').props.children).toBe('none');
    expect(getByTestId('overlay-amenities').props.children).toBe('toilets,drinking_water');

    fireEvent.press(getByTestId('indoor-chip-elevators'));
    expect(getByTestId('overlay-category').props.children).toBe('elevators');
    expect(getByTestId('overlay-amenities').props.children).toBe('');

    fireEvent.press(getByTestId('indoor-chip-water-fountains'));
    expect(getByTestId('overlay-category').props.children).toBe('water_fountains');
    expect(getByTestId('overlay-amenities').props.children).toBe('drinking_water');
  });
});
