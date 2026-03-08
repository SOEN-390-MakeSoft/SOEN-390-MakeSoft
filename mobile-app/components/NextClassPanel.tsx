import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Entypo from '@expo/vector-icons/Entypo';
import NextClassModal from './NextClassModal';
import type { CalendarEvent } from '../hooks/usePublicCalendar';

type NextClassPanelProps = {
  isVisible: boolean;
  isCalendarConnected: boolean;
  nextEvent: CalendarEvent | null;
  onOpenCalendarConnect: () => void;
  children: (openPanel: () => void) => React.ReactNode;
};

export default function NextClassPanel({
  isVisible,
  isCalendarConnected,
  nextEvent,
  onOpenCalendarConnect,
  children,
}: Readonly<NextClassPanelProps>) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);
  const handleOpenCalendarConnect = useCallback(() => {
    setIsPanelOpen(false);
    onOpenCalendarConnect();
  }, [onOpenCalendarConnect]);

  return (
    <>
      {children(openPanel)}

      {isVisible && nextEvent ? (
        <Pressable
          testID="next-class-info-button"
          style={styles.courseInfoButton}
          onPress={openPanel}
          accessibilityLabel="Show next class information"
        >
          <Entypo name="info-with-circle" color="#c41230" size={24} />
        </Pressable>
      ) : null}

      <NextClassModal
        visible={isPanelOpen}
        isCalendarConnected={isCalendarConnected}
        nextEvent={nextEvent}
        onClose={closePanel}
        onOpenCalendarConnect={handleOpenCalendarConnect}
      />
    </>
  );
}

const styles = StyleSheet.create({
  courseInfoButton: {
    position: 'absolute',
    bottom: 230,
    left: '50%',
    marginLeft: -110,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d8d8d8',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
});
