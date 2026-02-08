import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import MenuScreen from '../app/menu';

const mockBack = jest.fn();
const mockSetColourBlindMode = jest.fn();
let mockColourBlindMode = false;
let mockThemeCred: string | null = '#912338';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('../context/settings', () => ({
  useSettings: () => ({
    colourBlindMode: mockColourBlindMode,
    setColourBlindMode: mockSetColourBlindMode,
  }),
}));

jest.mock('tamagui', () => {
  const { View, Text, Pressable } = require('react-native');
  const Switch = ({ checked, onCheckedChange, ...props }: any) => (
    <Pressable
      testID="colour-blind-switch"
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      onPress={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <View testID="switch-thumb" />
    </Pressable>
  );
  Switch.Thumb = ({ ...props }: any) => <View {...props} />;
  return {
    Text: ({ children, ...props }: any) => <Text {...props}>{children}</Text>,
    XStack: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    YStack: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Switch,
    useTheme: () => (mockThemeCred ? { cred: { get: () => mockThemeCred } } : {}),
  };
});

jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  return { MaterialIcons: (props: any) => <View {...props} /> };
});

describe('MenuScreen', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockSetColourBlindMode.mockClear();
    mockColourBlindMode = false;
    mockThemeCred = '#912338';
  });

  it('renders menu title and setting label', () => {
    const originalOS = Platform.OS;
    (Platform as any).OS = 'android';
    const { getByText } = render(<MenuScreen />);
    expect(getByText('Menu')).toBeTruthy();
    expect(getByText('Colour blind mode')).toBeTruthy();
    (Platform as any).OS = originalOS;
  });

  it('navigates back when the back button is pressed', () => {
    const { getByLabelText } = render(<MenuScreen />);
    fireEvent.press(getByLabelText('Go back'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('toggles colour blind mode when switch is pressed', () => {
    const { getByTestId } = render(<MenuScreen />);
    fireEvent.press(getByTestId('colour-blind-switch'));
    expect(mockSetColourBlindMode).toHaveBeenCalledWith(true);
  });

  it('covers ios layout and fallback theme', () => {
    const originalOS = Platform.OS;
    (Platform as any).OS = 'ios';
    mockThemeCred = null;
    mockColourBlindMode = true;
    const { getByText } = render(<MenuScreen />);
    expect(getByText('Menu')).toBeTruthy();
    (Platform as any).OS = originalOS;
  });
});
