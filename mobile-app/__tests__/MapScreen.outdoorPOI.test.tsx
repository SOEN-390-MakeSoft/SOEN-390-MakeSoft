import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MapScreen from '../components/MapScreen';

// ---------------------------------------------------------------------------
// Common mocks (same pattern as MapScreen.indoorCategoryFilters.test.tsx)
// ---------------------------------------------------------------------------

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
  useTheme: () => ({
    cred: { get: () => '#912338', val: '#912338' },
    colourBlind1: { val: '#B3D4FF' },
    colourBlind2: { val: '#FF8800' },
  }),
}));

jest.mock('../context/settings', () => ({
  useSettings: () => ({ colourBlindMode: false, simulatedNow: null }),
}));

jest.mock('expo-location');
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light' },
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) =>
      React.createElement(View, { ...props, testID: props.testID || 'icon' }),
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    MaterialIcons: (props: any) =>
      React.createElement(View, { ...props, testID: props.testID || 'icon' }),
  };
});

const mockBuildings = [
  {
    id: '1',
    name: 'Hall Building',
    address: '1455 De Maisonneuve',
    code: 'H',
    polygon: [
      { latitude: 45.497, longitude: -73.579 },
      { latitude: 45.497, longitude: -73.578 },
      { latitude: 45.496, longitude: -73.578 },
      { latitude: 45.496, longitude: -73.579 },
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

const mockSetSearchQuery = jest.fn();
const mockSetIsSearchFocused = jest.fn();
let mockSearchQuery = '';
const mockUseOutdoorPOI = jest.fn();
jest.mock('../hooks/useSearch', () => ({
  useSearch: () => ({
    searchQuery: mockSearchQuery,
    setSearchQuery: mockSetSearchQuery,
    isSearchFocused: false,
    setIsSearchFocused: mockSetIsSearchFocused,
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
      isConnected: true,
      events: [],
      loading: false,
      error: null,
    }),
  };
});

const mockOpenNavigationForCoordinate = jest.fn();
jest.mock('../hooks/useNavigationBetweenBuildings', () => ({
  useNavigationBetweenBuildings: () => ({
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
    openNavigationForResolvedDestination: jest.fn(),
    openNavigationForCoordinate: mockOpenNavigationForCoordinate,
    openIndoorOnlyNavigation: jest.fn(),
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
    setSelectedWalkingRouteVariant: jest.fn(),
    walkingRouteComparison: null,
    routePolyline: [],
    routeRegion: null,
    navigationSteps: [],
    isShuttleRoute: false,
    isShuttleLoading: false,
    shuttleInfo: null,
    isWeekend: false,
    lateTransportModes: [],
    routeSegments: [],
    isIndoorOnlyRoute: false,
    isDestinationLocked: false,
    rerouteFromLocation: jest.fn(),
  }),
}));

jest.mock('../hooks/useIndoorNavigation', () => ({
  useIndoorNavigation: () => ({
    isIndoorActive: false,
    activeBuildingCode: null,
    activateBuilding: jest.fn(),
    selectRoom: jest.fn(),
    setActiveLevel: jest.fn(),
    navigateToRoom: jest.fn(),
    navigateToRoomAccessible: jest.fn(),
    deactivate: jest.fn(),
    indoorRoute: null,
    activeLevelFeatures: [],
    activeLevel: null,
    destinationRoom: null,
    selectedRoom: null,
    levels: [],
    error: null,
    findNearest: jest.fn(),
    rerouteCurrent: jest.fn(),
  }),
}));

jest.mock('../hooks/useIndoorRoomPicker', () => ({
  useIndoorRoomPicker: () => ({
    indoorRoomOptions: [],
    handleIndoorRoomSelect: jest.fn(),
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../tamagui.config', () => ({}));

jest.mock('../data/buildingPolygons', () => ({
  BUILDING_POLYGONS: {
    H: {
      name: 'Hall Building',
      street: 'De Maisonneuve',
      housenumber: '1455',
      polygon: [
        { latitude: 45.497, longitude: -73.579 },
        { latitude: 45.497, longitude: -73.578 },
        { latitude: 45.496, longitude: -73.578 },
        { latitude: 45.496, longitude: -73.579 },
      ],
    },
  },
}));

jest.mock('../data/buildingPolygonsLoyola', () => ({
  LOYOLA_BUILDING_POLYGONS: {},
}));

jest.mock('../data/building-addresses', () => ({
  BUILDING_ADDRESSES: [{ code: 'H', name: 'Hall Building', address: '1455 De Maisonneuve' }],
}));

// Stub heavy components we're not testing
jest.mock('../components/CampusSwitch', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View, { testID: 'campus-switch' });
});

jest.mock('../components/NavigationScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props: any) =>
    props.visible ? React.createElement(View, { testID: 'navigation-screen' }) : null;
});

jest.mock('../components/RoutePreviewScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props: any) =>
    props.visible ? React.createElement(View, { testID: 'route-preview-screen' }) : null;
});

jest.mock('../components/DirectionsModeScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props: any) =>
    props.visible ? React.createElement(View, { testID: 'directions-mode-screen' }) : null;
});

jest.mock('../components/QuickPickPanel', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View, { testID: 'quick-pick-panel' });
});

jest.mock('../components/MapMenu', () => {
  const React = require('react');
  const { View, Pressable, Text } = require('react-native');
  return ({ onOutdoorPOICategoriesChange }: any) =>
    React.createElement(
      View,
      { testID: 'map-menu' },
      React.createElement(
        Pressable,
        {
          testID: 'mock-menu-cafe',
          onPress: () => onOutdoorPOICategoriesChange?.(['cafe']),
        },
        React.createElement(Text, null, 'Cafe'),
      ),
      React.createElement(
        Pressable,
        {
          testID: 'mock-menu-all',
          onPress: () => onOutdoorPOICategoriesChange?.([]),
        },
        React.createElement(Text, null, 'All'),
      ),
    );
});

jest.mock('../components/CalendarModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View, { testID: 'calendar-modal' });
});

