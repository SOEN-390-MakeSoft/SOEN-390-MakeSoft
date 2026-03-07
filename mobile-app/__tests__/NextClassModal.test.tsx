import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import NextClassModal from '../components/NextClassModal';
import type { CalendarEvent } from '../hooks/usePublicCalendar';

describe('NextClassModal', () => {
  const baseProps = {
    visible: true,
    isCalendarConnected: true,
    nextEvent: null as CalendarEvent | null,
    onClose: jest.fn(),
    onOpenCalendarConnect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-07T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows connect state when calendar is not connected', () => {
    const { getByText } = render(<NextClassModal {...baseProps} isCalendarConnected={false} />);

    expect(getByText('Calendar Not Connected')).toBeTruthy();
    fireEvent.press(getByText('Connect Calendar'));
    expect(baseProps.onOpenCalendarConnect).toHaveBeenCalledTimes(1);
  });

  it('shows no-upcoming-class state when connected but next event is missing', () => {
    const { getByText } = render(
      <NextClassModal {...baseProps} isCalendarConnected nextEvent={null} />,
    );

    expect(getByText('No Upcoming Class')).toBeTruthy();
    fireEvent.press(getByText('Close'));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('renders course, building, room, and relative time for next class', () => {
    const event: CalendarEvent = {
      id: 'evt-1',
      summary: 'SOEN 343',
      location: 'Hall Rm 535',
      start: { dateTime: '2026-03-07T10:18:00.000Z' },
      end: { dateTime: '2026-03-07T11:33:00.000Z' },
    };

    const { getByText } = render(<NextClassModal {...baseProps} nextEvent={event} />);

    expect(getByText('Next Class')).toBeTruthy();
    expect(getByText('SOEN 343')).toBeTruthy();
    expect(getByText('Hall')).toBeTruthy();
    expect(getByText('535')).toBeTruthy();
    expect(getByText('Starts in 18 min')).toBeTruthy();
    expect(getByText('SOEN 343 — Hall Rm 535 — Starts in 18 min')).toBeTruthy();
  });

  it('parses CODE-room format from calendar location', () => {
    const event: CalendarEvent = {
      id: 'evt-2',
      summary: 'COMP 472',
      location: 'H-937',
      start: { dateTime: '2026-03-07T11:00:00.000Z' },
      end: { dateTime: '2026-03-07T12:00:00.000Z' },
    };

    const { getByText } = render(<NextClassModal {...baseProps} nextEvent={event} />);

    expect(getByText('H')).toBeTruthy();
    expect(getByText('937')).toBeTruthy();
  });
});
