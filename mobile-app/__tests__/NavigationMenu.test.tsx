import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import NavigationMenu from '../components/NavigationMenu';

jest.mock('../context/settings', () => ({
  useSettings: () => ({ colourBlindMode: false }),
}));

jest.mock('../components/MapMenu', () => {
  const React = require('react');
  const { View } = require('react-native');
  return () => React.createElement(View);
});

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, props),
  };
});

describe('NavigationMenu', () => {
  it('surfaces indoor room suggestions and triggers onRoomSelect', () => {
    const onRoomSelect = jest.fn();
    const onBuildingSelect = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <NavigationMenu onRoomSelect={onRoomSelect} onBuildingSelect={onBuildingSelect} />,
    );

    const startInput = getByPlaceholderText('Start');
    fireEvent(startInput, 'focus');
    fireEvent.changeText(startInput, 'H-840');

    const roomOption = getByText('Room H-840');
    fireEvent.press(roomOption);

    expect(onRoomSelect).toHaveBeenCalledWith('start', {
      buildingCode: 'H',
      roomRef: 'H-840',
    });
  });
});
