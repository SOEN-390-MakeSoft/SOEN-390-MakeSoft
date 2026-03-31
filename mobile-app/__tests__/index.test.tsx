import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import WelcomeScreen from '../app/index';
import * as SecureStore from 'expo-secure-store';

/**
 * Mock expo-router to capture navigation calls.
 * Provides a mock push function to verify navigation behavior.
 */
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

describe('WelcomeScreen', () => {
  const mockGetItemAsync = jest.mocked(SecureStore.getItemAsync);
  const mockSetItemAsync = jest.mocked(SecureStore.setItemAsync);

  /**
   * Reset mock function calls before each test to ensure test isolation.
   */
  beforeEach(() => {
    mockReplace.mockClear();
    mockGetItemAsync.mockReset();
    mockSetItemAsync.mockReset();
    mockGetItemAsync.mockResolvedValue(null);
    mockSetItemAsync.mockResolvedValue();
  });

  /**
   * Test: Verifies that first-time users see the onboarding content.
   */
  it('renders onboarding for first-time users', async () => {
    const { getByText } = render(<WelcomeScreen />);

    await waitFor(() => {
      expect(getByText('Navigation & directions')).toBeTruthy();
      expect(getByText('Skip')).toBeTruthy();
      expect(getByText('Next')).toBeTruthy();
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  /**
   * Test: Verifies that users can skip the onboarding immediately.
   */
  it('allows users to skip onboarding', async () => {
    const { getByText } = render(<WelcomeScreen />);

    await waitFor(() => expect(getByText('Skip')).toBeTruthy());
    fireEvent.press(getByText('Skip'));

    await waitFor(() => {
      expect(mockSetItemAsync).toHaveBeenCalledWith('has_seen_onboarding_v1', 'true');
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/Map');
    });
  });

  /**
   * Test: Verifies that users can move through each feature slide and finish onboarding.
   */
  it('completes onboarding after the last slide', async () => {
    const { getByText } = render(<WelcomeScreen />);

    await waitFor(() => expect(getByText('Navigation & directions')).toBeTruthy());

    fireEvent.press(getByText('Next'));
    await waitFor(() => expect(getByText('Campus switching')).toBeTruthy());

    fireEvent.press(getByText('Next'));
    await waitFor(() => expect(getByText('Indoor maps')).toBeTruthy());

    fireEvent.press(getByText('Next'));
    await waitFor(() => expect(getByText('POIs')).toBeTruthy());

    fireEvent.press(getByText('Next'));
    await waitFor(() => expect(getByText('Calendar integration')).toBeTruthy());

    fireEvent.press(getByText('Start Exploring'));

    await waitFor(() => {
      expect(mockSetItemAsync).toHaveBeenCalledWith('has_seen_onboarding_v1', 'true');
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/Map');
    });
  });

  /**
   * Test: Verifies that returning users are redirected directly to the map.
   */
  it('redirects returning users to the main screen', async () => {
    mockGetItemAsync.mockResolvedValue('true');

    render(<WelcomeScreen />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/Map');
    });
  });
});
