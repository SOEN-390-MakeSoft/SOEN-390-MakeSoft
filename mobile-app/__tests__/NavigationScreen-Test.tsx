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

    it('should call disabled-mode warning callback instead of switching when mode is late', () => {
      const onTransportModeChange = jest.fn();
      const onDisabledTransportModePress = jest.fn();
      render(
        <NavigationScreen
          {...defaultProps}
          selectedTransportMode="driving"
          onTransportModeChange={onTransportModeChange}
          disabledTransportModes={['walking']}
          onDisabledTransportModePress={onDisabledTransportModePress}
        />,
      );

      fireEvent.press(screen.getByTestId('mode-chip-walking'));

      expect(onDisabledTransportModePress).toHaveBeenCalledWith('walking');
      expect(onTransportModeChange).not.toHaveBeenCalled();
    });
  });

  describe('accessible route toggle', () => {
    it('should render disabled state when accessible routing is off', () => {
      render(<NavigationScreen {...defaultProps} isAccessibleRouteEnabled={false} />);

      const toggle = screen.getByTestId('accessible-route-toggle');

      expect(toggle.props.accessibilityRole).toBe('switch');
      expect(toggle.props.accessibilityState).toEqual({ checked: false });
    });

    it('should render enabled state when accessible routing is on', () => {
      render(<NavigationScreen {...defaultProps} isAccessibleRouteEnabled={true} />);

      const toggle = screen.getByTestId('accessible-route-toggle');

      expect(toggle.props.accessibilityRole).toBe('switch');
      expect(toggle.props.accessibilityState).toEqual({ checked: true });
    });

    it('should call onAccessibleRouteChange with true when pressed from disabled state', () => {
      const onAccessibleRouteChange = jest.fn();

      render(
        <NavigationScreen
          {...defaultProps}
          isAccessibleRouteEnabled={false}
          onAccessibleRouteChange={onAccessibleRouteChange}
        />,
      );

      fireEvent.press(screen.getByTestId('accessible-route-toggle'));

      expect(onAccessibleRouteChange).toHaveBeenCalledWith(true);
    });

    it('should call onAccessibleRouteChange with false when pressed from enabled state', () => {
      const onAccessibleRouteChange = jest.fn();

      render(
        <NavigationScreen
          {...defaultProps}
          isAccessibleRouteEnabled={true}
          onAccessibleRouteChange={onAccessibleRouteChange}
        />,
      );

      fireEvent.press(screen.getByTestId('accessible-route-toggle'));

      expect(onAccessibleRouteChange).toHaveBeenCalledWith(false);
    });
  });

  describe('trip summary and ETA', () => {
    const tripSummary = {
      arrivalText: '6:52 PM',
      distanceText: '2.1 km',
      durationText: '10 mins',
      viaText: 'Rue Guy',
    };

    it('should display ETA title and distance/duration metadata for non-shuttle modes', () => {
      render(
        <NavigationScreen
          {...defaultProps}
          selectedTransportMode="driving"
          tripSummary={tripSummary}
        />,
      );

      expect(screen.getByText('Arrive at 6:52 PM - via Rue Guy')).toBeTruthy();
      expect(screen.getByText('2.1 km - 10 mins')).toBeTruthy();
    });

    it('should hide trip summary text when shuttle mode is selected', () => {
      render(
        <NavigationScreen
          {...defaultProps}
          selectedTransportMode="shuttle"
          isShuttleRoute={true}
          shuttleInfo={{
            departureTimes: ['2026-02-21T10:00:00', '2026-02-21T10:30:00', null],
            tripDurationMin: 30,
            departureCampus: 'SGW',
            walkToHubPolyline: [],
            shuttleSegmentPolyline: [],
            walkFromHubPolyline: [],
          }}
          tripSummary={tripSummary}
          isShuttleLoading={false}
        />,
      );

      expect(screen.queryByText('Arrive at 6:52 PM - via Rue Guy')).toBeNull();
      expect(screen.queryByText('2.1 km - 10 mins')).toBeNull();
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
      waitDurationMin: 95,
      hasDirections: true,
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

    it('should show only the first available departure time chip', () => {
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
      expect(screen.queryByTestId('shuttle-time-1')).toBeNull();
      expect(screen.queryByTestId('shuttle-time-2')).toBeNull();
    });

    it('should show wait time formatted in hours and minutes', () => {
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
      expect(screen.getByTestId('shuttle-wait-time')).toBeTruthy();
      expect(screen.getByText('Wait: 1 h 35 min')).toBeTruthy();
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

    it('should show long-wait notice and hide ride directions when wait exceeds 2h', () => {
      render(
        <NavigationScreen
          {...defaultProps}
          isShuttleRoute={true}
          isWeekend={false}
          selectedTransportMode="shuttle"
          shuttleInfo={{ ...shuttleInfo, waitDurationMin: 130, hasDirections: false }}
          isShuttleLoading={false}
        />,
      );
      expect(screen.getByTestId('shuttle-long-wait-notice')).toBeTruthy();
      expect(screen.queryByText('~30 min ride')).toBeNull();
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

  describe('walking route comparison', () => {
    it('should display tunnel and outdoor walking options and switch to the selected variant', () => {
      const onTransportModeChange = jest.fn();
      const onWalkingRouteVariantChange = jest.fn();

      render(
        <NavigationScreen
          {...defaultProps}
          selectedTransportMode="driving"
          onTransportModeChange={onTransportModeChange}
          onWalkingRouteVariantChange={onWalkingRouteVariantChange}
          walkingRouteComparison={{
            originLabel: 'Hall',
            destinationLabel: 'EV',
            activeVariant: 'tunnel',
            fastestVariant: 'tunnel',
            tunnel: { durationText: '4 min', distanceText: '320 m' },
            outdoor: { durationText: '6 min', distanceText: '480 m' },
          }}
        />,
      );

      expect(screen.getByTestId('walking-route-comparison')).toBeTruthy();
      expect(
        screen.getByText('Hall -> EV: 4 min underground / 6 min walking outside'),
      ).toBeTruthy();
      expect(screen.getByText('Fastest')).toBeTruthy();
      expect(screen.getByText('320 m')).toBeTruthy();
      expect(screen.getByText('480 m')).toBeTruthy();

      fireEvent.press(screen.getByTestId('walking-option-outdoor'));

      expect(onTransportModeChange).toHaveBeenCalledWith('walking');
      expect(onWalkingRouteVariantChange).toHaveBeenCalledWith('outdoor');
    });

    it('should expose walking options as accessible buttons and disable them when walking is unavailable', () => {
      const onTransportModeChange = jest.fn();
      const onWalkingRouteVariantChange = jest.fn();
      const onDisabledTransportModePress = jest.fn();

      render(
        <NavigationScreen
          {...defaultProps}
          selectedTransportMode="driving"
          onTransportModeChange={onTransportModeChange}
          onWalkingRouteVariantChange={onWalkingRouteVariantChange}
          onDisabledTransportModePress={onDisabledTransportModePress}
          disabledTransportModes={['walking']}
          walkingRouteComparison={{
            originLabel: 'Hall',
            destinationLabel: 'EV',
            activeVariant: 'tunnel',
            fastestVariant: 'tunnel',
            tunnel: { durationText: '4 min', distanceText: '320 m' },
            outdoor: { durationText: '6 min', distanceText: '480 m' },
          }}
        />,
      );

      const tunnelOption = screen.getByTestId('walking-option-tunnel');
      const outdoorOption = screen.getByTestId('walking-option-outdoor');

      expect(tunnelOption.props.accessibilityRole).toBe('button');
      expect(tunnelOption.props.accessibilityState).toEqual({ disabled: true, selected: true });
      expect(outdoorOption.props.accessibilityState).toEqual({ disabled: true, selected: false });

      fireEvent.press(outdoorOption);

      expect(onTransportModeChange).not.toHaveBeenCalled();
      expect(onWalkingRouteVariantChange).not.toHaveBeenCalled();
      expect(onDisabledTransportModePress).not.toHaveBeenCalled();
    });
  });
});
