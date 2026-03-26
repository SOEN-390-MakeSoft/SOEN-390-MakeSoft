import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { CalendarEvent } from '../hooks/usePublicCalendar';
import { trackCalendarConnected, trackCalendarDisconnected } from '../services/analytics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatEventTime(event: CalendarEvent): string {
  const startStr = event.start.dateTime ?? event.start.date ?? '';
  const endStr = event.end.dateTime ?? event.end.date ?? '';

  if (event.start.date && !event.start.dateTime) {
    return 'All day';
  }

  try {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const dateOpts: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    };
    const timeOpts: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
    };
    const datePart = start.toLocaleDateString(undefined, dateOpts);
    const startTime = start.toLocaleTimeString(undefined, timeOpts);
    const endTime = end.toLocaleTimeString(undefined, timeOpts);
    return `${datePart}  •  ${startTime} – ${endTime}`;
  } catch {
    return startStr;
  }
}

// ---------------------------------------------------------------------------
// Event row (extracted to avoid nested component)
// ---------------------------------------------------------------------------
interface CalendarEventRowProps {
  event: CalendarEvent;
}

function CalendarEventRow({ event }: Readonly<CalendarEventRowProps>) {
  return (
    <View style={styles.eventRow}>
      <View style={styles.eventDot} />
      <View style={styles.eventInfo}>
        <Text style={styles.eventName} numberOfLines={2}>
          {event.summary}
        </Text>
        <Text style={styles.eventTime} numberOfLines={1}>
          {formatEventTime(event)}
        </Text>
        {event.location ? (
          <Text style={styles.eventLocation} numberOfLines={1}>
            📍 {event.location}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function CalendarListSeparator() {
  return <View style={styles.separator} />;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface CalendarModalProps {
  visible: boolean;
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  onClose: () => void;
  onConnect: (link: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function CalendarModal({
  visible,
  events,
  loading,
  error,
  isConnected,
  onClose,
  onConnect,
  onDisconnect,
}: Readonly<CalendarModalProps>) {
  const [link, setLink] = useState('');

  const handleConnect = async () => {
    Keyboard.dismiss();
    await onConnect(link.trim());
    trackCalendarConnected();
  };

  const handleDisconnect = async () => {
    setLink('');
    await onDisconnect();
    trackCalendarDisconnected();
  };

  let connectedEventsContent: React.ReactNode = null;
  if (isConnected && !loading) {
    if (events.length === 0) {
      connectedEventsContent = (
        <View style={styles.centered}>
          <MaterialIcons name="event-busy" size={48} color="#999" />
          <Text style={styles.emptyText}>No upcoming events.</Text>
        </View>
      );
    } else {
      connectedEventsContent = (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          // TODO: Display event description (item.description) and allow tapping
          // to view full event details. Currently only titles are rendered as placeholders.
          renderItem={({ item }) => <CalendarEventRow event={item} />}
          ItemSeparatorComponent={CalendarListSeparator}
        />
      );
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.overlay}>
            <View style={styles.container}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>My Calendar</Text>
                <Pressable onPress={onClose} accessibilityLabel="Close" style={styles.closeButton}>
                  <MaterialIcons name="close" size={24} color="#333" />
                </Pressable>
              </View>

              {/* Error */}
              {error ? (
                <View style={styles.errorBox}>
                  <MaterialIcons name="error-outline" size={18} color="#912338" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Not connected — show paste input */}
              {!isConnected ? (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.connectSection}
                >
                  <Text style={styles.instructions}>
                    Paste your Google Calendar <Text style={styles.bold}>secret iCal address</Text>{' '}
                    below.
                  </Text>
                  <Text style={styles.hint}>
                    In Google Calendar → Settings → your calendar → Integrate calendar → copy the{' '}
                    &ldquo;Secret address in iCal format&rdquo;. No need to make your calendar
                    public.
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://calendar.google.com/calendar/..."
                    placeholderTextColor="#999"
                    value={link}
                    onChangeText={setLink}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    returnKeyType="go"
                    onSubmitEditing={handleConnect}
                    multiline={false}
                    testID="calendar-link-input"
                    accessibilityLabel="Calendar link input"
                  />
                  <Pressable
                    style={[styles.connectButton, !link.trim() && styles.connectButtonDisabled]}
                    onPress={handleConnect}
                    disabled={!link.trim() || loading}
                    testID="calendar-connect-button"
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <MaterialIcons name="link" size={18} color="#fff" />
                        <Text style={styles.connectButtonText}>Connect Calendar</Text>
                      </>
                    )}
                  </Pressable>
                </ScrollView>
              ) : null}

              {/* Loading (when connected) */}
              {loading && isConnected ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color="#912338" />
                  <Text style={styles.loadingText}>Loading events…</Text>
                </View>
              ) : null}

              {/* Connected — show events */}
              {connectedEventsContent}

              {/* Disconnect button */}
              {isConnected ? (
                <Pressable style={styles.disconnectButton} onPress={handleDisconnect}>
                  <MaterialIcons name="link-off" size={18} color="#fff" />
                  <Text style={styles.disconnectText}>Disconnect Calendar</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#912338',
  },
  closeButton: {
    padding: 4,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#912338',
  },
  connectSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  instructions: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
  hint: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
    lineHeight: 18,
  },
  input: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222',
    backgroundColor: '#fafafa',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 13,
    backgroundColor: '#912338',
    borderRadius: 10,
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    color: '#999',
  },
  list: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  eventDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#912338',
    marginRight: 12,
    marginTop: 5,
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2b2b2b',
  },
  eventTime: {
    fontSize: 13,
    color: '#666',
    marginTop: 3,
  },
  eventLocation: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: '#912338',
    borderRadius: 10,
  },
  disconnectText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
