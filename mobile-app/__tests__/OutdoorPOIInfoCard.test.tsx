import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import OutdoorPOIInfoCard from '../components/OutdoorPOIInfoCard';
import type { OutdoorPOI } from '../services/outdoorPOIService';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('tamagui', () => ({
  useTheme: () => ({
    cred: { val: '#b21b2c' },
    colourBlind1: { val: '#B3D4FF' },
    colourBlind2: { val: '#FF8800' },
  }),
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) =>
      React.createElement(View, { ...props, testID: props.testID || 'icon' }),
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makePOI = (overrides?: Partial<OutdoorPOI>): OutdoorPOI => ({
  id: 'p1',
  name: 'Test Cafe',
  address: '123 Main St',
  coordinate: { latitude: 45.497, longitude: -73.578 },
  category: 'cafe',
  rating: 4.3,
  openNow: true,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OutdoorPOIInfoCard', () => {
  it('renders null when poi is null', () => {
    const { toJSON } = render(
      <OutdoorPOIInfoCard poi={null} onClose={jest.fn()} isColorBlind={false} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders POI name, address, and category', () => {
    const poi = makePOI();
    const { getByTestId } = render(
      <OutdoorPOIInfoCard poi={poi} onClose={jest.fn()} isColorBlind={false} />,
    );

    expect(getByTestId('poi-name').props.children).toBe('Test Cafe');
    expect(getByTestId('poi-address').props.children).toBe('123 Main St');
    expect(getByTestId('poi-category').props.children).toBe('Cafe');
  });

  it('displays "Address unavailable" when address is empty', () => {
    const poi = makePOI({ address: '' });
    const { getByTestId } = render(
      <OutdoorPOIInfoCard poi={poi} onClose={jest.fn()} isColorBlind={false} />,
    );

    expect(getByTestId('poi-address').props.children).toBe('Address unavailable');
  });

  it('renders rating when available', () => {
    const poi = makePOI({ rating: 4.3 });
    const { getByTestId } = render(
      <OutdoorPOIInfoCard poi={poi} onClose={jest.fn()} isColorBlind={false} />,
    );

    expect(getByTestId('poi-rating').props.children).toBe('4.3');
  });

  it('does not render rating when undefined', () => {
    const poi = makePOI({ rating: undefined });
    const { queryByTestId } = render(
      <OutdoorPOIInfoCard poi={poi} onClose={jest.fn()} isColorBlind={false} />,
    );

    expect(queryByTestId('poi-rating')).toBeNull();
  });

  it('shows open status text', () => {
    const poiOpen = makePOI({ openNow: true });
    const { getByTestId } = render(
      <OutdoorPOIInfoCard poi={poiOpen} onClose={jest.fn()} isColorBlind={false} />,
    );
    expect(getByTestId('poi-open-status').props.children).toBe('Open now');
  });

  it('shows closed status text', () => {
    const poiClosed = makePOI({ openNow: false });
    const { getByTestId } = render(
      <OutdoorPOIInfoCard poi={poiClosed} onClose={jest.fn()} isColorBlind={false} />,
    );
    expect(getByTestId('poi-open-status').props.children).toBe('Closed');
  });

  it('does not render open status when undefined', () => {
    const poi = makePOI({ openNow: undefined });
    const { queryByTestId } = render(
      <OutdoorPOIInfoCard poi={poi} onClose={jest.fn()} isColorBlind={false} />,
    );
    expect(queryByTestId('poi-open-status')).toBeNull();
  });

  it('formats category with underscores as spaces', () => {
    const poi = makePOI({ category: 'gas_station' });
    const { getByTestId } = render(
      <OutdoorPOIInfoCard poi={poi} onClose={jest.fn()} isColorBlind={false} />,
    );
    expect(getByTestId('poi-category').props.children).toBe('Gas Station');
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const poi = makePOI();
    const { getByTestId } = render(
      <OutdoorPOIInfoCard poi={poi} onClose={onClose} isColorBlind={false} />,
    );

    fireEvent.press(getByTestId('poi-close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onDirections when Directions button is pressed', () => {
    const onDirections = jest.fn();
    const poi = makePOI();
    const { getByText } = render(
      <OutdoorPOIInfoCard
        poi={poi}
        onClose={jest.fn()}
        onDirections={onDirections}
        isColorBlind={false}
      />,
    );

    fireEvent.press(getByText('Directions'));
    expect(onDirections).toHaveBeenCalledTimes(1);
  });

  it('renders with colourBlind styles when isColorBlind is true', () => {
    const poi = makePOI();
    const { getByTestId } = render(
      <OutdoorPOIInfoCard poi={poi} onClose={jest.fn()} isColorBlind={true} />,
    );

    expect(getByTestId('poi-name')).toBeTruthy();
  });
});
