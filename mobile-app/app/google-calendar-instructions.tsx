import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Linking,
  Alert,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { CALENDAR_INSTRUCTIONS_VIDEO_URL } from '../constants/calendar';

const steps = [
  {
    text: 'Download the “Visual Schedule Builder Export” Chrome extension:',
    link: 'https://chromewebstore.google.com/detail/visual-schedule-builder-e/nbapggbchldhdjckbhdhkhlodokjdoha?pli=1',
    linkLabel: 'extension',
  },
  {
    text: 'Go to your Visual Schedule Builder in Concordia Student Center. Click Export in the Visual Class Schedule Builder.This exports your classes into your Google Calendar.',
    image: require('../assets/calendar_instructions/export_schedule.png'),
  },
  {
    text: 'In Google Calendar, create a new calendar named Classes.',
  },
  {
    text: 'Copy/move your class events into the Classes calendar: Open an event → tap the 3 dots → choose Move to “Classes”.',
    image: require('../assets/calendar_instructions/copy_classes.png'),
  },
  {
    text: 'Navigate to the Classes calendar in Google Calendar.',
  },
  {
    text: 'Open Settings and sharing from the calendar’s three-dot menu.',
    image: require('../assets/calendar_instructions/access_ical.png'),
  },
  {
    text: 'Scroll down and copy the Secret address in iCal format.',
    image: require('../assets/calendar_instructions/ical.png'),
  },
  {
    text: 'In the mobile app: Tap the Concordia logo (top-right of the main page) → paste the key to securely connect your calendar. You should then see a list of upcoming events.',
  },
];

export default function GoogleCalendarInstructionsScreen() {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalImage, setModalImage] = useState<any>(null);

  const handleCopy = (text: string) => {
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      Alert.alert('Copied!', 'Link copied to clipboard.');
    } else {
      Alert.alert('Copy not supported', 'Please copy the link manually.');
    }
  };

  const openImage = (img: any) => {
    setModalImage(img);
    setModalVisible(true);
  };
  const closeImage = () => {
    setModalVisible(false);
    setModalImage(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          testID="back-button"
        >
          <MaterialIcons name="chevron-left" size={28} color="#912338" />
        </Pressable>
        <Text style={styles.title}>Connect Google Calendar</Text>
      </View>
      <Text style={styles.intro}>
        Follow these steps to sync your Concordia schedule with the app.
      </Text>
      {CALENDAR_INSTRUCTIONS_VIDEO_URL ? (
        <Pressable
          style={styles.videoCta}
          onPress={() => Linking.openURL(CALENDAR_INSTRUCTIONS_VIDEO_URL)}
          accessibilityLabel="Watch the instructions video"
          testID="video-cta-button"
        >
          <MaterialIcons name="play-circle-filled" size={24} color="#912338" />
          <Text style={styles.videoCtaText}>Watch the instructions video</Text>
        </Pressable>
      ) : null}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {steps.map((step, idx) => (
          <View key={idx} style={styles.card}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepNumber}>{idx + 1}.</Text>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
            {step.link && (
              <View style={styles.linkRow}>
                <Pressable onPress={() => Linking.openURL(step.link)}>
                  <Text style={styles.linkText}>{step.linkLabel || step.link}</Text>
                </Pressable>
              </View>
            )}
            {step.image && (
              <Pressable onPress={() => openImage(step.image)} testID={`step-image-${idx}`}>
                <Image source={step.image} style={styles.image} resizeMode="contain" />
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImage}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackground} activeOpacity={1} onPress={closeImage} />
          <View style={styles.modalContent}>
            <Pressable
              onPress={closeImage}
              style={styles.modalClose}
              accessibilityLabel="Close image"
              testID="modal-close-button"
            >
              <MaterialIcons name="close" size={32} color="#fff" />
            </Pressable>
            {modalImage && (
              <Image source={modalImage} style={styles.modalImage} resizeMode="contain" />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f1f4' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 12,
    paddingHorizontal: 18,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: { marginRight: 10 },
  title: { fontSize: 22, fontWeight: '700', color: '#1c1c1e' },
  intro: {
    fontSize: 16,
    color: '#6a6a6a',
    marginHorizontal: 18,
    marginBottom: 10,
    marginTop: 8,
  },
  videoCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 18,
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  videoCtaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#912338',
  },
  scrollContent: { padding: 18, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  stepNumber: { fontWeight: 'bold', fontSize: 18, color: '#912338', marginRight: 8 },
  stepText: { fontSize: 16, color: '#222', flex: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  linkText: { color: '#1a0dab', textDecorationLine: 'underline', fontSize: 15, marginRight: 8 },
  copyButton: { padding: 4 },
  image: {
    width: '100%',
    height: 180,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#f3f3f3',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    width: '90%',
    height: '70%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    overflow: 'hidden',
  },
  modalImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#222',
  },
  modalClose: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 2,
  },
});
