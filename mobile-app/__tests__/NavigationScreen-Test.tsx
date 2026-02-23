import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import NavigationScreen from '../components/NavigationScreen';

jest.mock('../context/settings', () => ({
  useSettings: () => ({ colourBlindMode: false }),
}));

jest.mock('../components/NavigationMenu', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function MockNavigationMenu() {
    return React.createElement(View, { testID: 'navigation-menu' });
  };
});

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: unknown) =>
      React.createElement(View, { testID: 'icon', ...(props as object) }),
  };
});

describe('NavigationScreen', () => {
  const defaultProps = {
    visible: true,
    startLabel: 'Your location',
    destinationLabel: 'Hall (H)',
    onClose: jest.fn(),
  };
  describe('Preview button', () => {
    it('should disable Preview button when isGetDirectionsDisabled is true', () => {
      // Arrange
      render(
        <NavigationScreen
          {...defaultProps}
          isGetDirectionsDisabled={true}
          navigationSteps={[
            {
              instruction: 'Head north',
              distanceText: '0.3 km',
              durationText: '1 min',
              maneuver: 'straight',
            },
          ]}
        />,
      );

      // Assert
      const button = screen.getByTestId('preview-route-button');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it('should enable Preview button when isGetDirectionsDisabled is false', () => {
      // Arrange
      render(
        <NavigationScreen
          {...defaultProps}
          isGetDirectionsDisabled={false}
          navigationSteps={[
            {
              instruction: 'Head north',
              distanceText: '0.3 km',
              durationText: '1 min',
              maneuver: 'straight',
            },
          ]}
        />,
      );

      // Assert
      const button = screen.getByTestId('preview-route-button');
      expect(button.props.accessibilityState?.disabled).toBe(false);
    });
  });

  describe('directions error messages', () => {
    it('should show error message when Origin equals Destination', () => {
      // Arrange
      render(<NavigationScreen {...defaultProps} directionsError="same_origin_destination" />);

      // Assert
      expect(screen.getByText('Origin and destination cannot be the same.')).toBeTruthy();
      expect(screen.getByTestId('directions-error')).toBeTruthy();
    });

    it('should show error message when coordinates are missing for selected name', () => {
      // Arrange
      render(<NavigationScreen {...defaultProps} directionsError="missing_coordinates" />);

      // Assert
      expect(screen.getByText('Coordinates are missing for the selected name.')).toBeTruthy();
      expect(screen.getByTestId('directions-error')).toBeTruthy();
    });

    it('should not show error message when directionsError is null', () => {
      // Arrange
      render(<NavigationScreen {...defaultProps} directionsError={null} />);

      // Assert
      expect(screen.queryByText('Origin and destination cannot be the same.')).toBeNull();
      expect(screen.queryByText('Coordinates are missing for the selected name.')).toBeNull();
      expect(screen.queryByTestId('directions-error')).toBeNull();
    });
  });

  describe('transport mode chips', () => {
    it('should render driving and walking mode chips', () => {
      render(<NavigationScreen {...defaultProps} />);
      expect(screen.getByTestId('mode-chip-driving')).toBeTruthy();
      expect(screen.getByTestId('mode-chip-walking')).toBeTruthy();
    });

    it('should render disabled shuttle bus chip', () => {
      render(<NavigationScreen {...defaultProps} />);
      expect(screen.getByTestId('mode-chip-shuttle-disabled')).toBeTruthy();
    });

    it('should display mode durations when provided', () => {
      render(
        <NavigationScreen
          {...defaultProps}
          modeDurations={{ driving: '15 mins', walking: '45 mins' }}
        />,
      );
      expect(screen.getByText('15 mins')).toBeTruthy();
      expect(screen.getByText('45 mins')).toBeTruthy();
    });

    it("should display '--' when mode durations are not provided", () => {
      render(<NavigationScreen {...defaultProps} />);
      const dashes = screen.getAllByText('--');
      expect(dashes.length).toBe(2);
    });

    it("should call onTransportModeChange with 'walking' when walking chip is pressed", () => {
      const onTransportModeChange = jest.fn();
      render(
        <NavigationScreen
          {...defaultProps}
          selectedTransportMode="driving"
          onTransportModeChange={onTransportModeChange}
        />,
      );
      fireEvent.press(screen.getByTestId('mode-chip-walking'));
      expect(onTransportModeChange).toHaveBeenCalledWith('walking');
    });

    it("should call onTransportModeChange with 'driving' when driving chip is pressed", () => {
      const onTransportModeChange = jest.fn();
      render(
        <NavigationScreen
          {...defaultProps}
          selectedTransportMode="walking"
          onTransportModeChange={onTransportModeChange}
        />,
      );
      fireEvent.press(screen.getByTestId('mode-chip-driving'));
      expect(onTransportModeChange).toHaveBeenCalledWith('driving');
    });
    it('should not throw when shuttle chip is pressed (it is not a Pressable)', () => {
      render(<NavigationScreen {...defaultProps} />);
      const shuttleChip = screen.getByTestId('mode-chip-shuttle-disabled');
      // View does not respond to press, this should not throw
      expect(() => fireEvent.press(shuttleChip)).not.toThrow();
    });

    it('should render active shuttle chip when isShuttleRoute=true and not weekend', () => {
      render(<NavigationScreen {...defaultProps} isShuttleRoute={true} isWeekend={false} />);
      expect(screen.getByTestId('mode-chip-shuttle')).toBeTruthy();
      expect(screen.queryByTestId('mode-chip-shuttle-disabled')).toBeNull();
    });

    it('should render disabled shuttle chip on weekend even for cross-campus route', () => {
      render(<NavigationScreen {...defaultProps} isShuttleRoute={true} isWeekend={true} />);
      expect(screen.getByTestId('mode-chip-shuttle-disabled')).toBeTruthy();
      expect(screen.queryByTestId('mode-chip-shuttle')).toBeNull();
    });

    it("should call onTransportModeChange with 'shuttle' when shuttle chip is pressed", () => {
      const onTransportModeChange = jest.fn();
      render(
        <NavigationScreen
          {...defaultProps}
          isShuttleRoute={true}
          isWeekend={false}
          selectedTransportMode="driving"
          onTransportModeChange={onTransportModeChange}
        />,
      );
      fireEvent.press(screen.getByTestId('mode-chip-shuttle'));
      expect(onTransportModeChange).toHaveBeenCalledWith('shuttle');
    });
  });

  describe('shuttle departures panel', () => {
    const shuttleInfo = {
      departureTimes: ['2026-02-21T10:00:00', '2026-02-21T10:30:00', null],
      tripDurationMin: 30,
      departureCampus: 'SGW' as const,
      walkToHubPolyline: [],
      shuttleSegmentPolyline: [],
      walkFromHubPolyline: [],
    };

    it('should show shuttle panel when shuttle mode is selected and info is available', () => {
      render(
        <NavigationScreen
          {...defaultProps}
          isShuttleRoute={true}
          isWeekend={false}
          selectedTransportMode="shuttle"
          shuttleInfo={shuttleInfo}
          isShuttleLoading={false}
        />,
      );
      expect(screen.getByTestId('shuttle-departures-panel')).toBeTruthy();
    });

    it('should show two departure time chips (one null is excluded)', () => {
      render(
        <NavigationScreen
          {...defaultProps}
          isShuttleRoute={true}
          isWeekend={false}
          selectedTransportMode="shuttle"
          shuttleInfo={shuttleInfo}
          isShuttleLoading={false}
        />,
      );
      expect(screen.getByTestId('shuttle-time-0')).toBeTruthy();
      expect(screen.getByTestId('shuttle-time-1')).toBeTruthy();
      expect(screen.queryByTestId('shuttle-time-2')).toBeNull();
    });

    it("should show 'No more shuttles today' when all departures are null", () => {
      render(
        <NavigationScreen
          {...defaultProps}
          isShuttleRoute={true}
          isWeekend={false}
          selectedTransportMode="shuttle"
          shuttleInfo={{ ...shuttleInfo, departureTimes: [null, null, null] }}
          isShuttleLoading={false}
        />,
      );
      expect(screen.getByTestId('shuttle-no-more')).toBeTruthy();
    });

    it('should show weekend notice when isWeekend is true and shuttle mode selected', () => {
      render(
        <NavigationScreen
          {...defaultProps}
          isShuttleRoute={true}
          isWeekend={true}
          selectedTransportMode="shuttle"
        />,
      );
      expect(screen.getByTestId('shuttle-weekend-notice')).toBeTruthy();
    });

    it('should not show shuttle panel when not in shuttle mode', () => {
      render(
        <NavigationScreen
          {...defaultProps}
          isShuttleRoute={true}
          isWeekend={false}
          selectedTransportMode="walking"
          shuttleInfo={shuttleInfo}
        />,
      );
      expect(screen.queryByTestId('shuttle-departures-panel')).toBeNull();
    });
  });

  describe('navigation steps list', () => {
    const mockSteps = [
      {
        instruction: 'Head north on Rue Guy',
        distanceText: '0.3 km',
        durationText: '1 min',
        maneuver: 'straight',
      },
      {
        instruction: 'Turn left onto Blvd de Maisonneuve',
        distanceText: '0.5 km',
        durationText: '2 mins',
        maneuver: 'turn-left',
      },
    ];

    it('should not render steps list when navigationSteps is empty', () => {
      render(<NavigationScreen {...defaultProps} navigationSteps={[]} />);
      expect(screen.queryByTestId('navigation-steps-list')).toBeNull();
    });

    it('should not render steps list when navigationSteps is not provided', () => {
      render(<NavigationScreen {...defaultProps} />);
      expect(screen.queryByTestId('navigation-steps-list')).toBeNull();
    });

    it('should render steps list when navigationSteps are provided', () => {
      render(<NavigationScreen {...defaultProps} navigationSteps={mockSteps} />);
      expect(screen.getByTestId('navigation-steps-list')).toBeTruthy();
    });

    it('should render correct number of step rows', () => {
      render(<NavigationScreen {...defaultProps} navigationSteps={mockSteps} />);
      expect(screen.getByTestId('nav-step-0')).toBeTruthy();
      expect(screen.getByTestId('nav-step-1')).toBeTruthy();
      expect(screen.queryByTestId('nav-step-2')).toBeNull();
    });

    it('should display step instruction text', () => {
      render(<NavigationScreen {...defaultProps} navigationSteps={mockSteps} />);
      expect(screen.getByText('Head north on Rue Guy')).toBeTruthy();
      expect(screen.getByText('Turn left onto Blvd de Maisonneuve')).toBeTruthy();
    });

    it('should display step distance and duration metadata', () => {
      render(<NavigationScreen {...defaultProps} navigationSteps={mockSteps} />);
      expect(screen.getByText('0.3 km · 1 min')).toBeTruthy();
      expect(screen.getByText('0.5 km · 2 mins')).toBeTruthy();
    });

    it('should display distance only when durationText is empty', () => {
      const stepsNoDuration = [
        {
          instruction: 'Arrive at destination',
          distanceText: '10 m',
          durationText: '',
        },
      ];
      render(<NavigationScreen {...defaultProps} navigationSteps={stepsNoDuration} />);
      expect(screen.getByText('10 m')).toBeTruthy();
    });
  });
});
