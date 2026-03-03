import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ClassesCalendarRequired from '../components/ClassesCalendarRequired';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockOpenURL = jest.fn();
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: mockOpenURL,
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => {
  const { View } = require('react-native');
  return { default: (props: any) => <View testID="icon" {...props} /> };
});

jest.mock('../constants/calendar', () => ({
  CALENDAR_INSTRUCTIONS_VIDEO_URL: '',
}));

describe('ClassesCalendarRequired', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the warning title when Classes calendar is not found', () => {
    const { getByText } = render(<ClassesCalendarRequired onConnectCalendar={jest.fn()} />);
    expect(getByText('Classes calendar not found')).toBeTruthy();
  });

  it('renders the warning message explaining the need for Classes calendar', () => {
    const { getByText } = render(<ClassesCalendarRequired onConnectCalendar={jest.fn()} />);
    expect(getByText(/You need to connect your Google Calendar named/)).toBeTruthy();
    expect(getByText(/Classes/)).toBeTruthy();
  });

  it('renders setup instructions section', () => {
    const { getByText } = render(<ClassesCalendarRequired onConnectCalendar={jest.fn()} />);
    expect(getByText('Setup instructions')).toBeTruthy();
    expect(getByText(/Create a calendar named/)).toBeTruthy();
    expect(getByText(/Secret address in iCal format/)).toBeTruthy();
  });

  it('renders "View full setup instructions" button', () => {
    const { getByLabelText } = render(<ClassesCalendarRequired onConnectCalendar={jest.fn()} />);
    expect(getByLabelText('View full setup instructions')).toBeTruthy();
  });

  it('calls router.push with /google-calendar-instructions when View full setup instructions is pressed', () => {
    const { getByLabelText } = render(<ClassesCalendarRequired onConnectCalendar={jest.fn()} />);
    fireEvent.press(getByLabelText('View full setup instructions'));
    expect(mockPush).toHaveBeenCalledWith('/google-calendar-instructions');
  });

  it('renders "Connect calendar" button', () => {
    const { getByLabelText } = render(<ClassesCalendarRequired onConnectCalendar={jest.fn()} />);
    expect(getByLabelText('Connect calendar')).toBeTruthy();
  });

  it('calls onConnectCalendar when Connect calendar is pressed', () => {
    const onConnectCalendar = jest.fn();
    const { getByLabelText } = render(
      <ClassesCalendarRequired onConnectCalendar={onConnectCalendar} />,
    );
    fireEvent.press(getByLabelText('Connect calendar'));
    expect(onConnectCalendar).toHaveBeenCalledTimes(1);
  });

  it('has testID classes-calendar-required for detection', () => {
    const { getByTestId } = render(<ClassesCalendarRequired onConnectCalendar={jest.fn()} />);
    expect(getByTestId('classes-calendar-required')).toBeTruthy();
  });

  it('does not render video button when CALENDAR_INSTRUCTIONS_VIDEO_URL is not set', () => {
    const { queryByLabelText } = render(<ClassesCalendarRequired onConnectCalendar={jest.fn()} />);
    expect(queryByLabelText('Watch the instructions video')).toBeNull();
  });
});
