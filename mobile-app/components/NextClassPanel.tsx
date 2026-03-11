import React, { useCallback, useState } from 'react';
import NextClassModal from './NextClassModal';
import type { CalendarEvent } from '../hooks/usePublicCalendar';

type NextClassPanelProps = {
  isVisible: boolean;
  isCalendarConnected: boolean;
  nextEvent: CalendarEvent | null;
  onOpenCalendarConnect: () => void;
  children: (openPanel: () => void, showNextClassInfo: boolean) => React.ReactNode;
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

  const showNextClassInfo = isVisible && nextEvent !== null;

  return (
    <>
      {children(openPanel, showNextClassInfo)}

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
