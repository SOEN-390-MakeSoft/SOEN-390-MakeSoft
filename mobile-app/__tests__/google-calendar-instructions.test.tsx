import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import GoogleCalendarInstructionsScreen from '../app/google-calendar-instructions';

// Mocks
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ name, ...props }: any) =>
      React.createElement(View, { testID: `icon-${name}`, ...props }),
  };
});

// Stub image assets so require() doesn't fail in Jest
jest.mock('../assets/calendar_instructions/export_schedule.png', () => 'export_schedule', {
  virtual: true,
});
jest.mock('../assets/calendar_instructions/copy_classes.png', () => 'copy_classes', {
  virtual: true,
});
jest.mock('../assets/calendar_instructions/access_ical.png', () => 'access_ical', {
  virtual: true,
});
jest.mock('../assets/calendar_instructions/ical.png', () => 'ical', { virtual: true });

// Allow individual tests to control the video URL value
let mockVideoUrl = '';
jest.mock('../constants/calendar', () => ({
  get CALENDAR_INSTRUCTIONS_VIDEO_URL() {
    return mockVideoUrl;
  },
}));

jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GoogleCalendarInstructionsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVideoUrl = '';
  });

  //  Back navigation

  it('calls router.back() when the back button is pressed', () => {
    const { getByTestId } = render(<GoogleCalendarInstructionsScreen />);
    fireEvent.press(getByTestId('back-button'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  // External link

  it('opens the Chrome extension URL when the step-1 link is pressed', async () => {
    const { getByText } = render(<GoogleCalendarInstructionsScreen />);
    fireEvent.press(getByText('extension'));
    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://chromewebstore.google.com/detail/visual-schedule-builder-e/nbapggbchldhdjckbhdhkhlodokjdoha?pli=1',
      );
    });
  });

  // Video CTA

  it('opens the video URL when the video CTA is pressed', async () => {
    mockVideoUrl = 'https://www.youtube.com/watch?v=test';
    const { getByTestId } = render(<GoogleCalendarInstructionsScreen />);
    fireEvent.press(getByTestId('video-cta-button'));
    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith('https://www.youtube.com/watch?v=test');
    });
  });

  // Image modal

  it('opens the image modal when an image is pressed', () => {
    const { getByTestId, queryByTestId } = render(<GoogleCalendarInstructionsScreen />);
    // step index 1 is step 2 (export_schedule.png) — first step with an image
    expect(queryByTestId('modal-close-button')).toBeNull();
    fireEvent.press(getByTestId('step-image-1'));
    expect(getByTestId('modal-close-button')).toBeTruthy();
  });

  it('closes the image modal when the close button is pressed', () => {
    const { getByTestId, queryByTestId } = render(<GoogleCalendarInstructionsScreen />);
    fireEvent.press(getByTestId('step-image-1'));
    expect(getByTestId('modal-close-button')).toBeTruthy();
    fireEvent.press(getByTestId('modal-close-button'));
    expect(queryByTestId('modal-close-button')).toBeNull();
  });
});
