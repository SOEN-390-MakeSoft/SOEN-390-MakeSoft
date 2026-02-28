import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CalendarModal from '../components/CalendarModal';
import type { CalendarEvent } from '../hooks/usePublicCalendar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const baseProps = {
  visible: true,
  events: [] as CalendarEvent[],
  loading: false,
  error: null,
  isConnected: false,
  onClose: jest.fn(),
  onConnect: jest.fn().mockResolvedValue(undefined),
  onDisconnect: jest.fn().mockResolvedValue(undefined),
};

const mockEvents: CalendarEvent[] = [
  {
    id: '1',
    summary: 'Team Standup',
    description: 'Daily sync with the dev team',
    location: 'Room 101',
    start: { dateTime: '2026-03-01T09:00:00Z' },
    end: { dateTime: '2026-03-01T09:30:00Z' },
    htmlLink: 'https://calendar.google.com/event?eid=abc',
  },
  {
    id: '2',
    summary: 'Sprint Review',
    description: 'End-of-sprint demo and retrospective',
    location: undefined,
    start: { dateTime: '2026-03-01T14:00:00Z' },
    end: { dateTime: '2026-03-01T15:00:00Z' },
    htmlLink: 'https://calendar.google.com/event?eid=def',
  },
  {
    id: '3',
    summary: 'All-Day Workshop',
    start: { date: '2026-03-02' },
    end: { date: '2026-03-03' },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('CalendarModal', () => {
  beforeEach(() => jest.clearAllMocks());

  // ---- Basic rendering states ----

  it('renders the header title', () => {
    const { getByText } = render(<CalendarModal {...baseProps} />);
    expect(getByText('My Calendar')).toBeTruthy();
  });

  it('shows the connect input when not connected', () => {
    const { getByText, getByPlaceholderText } = render(<CalendarModal {...baseProps} />);
    expect(getByText(/Paste your/)).toBeTruthy();
    expect(getByPlaceholderText('https://calendar.google.com/calendar/...')).toBeTruthy();
  });

  it('shows an error message when error prop is set', () => {
    const { getByText } = render(<CalendarModal {...baseProps} error="Something went wrong" />);
    expect(getByText('Something went wrong')).toBeTruthy();
  });

  it('shows loading indicator when connected and loading', () => {
    const { getByText } = render(<CalendarModal {...baseProps} isConnected loading />);
    expect(getByText('Loading events…')).toBeTruthy();
  });

  it('shows empty state when connected with no events', () => {
    const { getByText } = render(<CalendarModal {...baseProps} isConnected events={[]} />);
    expect(getByText('No upcoming events.')).toBeTruthy();
  });

  // ---- Event list rendering (titles only as placeholders) ----

  it('renders event summaries (titles) as placeholders', () => {
    const { getByText } = render(<CalendarModal {...baseProps} isConnected events={mockEvents} />);
    expect(getByText('Team Standup')).toBeTruthy();
    expect(getByText('Sprint Review')).toBeTruthy();
    expect(getByText('All-Day Workshop')).toBeTruthy();
  });

  it('does NOT render event descriptions (deferred – see TODO)', () => {
    const { queryByText } = render(
      <CalendarModal {...baseProps} isConnected events={mockEvents} />,
    );
    // Descriptions exist in the data but should NOT appear in the UI yet
    expect(queryByText('Daily sync with the dev team')).toBeNull();
    expect(queryByText('End-of-sprint demo and retrospective')).toBeNull();
  });

  it('renders location when provided', () => {
    const { getByText, queryByText } = render(
      <CalendarModal {...baseProps} isConnected events={mockEvents} />,
    );
    // First event has a location
    expect(getByText(/Room 101/)).toBeTruthy();
    // Second event has no location – should not show a stray pin emoji for it
    // (we just verify the first event's location is present)
  });

  it('renders "All day" for all-day events', () => {
    const { getByText } = render(<CalendarModal {...baseProps} isConnected events={mockEvents} />);
    expect(getByText('All day')).toBeTruthy();
  });

  // ---- Interactions ----

  it('calls onClose when the close button is pressed', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(<CalendarModal {...baseProps} onClose={onClose} />);
    fireEvent.press(getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConnect with the trimmed link text', async () => {
    const onConnect = jest.fn().mockResolvedValue(undefined);
    const { getByPlaceholderText, getByText } = render(
      <CalendarModal {...baseProps} onConnect={onConnect} />,
    );

    const input = getByPlaceholderText('https://calendar.google.com/calendar/...');
    fireEvent.changeText(input, '  https://calendar.google.com/calendar/embed?src=test  ');
    fireEvent.press(getByText('Connect Calendar'));

    await waitFor(() => {
      expect(onConnect).toHaveBeenCalledWith('https://calendar.google.com/calendar/embed?src=test');
    });
  });

  it('calls onDisconnect when Disconnect button is pressed', async () => {
    const onDisconnect = jest.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <CalendarModal {...baseProps} isConnected events={mockEvents} onDisconnect={onDisconnect} />,
    );

    fireEvent.press(getByText('Disconnect Calendar'));

    await waitFor(() => {
      expect(onDisconnect).toHaveBeenCalledTimes(1);
    });
  });

  it('disables connect button when input is empty', () => {
    const { getByText } = render(<CalendarModal {...baseProps} />);
    const button = getByText('Connect Calendar').parent?.parent;
    expect(button?.props.accessibilityState?.disabled ?? button?.props.disabled).toBeTruthy();
  });
});
