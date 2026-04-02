import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import Entypo from '@expo/vector-icons/Entypo';
import NextClassPanel from '../components/NextClassPanel';
import type { CalendarEvent } from '../hooks/usePublicCalendar';

jest.mock('../components/NextClassModal', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text, View } = require('react-native');
  return function MockNextClassModal({
    visible,
    onClose,
    onOpenCalendarConnect,
  }: {
    visible: boolean;
    onClose: () => void;
    onOpenCalendarConnect: () => void;
  }) {
    return (
      <View testID="next-class-modal">
        <Text>{visible ? 'visible' : 'hidden'}</Text>
        <Pressable testID="modal-close" onPress={onClose}>
          <Text>Close</Text>
        </Pressable>
        <Pressable testID="modal-open-calendar" onPress={onOpenCalendarConnect}>
          <Text>Open Calendar</Text>
        </Pressable>
      </View>
    );
  };
});

describe('NextClassPanel', () => {
  const nextEvent: CalendarEvent = {
    id: 'evt-1',
    summary: 'SOEN 343',
    location: 'Hall Rm 535',
    start: { dateTime: '2026-03-07T10:18:00.000Z' },
    end: { dateTime: '2026-03-07T11:33:00.000Z' },
  };

  const renderPanel = (props?: Partial<React.ComponentProps<typeof NextClassPanel>>) => {
    return render(
      <NextClassPanel
        isVisible
        isCalendarConnected
        nextEvent={nextEvent}
        onOpenCalendarConnect={jest.fn()}
        {...props}
      >
        {(openPanel, showNextClassInfo) => (
          <>
            <Pressable testID="open-next-class-panel" onPress={openPanel}>
              <Text>Open panel</Text>
            </Pressable>
            {showNextClassInfo && (
              <Pressable testID="next-class-info-button" onPress={openPanel}>
                <Entypo name="info-with-circle" color="#c41230" size={24} />
              </Pressable>
            )}
          </>
        )}
      </NextClassPanel>,
    );
  };

  it('shows next class info button when panel is visible and event exists', () => {
    const { getByTestId } = renderPanel();
    expect(getByTestId('next-class-info-button')).toBeTruthy();
  });

  it('hides next class info button when no event is available', () => {
    const { queryByTestId } = renderPanel({ nextEvent: null });
    expect(queryByTestId('next-class-info-button')).toBeNull();
  });

  it('opens and closes modal via panel trigger callback', () => {
    const { getByTestId, getByText } = renderPanel();
    expect(getByText('hidden')).toBeTruthy();

    fireEvent.press(getByTestId('open-next-class-panel'));
    expect(getByText('visible')).toBeTruthy();

    fireEvent.press(getByTestId('modal-close'));
    expect(getByText('hidden')).toBeTruthy();
  });

  it('opens modal from info button and delegates open-calendar action', () => {
    const onOpenCalendarConnect = jest.fn();
    const { getByTestId, getByText } = renderPanel({ onOpenCalendarConnect });

    fireEvent.press(getByTestId('next-class-info-button'));
    expect(getByText('visible')).toBeTruthy();

    fireEvent.press(getByTestId('modal-open-calendar'));
    expect(onOpenCalendarConnect).toHaveBeenCalledTimes(1);
    expect(getByText('hidden')).toBeTruthy();
  });
});
