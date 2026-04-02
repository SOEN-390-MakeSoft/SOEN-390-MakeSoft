import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent } from '../hooks/usePublicCalendar';

type NextClassModalProps = Readonly<{
  visible: boolean;
  isCalendarConnected: boolean;
  nextEvent: CalendarEvent | null;
  onClose: () => void;
  onOpenCalendarConnect: () => void;
}>;

const parseLocation = (location?: string): { building: string; room: string } => {
  if (!location) return { building: 'Unknown', room: 'Unknown' };
  const trimmed = location.trim();
  const match1 = /^(.+?)\s+(?:Rm\s+)?(\d+)$/i.exec(trimmed);
  if (match1) return { building: match1[1].trim(), room: match1[2] };
  const match2 = /^([A-Z]+)-(\d+)$/i.exec(trimmed);
  if (match2) return { building: match2[1], room: match2[2] };
  return { building: trimmed, room: 'Unknown' };
};

const getTimeUntilStart = (startTime?: string): string => {
  if (!startTime) return 'Unknown';
  const now = new Date();
  const start = new Date(startTime);
  const diffMs = start.getTime() - now.getTime();
  if (diffMs < 0) return 'Started';
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 60) return `Starts in ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  const remainingMinutes = diffMinutes % 60;
  return remainingMinutes === 0
    ? `Starts in ${diffHours}h`
    : `Starts in ${diffHours}h ${remainingMinutes}m`;
};

export default function NextClassModal({
  visible,
  isCalendarConnected,
  nextEvent,
  onClose,
  onOpenCalendarConnect,
}: NextClassModalProps) {
  let content: React.ReactNode;

  if (isCalendarConnected) {
    if (nextEvent) {
      const { building, room } = parseLocation(nextEvent.location);
      const timeUntil = getTimeUntilStart(nextEvent.start.dateTime ?? nextEvent.start.date);
      const courseName = nextEvent.summary || 'Unknown Course';
      content = (
        <>
          <Text style={styles.modalTitle}>Next Class</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Course:</Text>
            <Text style={styles.value}>{courseName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Building:</Text>
            <Text style={styles.value}>{building}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Room:</Text>
            <Text style={styles.value}>{room}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Time:</Text>
            <Text style={styles.value}>{timeUntil}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>
              {courseName} — {building} {room !== 'Unknown' ? `Rm ${room}` : ''} — {timeUntil}
            </Text>
          </View>
          <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </>
      );
    } else {
      content = (
        <>
          <Text style={styles.modalTitle}>No Upcoming Class</Text>
          <Text style={styles.summaryText}>
            We could not find any current or upcoming timed classes in your calendar.
          </Text>
          <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </>
      );
    }
  } else {
    content = (
      <>
        <Text style={styles.modalTitle}>Calendar Not Connected</Text>
        <Text style={styles.summaryText}>
          Connect your Google Calendar first to view your next class details.
        </Text>
        <Pressable
          style={styles.closeButton}
          onPress={onOpenCalendarConnect}
          accessibilityRole="button"
        >
          <Text style={styles.closeButtonText}>Connect Calendar</Text>
        </Pressable>
      </>
    );
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalContent}>{content}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#c41230',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    width: 90,
  },
  value: {
    fontSize: 16,
    color: '#555',
    flex: 1,
  },
  summaryBox: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#c41230',
  },
  summaryText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    lineHeight: 22,
  },
  closeButton: {
    backgroundColor: '#c41230',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
