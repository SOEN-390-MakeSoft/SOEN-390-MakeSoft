import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import WelcomeScreen from '../app/index';
import * as SecureStore from 'expo-secure-store';
import { ONBOARDING_STORE_KEY } from '../utils/onboarding';

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
  let warnSpy: jest.SpiedFunction<typeof console.warn>;

  /**
   * Reset mock function calls before each test to ensure test isolation.
   */
  beforeEach(() => {
    mockReplace.mockClear();
    mockGetItemAsync.mockReset();
    mockSetItemAsync.mockReset();
    mockGetItemAsync.mockResolvedValue(null);
    mockSetItemAsync.mockResolvedValue();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
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
      expect(mockSetItemAsync).toHaveBeenCalledWith(ONBOARDING_STORE_KEY, 'true');
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
      expect(mockSetItemAsync).toHaveBeenCalledWith(ONBOARDING_STORE_KEY, 'true');
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/Map');
    });
  });

  it('does not advance past the last slide on rapid next presses', async () => {
    const { getByTestId, getByText } = render(<WelcomeScreen />);

    await waitFor(() => expect(getByText('Navigation & directions')).toBeTruthy());

    fireEvent.press(getByText('Next'));
    await waitFor(() => expect(getByText('Campus switching')).toBeTruthy());

    fireEvent.press(getByText('Next'));
    await waitFor(() => expect(getByText('Indoor maps')).toBeTruthy());

    fireEvent.press(getByText('Next'));
    await waitFor(() => expect(getByText('POIs')).toBeTruthy());

    const nextButton = getByTestId('onboarding-next');
    act(() => {
      fireEvent(nextButton, 'press');
      fireEvent(nextButton, 'press');
    });

    await waitFor(() => {
      expect(getByText('Calendar integration')).toBeTruthy();
      expect(getByText('Start Exploring')).toBeTruthy();
    });

    expect(mockReplace).not.toHaveBeenCalled();
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

  it('exposes an accessible loading state while onboarding status is resolving', () => {
    mockGetItemAsync.mockImplementation(() => new Promise(() => {}));

    const { getByHintText, getByLabelText, getByRole, getByTestId } = render(<WelcomeScreen />);

    expect(getByTestId('onboarding-loading')).toBeTruthy();
    expect(getByRole('progressbar')).toBeTruthy();
    expect(getByLabelText('Loading onboarding')).toBeTruthy();
    expect(getByHintText('Please wait while the onboarding status is being checked.')).toBeTruthy();
  });

  it('continues navigation and warns when onboarding persistence fails', async () => {
    const error = new Error('SecureStore unavailable');
    mockSetItemAsync.mockRejectedValue(error);

    const { getByText } = render(<WelcomeScreen />);

    await waitFor(() => expect(getByText('Skip')).toBeTruthy());
    fireEvent.press(getByText('Skip'));

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith('Failed to persist onboarding completion state', error);
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/Map');
    });
  });
});
