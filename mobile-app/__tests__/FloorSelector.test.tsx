import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import FloorSelector from '../components/indoor/FloorSelector';

describe('FloorSelector', () => {
  it('renders floor buttons with friendly labels', () => {
    const { getByTestId, getByText } = render(
      <FloorSelector levels={['0', '-2', '9', '1']} activeLevel="1" onSelectLevel={jest.fn()} />,
    );

    expect(getByTestId('floor-btn-9')).toBeTruthy();
    expect(getByTestId('floor-btn-1')).toBeTruthy();
    expect(getByTestId('floor-btn-0')).toBeTruthy();
    expect(getByTestId('floor-btn--2')).toBeTruthy();
    expect(getByText('9')).toBeTruthy();
    expect(getByText('1')).toBeTruthy();
    expect(getByText('G')).toBeTruthy();
    expect(getByText('B2')).toBeTruthy();
  });

  it('highlights the active level with the provided accent color', () => {
    const { getByTestId } = render(
      <FloorSelector
        levels={['1', '2']}
        activeLevel="2"
        accentColor="#123456"
        onSelectLevel={jest.fn()}
      />,
    );

    expect(StyleSheet.flatten(getByTestId('floor-btn-2').props.style).backgroundColor).toBe(
      '#123456',
    );
    expect(StyleSheet.flatten(getByTestId('floor-btn-1').props.style).backgroundColor).toBe(
      undefined,
    );
  });

  it('calls onSelectLevel with the raw level value when pressed', () => {
    const onSelectLevel = jest.fn();
    const { getByTestId } = render(
      <FloorSelector levels={['0', '-1', '8']} activeLevel="0" onSelectLevel={onSelectLevel} />,
    );

    fireEvent.press(getByTestId('floor-btn--1'));
    fireEvent.press(getByTestId('floor-btn-8'));

    expect(onSelectLevel).toHaveBeenNthCalledWith(1, '-1');
    expect(onSelectLevel).toHaveBeenNthCalledWith(2, '8');
  });
});
