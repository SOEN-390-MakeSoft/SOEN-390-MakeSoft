import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import MapScreen from '../components/MapScreen';

const mockAnimateToRegion = jest.fn();
const mockHandleSelectCampus = jest.fn();
const mockHandleSelectBuilding = jest.fn();
const mockHandleCloseCard = jest.fn();
const mockSetSearchQuery = jest.fn();
const mockSetIsSearchFocused = jest.fn();
const mockGoToUserLocation = jest.fn(async (options?: { onResolved?: (c: any) => void }) => {
  if (options?.onResolved) {
    await options.onResolved({ latitude: 45.4971, longitude: -73.5791 });
  }
});

let mockCalendarEvents: any[] = [];
let mockRoutePreviewProps: any = null;
let mockSimulatedNow: Date | null = null;
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const mockRuntimeBuildings = [
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
  {
    id: '99',
    name: 'Test Building',
    code: 'TB',
    polygon: [
      { latitude: 45.5012, longitude: -73.5682 },
      { latitude: 45.5012, longitude: -73.5678 },
      { latitude: 45.5008, longitude: -73.5678 },
      { latitude: 45.5008, longitude: -73.5682 },
    ],
  },
];

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

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, { ...props, testID: 'icon' }),
  };
});

jest.mock('tamagui', () => ({
  useTheme: () => ({ cred: { get: () => '#912338' } }),
}));

