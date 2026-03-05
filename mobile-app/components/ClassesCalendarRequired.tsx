import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { CALENDAR_INSTRUCTIONS_VIDEO_URL } from '../constants/calendar';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ClassesCalendarRequiredProps {
  /** Called when the user taps "Connect calendar" to open the calendar modal */
  onConnectCalendar: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
/**
 * Blocking view shown when the Classes calendar is not found.
 * Displays a warning, setup instructions, and refers the user to the instructions video.
 * The user cannot proceed to use the map until a valid calendar is connected.
 */
export default function ClassesCalendarRequired({
  onConnectCalendar,
}: Readonly<ClassesCalendarRequiredProps>) {
  const router = useRouter();

  const handleOpenInstructions = () => {
    router.push('/google-calendar-instructions');
  };

  const handleOpenVideo = () => {
    if (CALENDAR_INSTRUCTIONS_VIDEO_URL) {
      Linking.openURL(CALENDAR_INSTRUCTIONS_VIDEO_URL);
    }
  };

  return (
    <View style={styles.overlay} testID="classes-calendar-required">
      <View style={styles.card}>
        <View style={styles.warningRow}>
          <MaterialIcons name="warning" size={28} color="#912338" />
          <Text style={styles.warningTitle}>Classes calendar not found</Text>
        </View>
        <Text style={styles.warningMessage}>
          You need to connect your Google Calendar named &ldquo;Classes&rdquo; to use this app.
          Please follow the setup instructions below.
        </Text>

        <Text style={styles.sectionTitle}>Setup instructions</Text>
        <ScrollView
          style={styles.instructionsScroll}
          contentContainerStyle={styles.instructionsContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.instructionStep}>
            1. Create a calendar named &ldquo;Classes&rdquo; in Google Calendar.
          </Text>
          <Text style={styles.instructionStep}>
            2. Copy or move your class events into the Classes calendar.
          </Text>
          <Text style={styles.instructionStep}>
            3. In Google Calendar, open the Classes calendar → Settings and sharing.
          </Text>
          <Text style={styles.instructionStep}>
            4. Copy the &ldquo;Secret address in iCal format&rdquo;.
          </Text>
          <Text style={styles.instructionStep}>
            5. Tap &ldquo;Connect calendar&rdquo; below and paste the address.
          </Text>
        </ScrollView>

        {CALENDAR_INSTRUCTIONS_VIDEO_URL ? (
          <Pressable
            style={styles.videoButton}
            onPress={handleOpenVideo}
            accessibilityLabel="Watch the instructions video"
          >
            <MaterialIcons name="play-circle-outline" size={22} color="#912338" />
            <Text style={styles.videoButtonText}>Watch the instructions video</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={styles.instructionsButton}
          onPress={handleOpenInstructions}
          accessibilityLabel="View full setup instructions"
        >
          <MaterialIcons name="menu-book" size={20} color="#912338" />
          <Text style={styles.instructionsButtonText}>View full setup instructions</Text>
        </Pressable>

        <Pressable
          style={styles.connectButton}
          onPress={onConnectCalendar}
          accessibilityLabel="Connect calendar"
        >
          <MaterialIcons name="link" size={20} color="#fff" />
          <Text style={styles.connectButtonText}>Connect calendar</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 1000,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    width: '100%',
    maxHeight: '85%',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#912338',
    flex: 1,
  },
  warningMessage: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 10,
  },
  instructionsScroll: {
    maxHeight: 160,
  },
  instructionsContent: {
    paddingBottom: 8,
  },
  instructionStep: {
    fontSize: 14,
    color: '#444',
    lineHeight: 22,
    marginBottom: 6,
  },
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
    paddingVertical: 10,
  },
  videoButtonText: {
    fontSize: 15,
    color: '#912338',
    fontWeight: '600',
  },
  instructionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#912338',
    marginTop: 8,
  },
  instructionsButtonText: {
    fontSize: 15,
    color: '#912338',
    fontWeight: '600',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 14,
    backgroundColor: '#912338',
    borderRadius: 10,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
