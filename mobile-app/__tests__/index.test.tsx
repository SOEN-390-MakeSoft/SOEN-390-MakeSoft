import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import WelcomeScreen from '../app/index';

/**
 * Mock expo-router to capture navigation calls.
 * Provides a mock push function to verify navigation behavior.
 */
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

/**
 * Mock tamagui components with simple React Native equivalents.
 * Allows testing component behavior without loading the full Tamagui library.
 */
jest.mock('tamagui', () => ({
  Button: ({ children, onPress, ...props }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity onPress={onPress} {...props}>
        <Text>{children}</Text>
      </TouchableOpacity>
    );
  },
  Text: ({ children, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
  },
  YStack: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
  Spacer: () => null,
}));

describe('WelcomeScreen', () => {
  /**
   * Reset mock function calls before each test to ensure test isolation.
   */
  beforeEach(() => {
    mockPush.mockClear();
  });

  /**
   * Test: Verifies that the WelcomeScreen renders essential UI elements.
   * Checks for the presence of the app title and the "Get Started" button.
   */
  it('renders correctly', () => {
    const { getByText } = render(<WelcomeScreen />);
    expect(getByText('Campus Guide')).toBeTruthy();
    expect(getByText('Get Started')).toBeTruthy();
  });

  /**
   * Test: Verifies navigation occurs when the "Get Started" button is pressed.
   * Ensures the router.push() is called with the correct Map route.
   */
  it('navigates to Map when button is pressed', () => {
    const { getByText } = render(<WelcomeScreen />);
    fireEvent.press(getByText('Get Started'));
    expect(mockPush).toHaveBeenCalledWith('../(tabs)/Map');
  });
});