jest.mock('../components/NextClassPanel', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ children }: any) =>
    React.createElement(View, { testID: 'next-class-panel' }, children?.(jest.fn(), jest.fn()));
});

jest.mock('../components/ClassesCalendarRequired', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View, { testID: 'classes-calendar-required' });
});

jest.mock('../components/indoor/IndoorMapOverlay', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View, { testID: 'indoor-overlay' });
});

jest.mock('../components/indoor/FloorSelector', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/indoor/RoomInfoBubble', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/indoor/PoiInfoBubble', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/indoor/IndoorStartPromptModal', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

// ---------------------------------------------------------------------------
// Outdoor POI mock
// ---------------------------------------------------------------------------

const testPOI = {
  id: 'place123',
  name: 'Great Cafe',
  address: '100 Test St',
  coordinate: { latitude: 45.498, longitude: -73.579 },
  category: 'cafe',
  rating: 4.5,
  openNow: true,
};

const mockSelectPOI = jest.fn();
const mockSelectPOIFromMap = jest.fn();
const mockClearSelectedPOI = jest.fn();
let mockOutdoorPOIState = {
  outdoorPOIResults: [] as any[],
  selectedOutdoorPOI: null as any,
  isOutdoorPOILoading: false,
  selectPOI: mockSelectPOI,
  selectPOIFromMap: mockSelectPOIFromMap,
  clearSelectedPOI: mockClearSelectedPOI,
};

jest.mock('../hooks/useOutdoorPOI', () => ({
  useOutdoorPOI: (args: any) => {
    mockUseOutdoorPOI(args);
    return mockOutdoorPOIState;
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MapScreen – Outdoor POI integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchQuery = '';
    mockOutdoorPOIState = {
      outdoorPOIResults: [],
      selectedOutdoorPOI: null,
      isOutdoorPOILoading: false,
      selectPOI: mockSelectPOI,
      selectPOIFromMap: mockSelectPOIFromMap,
      clearSelectedPOI: mockClearSelectedPOI,
    };
  });

  it('renders MapScreen without outdoor POI markers when no results', () => {
    const { getByTestId, queryByTestId } = render(<MapScreen />);
    expect(getByTestId('campus-map')).toBeTruthy();
    expect(queryByTestId('outdoor-poi-marker-place123')).toBeNull();
  });

  it('renders outdoor POI markers when results are present', () => {
    mockOutdoorPOIState.outdoorPOIResults = [testPOI];
    const { getByTestId } = render(<MapScreen />);
    expect(getByTestId('outdoor-poi-marker-place123')).toBeTruthy();
  });

  it('shows OutdoorPOIInfoCard when a POI is selected', () => {
    mockOutdoorPOIState.selectedOutdoorPOI = testPOI;
    const { getByTestId } = render(<MapScreen />);
    expect(getByTestId('poi-name')).toBeTruthy();
    expect(getByTestId('poi-name').props.children).toBe('Great Cafe');
  });

  it('does not show OutdoorPOIInfoCard when no POI is selected', () => {
    mockOutdoorPOIState.selectedOutdoorPOI = null;
    const { queryByTestId } = render(<MapScreen />);
    expect(queryByTestId('poi-name')).toBeNull();
  });

  it('calls clearSelectedPOI when close button is pressed on the info card', () => {
    mockOutdoorPOIState.selectedOutdoorPOI = testPOI;
    const { getByTestId } = render(<MapScreen />);
    fireEvent.press(getByTestId('poi-close-button'));
    expect(mockClearSelectedPOI).toHaveBeenCalled();
  });

  it('calls openNavigationForCoordinate when Directions is pressed on the POI card', () => {
    mockOutdoorPOIState.selectedOutdoorPOI = testPOI;
    const { getByText } = render(<MapScreen />);
    fireEvent.press(getByText('Directions'));
    expect(mockOpenNavigationForCoordinate).toHaveBeenCalledWith('Great Cafe', testPOI.coordinate);
    expect(mockClearSelectedPOI).toHaveBeenCalled();
  });

  it('selects a POI when a Google Maps built-in POI is tapped via onPoiClick', () => {
    const { getByTestId } = render(<MapScreen />);
    const map = getByTestId('campus-map');

    fireEvent(map, 'onPoiClick', {
      nativeEvent: {
        placeId: 'gmap-poi-1',
        name: 'K2 Bistro',
        coordinate: { latitude: 45.496, longitude: -73.577 },
      },
    });

    expect(mockSelectPOIFromMap).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'gmap-poi-1',
        name: 'K2 Bistro',
        coordinate: { latitude: 45.496, longitude: -73.577 },
        category: 'place',
      }),
    );
  });

  it('updates the search query when an outdoor category is selected from the menu', () => {
    const { getByTestId } = render(<MapScreen />);

    fireEvent.press(getByTestId('mock-menu-cafe'));

    expect(mockSetSearchQuery).toHaveBeenCalledWith('');
    expect(mockClearSelectedPOI).toHaveBeenCalled();
    expect(mockUseOutdoorPOI).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedCategories: ['cafe'] }),
    );
  });

  it('clears selected outdoor categories when All is selected in the menu', () => {
    const { getByTestId } = render(<MapScreen />);

    fireEvent.press(getByTestId('mock-menu-all'));

    expect(mockSetSearchQuery).toHaveBeenCalledWith('');
    expect(mockUseOutdoorPOI).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedCategories: [] }),
    );
  });
});
