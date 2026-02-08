import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const { View, Text } = require('react-native');

  const Stack = ({ children, ...props }: any) => (
    <View testID="stack" {...props}>{children}</View>
  );
  Stack.Screen = ({ name, options }: any) => (
    <Text testID={`stack-screen-${name}`} options={options}>{name}</Text>
  );

  const Tabs = ({ children, ...props }: any) => (
    <View testID="tabs" {...props}>{children}</View>
  );
  Tabs.Screen = ({ name }: any) => (
    <Text testID={`tab-${name}`}>{name}</Text>
  );

  return { Stack, Tabs };
});

jest.mock('tamagui', () => {
  const { View } = require('react-native');
  return {
    TamaguiProvider: ({ children, ...props }: any) => (
      <View testID="tamagui" {...props}>{children}</View>
    ),
    Theme: ({ children, ...props }: any) => (
      <View testID="theme" {...props}>{children}</View>
    ),
  };
});

jest.mock('../tamagui.config', () => ({}));

jest.mock('@/components/MapScreen', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => <View testID="map-screen" />,
  };
});

import RootLayout from '../app/_layout';
import TabsLayout from '../app/(tabs)/_layout';
import Map from '../app/(tabs)/Map';

describe('RootLayout', () => {
  it('renders the stack and menu screen config', () => {
    const { getByTestId } = render(<RootLayout />);

    expect(getByTestId('tamagui')).toBeTruthy();
    expect(getByTestId('theme').props.name).toBe('light');

    const stack = getByTestId('stack');
    expect(stack.props.initialRouteName).toBe('index');
    expect(stack.props.screenOptions).toMatchObject({ headerShown: false });

    const menuScreen = getByTestId('stack-screen-menu');
    expect(menuScreen.props.options).toMatchObject({ animation: 'slide_from_left' });
  });
});

describe('TabsLayout', () => {
  it('renders the Map tab', () => {
    const { getByTestId } = render(<TabsLayout />);
    expect(getByTestId('tabs').props.screenOptions).toMatchObject({ headerShown: false });
    expect(getByTestId('tab-Map')).toBeTruthy();
  });
});

describe('Map', () => {
  it('renders MapScreen', () => {
    const { getByTestId } = render(<Map />);
    expect(getByTestId('map-screen')).toBeTruthy();
  });
});
