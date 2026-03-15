import React from 'react';
import { act, render } from '@testing-library/react-native';
import MapScreen from '../components/MapScreen';
import { useNavigationBetweenBuildings } from '../hooks/useNavigationBetweenBuildings';
import { useIndoorNavigation } from '../hooks/useIndoorNavigation';

let mockSimulatedNow: Date | null = null;
const mockAnimateToRegion = jest.fn();
let mockNavigationScreenProps: any = null;
let mockRoutePreviewProps: any = null;

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

jest.mock('../hooks/useCampusContext', () => ({
  useCampusContext: () => ({
    activeCampus: 'sgw',
    buildings: [],
    sgwBuildings: [],
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

jest.mock('../context/settings', () => ({
  useSettings: () => ({ colourBlindMode: false, simulatedNow: mockSimulatedNow }),
}));

jest.mock('../hooks/useNavigationBetweenBuildings', () => ({
  useNavigationBetweenBuildings: jest.fn(),
}));
jest.mock('../hooks/useIndoorNavigation', () => ({
  useIndoorNavigation: jest.fn(),
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
  return (props: any) => {
    mockNavigationScreenProps = props;
    return React.createElement(View, { testID: 'mock-navigation-screen' });
  };
});
jest.mock('../components/RoutePreviewScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props: any) => {
    mockRoutePreviewProps = props;
    return React.createElement(View, { testID: 'mock-route-preview' });
  };
});
jest.mock('../components/SearchBar', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

function makeNavigationState(overrides: Record<string, unknown> = {}) {
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
    openNavigation: jest.fn(),
    setNavigationActiveField: jest.fn(),
    openNavigationForBuilding: jest.fn(),
    setNavigationStartLocation: jest.fn(),
    setNavigationDestinationLocation: jest.fn(),
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
    routeSegments: [],
    openNavigationForResolvedDestination: jest.fn(),
    isDestinationLocked: false,
    ...overrides,
  };
}

function makeIndoorState(overrides: Record<string, unknown> = {}) {
  return {
    isIndoorActive: false,
    activeBuildingCode: null,
    buildingMeta: null,
    levels: [],
    activeLevel: '1',
    setActiveLevel: jest.fn(),
    activeLevelFeatures: [],
    featuresByLevel: {},
    indoorRoute: null,
    destinationRoom: null,
    selectedRoom: null,
    error: null,
    activateBuilding: jest.fn(),
    deactivate: jest.fn(),
    selectRoom: jest.fn(),
    navigateToRoom: jest.fn(),
    navigateToRoomAccessible: jest.fn(),
    searchRooms: jest.fn().mockReturnValue([]),
    findNearest: jest.fn(),
    detectIndoor: jest.fn().mockReturnValue(null),
    ...overrides,
  };
}

describe('MapScreen shuttle visual distinction', () => {
  beforeEach(() => {
    mockSimulatedNow = null;
    mockNavigationScreenProps = null;
    mockRoutePreviewProps = null;
    mockAnimateToRegion.mockClear();
    (useIndoorNavigation as jest.Mock).mockReturnValue(makeIndoorState());
  });

  it('passes simulatedNow from settings into navigation hook as currentTime', () => {
    const simulated = new Date('2026-03-09T05:00:00.000Z');
    mockSimulatedNow = simulated;

    (useNavigationBetweenBuildings as jest.Mock).mockReturnValue(makeNavigationState());

    render(<MapScreen />);

    const firstCallArg = (useNavigationBetweenBuildings as jest.Mock).mock.calls[0][0];
    expect(firstCallArg.currentTime).toBe(simulated);
  });

  it('renders driving route polyline when driving mode is selected', () => {
    (useNavigationBetweenBuildings as jest.Mock).mockReturnValue(
      makeNavigationState({
        selectedTransportMode: 'driving',
        routePolyline: [
          { latitude: 45.4972, longitude: -73.5791 },
          { latitude: 45.4976, longitude: -73.5785 },
        ],
      }),
    );

    const { getByTestId, queryByTestId } = render(<MapScreen />);

    const drivingPolyline = getByTestId('route-driving-polyline');
    expect(drivingPolyline.props.strokeColor).toBe('#4A89F3');
    expect(drivingPolyline.props.coordinates.length).toBe(2);
    expect(queryByTestId('route-walking-polyline')).toBeNull();
  });

  it('renders dashed walking route polyline when walking mode is selected', () => {
    (useNavigationBetweenBuildings as jest.Mock).mockReturnValue(
      makeNavigationState({
        selectedTransportMode: 'walking',
        routePolyline: [
          { latitude: 45.4972, longitude: -73.5791 },
          { latitude: 45.4976, longitude: -73.5785 },
        ],
      }),
    );

    const { getByTestId, queryByTestId } = render(<MapScreen />);

    const walkingPolyline = getByTestId('route-walking-polyline');
    expect(walkingPolyline.props.lineDashPattern).toEqual([10, 6]);
    expect(walkingPolyline.props.coordinates.length).toBe(2);
    expect(queryByTestId('route-driving-polyline')).toBeNull();
  });

  it('composes outdoor and indoor polylines into one continuous route', () => {
    (useNavigationBetweenBuildings as jest.Mock).mockReturnValue(
      makeNavigationState({
        selectedTransportMode: 'walking',
        routePolyline: [
          { latitude: 45.0, longitude: -73.0 },
          { latitude: 45.0001, longitude: -73.0001 },
        ],
      }),
    );
    (useIndoorNavigation as jest.Mock).mockReturnValue(
      makeIndoorState({
        isIndoorActive: true,
        activeBuildingCode: 'H',
        buildingMeta: {
          name: 'Hall Building',
          entrances: [{ latitude: 45.0002, longitude: -73.0002 }],
        },
        indoorRoute: {
          polyline: [
            { latitude: 45.0003, longitude: -73.0003 },
            { latitude: 45.0004, longitude: -73.0004 },
          ],
          steps: [],
          startLevel: '1',
          totalEstimatedSeconds: 0,
        },
      }),
    );

    const { getByTestId } = render(<MapScreen />);
    act(() => {
      mockNavigationScreenProps.onRoomSelect('destination', {
        buildingCode: 'H',
        roomRef: 'H-840',
      });
    });
    const walkingPolyline = getByTestId('route-walking-polyline');

    expect(walkingPolyline.props.coordinates).toEqual([
      { latitude: 45.0, longitude: -73.0 },
      { latitude: 45.0001, longitude: -73.0001 },
      { latitude: 45.0002, longitude: -73.0002 },
      { latitude: 45.0003, longitude: -73.0003 },
      { latitude: 45.0004, longitude: -73.0004 },
    ]);
  });

  it('renders walking segments as dotted blue and shuttle as solid red', () => {
    (useNavigationBetweenBuildings as jest.Mock).mockReturnValue(
      makeNavigationState({
        modeDurations: { shuttle: '20 min' },
        selectedTransportMode: 'shuttle',
        routePolyline: [
          { latitude: 45.4972, longitude: -73.5791 },
          { latitude: 45.4576, longitude: -73.6387 },
        ],
        routeSegments: [
          {
            kind: 'walking',
            polyline: [
              { latitude: 45.4972, longitude: -73.5791 },
              { latitude: 45.497, longitude: -73.579 },
            ],
          },
          {
            kind: 'shuttle',
            polyline: [
              { latitude: 45.497, longitude: -73.579 },
              { latitude: 45.4578, longitude: -73.639 },
            ],
          },
          {
            kind: 'walking',
            polyline: [
              { latitude: 45.4578, longitude: -73.639 },
              { latitude: 45.4576, longitude: -73.6387 },
            ],
          },
        ],
        isShuttleRoute: true,
      }),
    );

    const { getByTestId } = render(<MapScreen />);

    const walkingSegment = getByTestId('route-shuttle-segment-walking-0');
    const shuttleSegment = getByTestId('route-shuttle-segment-shuttle-1');

    expect(walkingSegment.props.strokeColor).toBe('#4A89F3');
    expect(walkingSegment.props.lineDashPattern).toEqual([10, 6]);

    expect(shuttleSegment.props.strokeColor).toBe('#912338');
    expect(shuttleSegment.props.lineDashPattern).toBeUndefined();
  });

  it('uses wider focus region for shuttle preview step 2', () => {
    const shuttleRegion = {
      latitude: 45.478,
      longitude: -73.609,
      latitudeDelta: 0.06,
      longitudeDelta: 0.09,
    };
    (useNavigationBetweenBuildings as jest.Mock).mockReturnValue(
      makeNavigationState({
        isNavigationOpen: true,
        selectedTransportMode: 'shuttle',
        isShuttleRoute: true,
        navigationSteps: [
          {
            instruction: 'Walk to Hall Building (SGW)',
            distanceText: 'Arrive at 9:23 AM',
            durationText: '~8 min walk',
            focusCoordinate: { latitude: 45.4972, longitude: -73.5789 },
          },
          {
            instruction: 'Take shuttle to Vanier Library (Loyola)',
            distanceText: 'Arrive at 10:00 AM',
            durationText: '~30 min ride',
            focusCoordinate: { latitude: 45.478, longitude: -73.609 },
            focusRegion: shuttleRegion,
          },
          {
            instruction: 'Walk to your destination',
            distanceText: 'Arrive at 10:07 AM',
            durationText: '~7 min walk',
            focusCoordinate: { latitude: 45.4584, longitude: -73.6387 },
          },
        ],
      }),
    );

    render(<MapScreen />);

    act(() => {
      mockNavigationScreenProps.onOpenPreview();
    });
    act(() => {
      mockRoutePreviewProps.onSelectStep(1);
    });

    expect(mockAnimateToRegion).toHaveBeenLastCalledWith(shuttleRegion, 450);
  });
});
