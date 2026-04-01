import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { SettingsProvider } from '../context/settings';
import MapMenu from '../components/MapMenu';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('tamagui', () => ({
  useTheme: () => ({ cred: { get: () => '#912338' } }),
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, { ...props, testID: 'icon' }),
  };
});

describe('MapMenu date/time simulation', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  afterAll(() => {
    alertSpy.mockRestore();
  });

  it('applies simulated date/time and can reset with Now', () => {
    const { getByTestId, getByText } = render(
      <SettingsProvider>
        <MapMenu visible={true} onClose={jest.fn()} />
      </SettingsProvider>,
    );

    expect(getByTestId('simulated-now-status').props.children).toContain(
      'Using current date & time',
    );

    fireEvent.changeText(getByTestId('simulated-date-input'), '2026-03-09');
    fireEvent.changeText(getByTestId('simulated-time-input'), '10:30');
    fireEvent.press(getByTestId('simulated-apply-button'));

    expect(getByText(/Using simulated:/)).toBeTruthy();

    fireEvent.press(getByTestId('simulated-now-button'));
    expect(getByTestId('simulated-now-status').props.children).toContain(
      'Using current date & time',
    );
  });

  it('shows validation alert for invalid date/time input', () => {
    const { getByTestId } = render(
      <SettingsProvider>
        <MapMenu visible={true} onClose={jest.fn()} />
      </SettingsProvider>,
    );

    fireEvent.changeText(getByTestId('simulated-date-input'), 'bad-date');
    fireEvent.changeText(getByTestId('simulated-time-input'), '25:99');
    fireEvent.press(getByTestId('simulated-apply-button'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Invalid date/time',
      'Use date YYYY-MM-DD and time HH:mm.',
    );
  });

  it('renders outdoor POI category chips and notifies when a chip is pressed', () => {
    const onOutdoorPOICategoriesChange = jest.fn();
    const { getByTestId } = render(
      <SettingsProvider>
        <MapMenu
          visible={true}
          onClose={jest.fn()}
          selectedOutdoorPOICategories={['restaurant']}
          onOutdoorPOICategoriesChange={onOutdoorPOICategoriesChange}
        />
      </SettingsProvider>,
    );

    fireEvent.press(getByTestId('outdoor-poi-chip-cafe'));
    fireEvent.press(getByTestId('outdoor-poi-chip-restaurant'));
    fireEvent.press(getByTestId('outdoor-poi-chip-all'));

    expect(onOutdoorPOICategoriesChange).toHaveBeenNthCalledWith(1, ['restaurant', 'cafe']);
    expect(onOutdoorPOICategoriesChange).toHaveBeenNthCalledWith(2, []);
    expect(onOutdoorPOICategoriesChange).toHaveBeenNthCalledWith(3, [
      'restaurant',
      'cafe',
      'pharmacy',
      'gym',
      'bank',
      'supermarket',
      'bar',
      'hospital',
      'library',
      'parking',
      'gas_station',
      'hotel',
    ]);
  });
});