jest.mock('../context/settings', () => ({
  useSettings: () => ({
    colourBlindMode: false,
    simulatedNow: mockSimulatedNow,
    setSimulatedNow: jest.fn(),
    resetSimulatedNow: jest.fn(),
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../hooks/useCampusContext', () => ({
  useCampusContext: () => ({
    activeCampus: 'sgw',
    buildings: mockRuntimeBuildings,
    sgwBuildings: mockRuntimeBuildings,
    loyolaBuildings: [],
    handleSelectCampus: mockHandleSelectCampus,
  }),
}));

jest.mock('../hooks/useSelectedBuilding', () => ({
  useSelectedBuilding: () => ({
    selectedBuildingId: null,
    remoteBuilding: null,
    isLoading: false,
    errorMessage: null,
    handleSelectBuilding: mockHandleSelectBuilding,
    handleCloseCard: mockHandleCloseCard,
  }),
}));

jest.mock('../hooks/useSearch', () => ({
  useSearch: () => ({
    searchQuery: '',
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
    goToUserLocation: mockGoToUserLocation,
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
      events: mockCalendarEvents,
      loading: false,
      error: null,
    }),
  };
});

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

jest.mock('../components/MapMenu', () => {
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

jest.mock('../components/ClassesCalendarRequired', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('../components/RoutePreviewScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props: any) => {
    mockRoutePreviewProps = props;
    return React.createElement(View, { testID: 'mock-route-preview' });
  };
});

describe('MapScreen - user story 3.4.1 next class destination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoutePreviewProps = null;
    mockSimulatedNow = null;
    const now = new Date();
    let start = new Date(Date.now() + 10 * 60 * 1000);
    let end = new Date(Date.now() + 70 * 60 * 1000);
    const sameDayAsNow =
      start.getFullYear() === now.getFullYear() &&
      start.getMonth() === now.getMonth() &&
      start.getDate() === now.getDate();
    if (!sameDayAsNow) {
      // Near midnight: force an in-progress class today to avoid flaky date rollover.
      start = new Date(Date.now() - 10 * 60 * 1000);
      end = new Date(Date.now() + 50 * 60 * 1000);
    }
    mockCalendarEvents = [
      {
        id: 'evt-1',
        summary: 'COMP 999',
        location: 'Sir George Williams Campus - Hall Building Rm 535',
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        htmlLink: 'https://calendar.google.com/event?eid=test',
      },
    ];
  });

  afterAll(() => {
    mockAlert.mockRestore();
  });

  it('auto-fills destination from calendar, locks it, and injects it into route preview props', async () => {
    const { getByTestId, getByText, getByDisplayValue, queryByDisplayValue, queryByText } = render(
      <MapScreen />,
    );

    fireEvent.press(getByTestId('directions-to-next-class-button'));

    await waitFor(() => {
      expect(getByTestId('next-class-card')).toBeTruthy();
    });

    // Resolved building name is shown, not the raw calendar location string.
    expect(getByText('Henry F Hall Building')).toBeTruthy();
    expect(queryByText('Sir George Williams Campus - Hall Building Rm 535')).toBeNull();

    fireEvent.press(getByText('Go'));

    await waitFor(() => {
      expect(getByDisplayValue('Henry F Hall Building (H)')).toBeTruthy();
    });

    const destinationInput = getByDisplayValue('Henry F Hall Building (H)');
    expect(destinationInput.props.editable).toBe(false);

    fireEvent.changeText(destinationInput, 'Test Building (TB)');
    expect(queryByDisplayValue('Test Building (TB)')).toBeNull();
    expect(getByDisplayValue('Henry F Hall Building (H)')).toBeTruthy();

    await waitFor(() => {
      expect(mockRoutePreviewProps?.destinationLabel).toBe('Henry F Hall Building (H)');
    });
  });

  it('shows "No classes today" and does not open routes when today has no classes', async () => {
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(9, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart.getTime() + 60 * 60 * 1000);
    mockCalendarEvents = [
      {
        id: 'evt-tomorrow',
        summary: 'SOEN 390',
        location: 'Sir George Williams Campus - Hall Building Rm 535',
        start: { dateTime: tomorrowStart.toISOString() },
        end: { dateTime: tomorrowEnd.toISOString() },
      },
    ];

    const { getByTestId, queryByTestId, queryByDisplayValue } = render(<MapScreen />);

    fireEvent.press(getByTestId('directions-to-next-class-button'));

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'No classes today',
        'You have no classes scheduled for today.',
      );
    });
    expect(queryByTestId('next-class-card')).toBeNull();
    expect(queryByDisplayValue('Henry F Hall Building (H)')).toBeNull();
  });

  it('uses simulated date/time when selecting next class', async () => {
    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(9, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart.getTime() + 60 * 60 * 1000);
    mockCalendarEvents = [
      {
        id: 'evt-tomorrow-sim',
        summary: 'SOEN 390',
        location: 'Sir George Williams Campus - Hall Building Rm 535',
        start: { dateTime: tomorrowStart.toISOString() },
        end: { dateTime: tomorrowEnd.toISOString() },
      },
    ];
    mockSimulatedNow = new Date(tomorrowStart.getTime() - 30 * 60 * 1000);

    const { getByTestId, getByText } = render(<MapScreen />);

    fireEvent.press(getByTestId('directions-to-next-class-button'));

    await waitFor(() => {
      expect(getByTestId('next-class-card')).toBeTruthy();
    });
    expect(getByText('SOEN 390')).toBeTruthy();
  });

  it('shows "Classes are over today" and does not open routes when all classes ended', async () => {
    const simulatedNow = new Date(2026, 2, 9, 15, 0, 0, 0); // Mar 9, 2026 3:00 PM local
    const classStart = new Date(2026, 2, 9, 9, 0, 0, 0); // Same day, already ended
    const classEnd = new Date(2026, 2, 9, 10, 0, 0, 0);
    mockSimulatedNow = simulatedNow;
    mockCalendarEvents = [
      {
        id: 'evt-ended',
        summary: 'SOEN 357',
        location: 'Sir George Williams Campus - Hall Building Rm 535',
        start: { dateTime: classStart.toISOString() },
        end: { dateTime: classEnd.toISOString() },
      },
    ];

    const { getByTestId, queryByTestId, queryByDisplayValue } = render(<MapScreen />);

    fireEvent.press(getByTestId('directions-to-next-class-button'));

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Classes are over today', 'You are done for today.');
    });
    expect(queryByTestId('next-class-card')).toBeNull();
    expect(queryByDisplayValue('Henry F Hall Building (H)')).toBeNull();
  });
});
