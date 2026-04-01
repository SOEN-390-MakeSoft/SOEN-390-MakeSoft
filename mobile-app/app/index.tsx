import { hasCompletedOnboarding, markOnboardingCompleted } from '@/utils/onboarding';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BRAND_COLOR = '#912338';

type OnboardingSlide = {
  title: string;
  description: string;
  image: ImageSourcePropType;
  imageLabel: string;
};

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    title: 'Navigation & directions',
    description:
      'Search for a building, room, or landmark and follow directions across campus with walking or accessible routing.',
    image: require('../assets/onboarding/navigation-directions.png'),
    imageLabel: 'Campus map with buildings highlighted',
  },
  {
    title: 'Campus switching',
    description:
      'Move between Sir George Williams and Loyola using the campus switcher so the map stays focused on the campus you need.',
    image: require('../assets/onboarding/campus-switching.png'),
    imageLabel: 'Campus switcher between SGW and Loyola',
  },
  {
    title: 'Indoor maps',
    description:
      'Open supported buildings to explore floor plans, choose floors, and continue your route inside when outdoor navigation is not enough.',
    image: require('../assets/onboarding/indoor-maps.png'),
    imageLabel: 'Indoor map with floor selector and markers',
  },
  {
    title: 'POIs',
    description:
      'Tap outdoor points of interest to view details and quickly launch directions to the place you need. Check indoor POIs to find amenities like water fountains, bathrooms, and more.',
    image: require('../assets/onboarding/pois.png'),
    imageLabel: 'Point of interest details card with directions button',
  },
  {
    title: 'Calendar integration',
    description:
      'Connect your class calendar to quickly check what is next and jump into directions when it is time to head out.',
    image: require('../assets/onboarding/calendar-integration.png'),
    imageLabel: 'Calendar connection sheet for iCal integration',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadOnboardingState() {
      const completed = await hasCompletedOnboarding();

      if (!isMounted) {
        return;
      }

      if (completed) {
        router.replace('/(tabs)/Map');
        return;
      }

      setIsLoading(false);
    }

    void loadOnboardingState();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const activeSlide = ONBOARDING_SLIDES[currentSlide];
  const isLastSlide = currentSlide === ONBOARDING_SLIDES.length - 1;

  const handleFinish = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    await markOnboardingCompleted();
    router.replace('/(tabs)/Map');
  };

  const handleNext = () => {
    if (isLastSlide) {
      void handleFinish();
      return;
    }

    setCurrentSlide((previous) => Math.min(previous + 1, ONBOARDING_SLIDES.length - 1));
  };

  if (isLoading) {
    return (
      <View
        style={styles.loadingContainer}
        testID="onboarding-loading"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Loading onboarding"
        accessibilityHint="Please wait while the onboarding status is being checked."
      >
        <ActivityIndicator
          size="large"
          color={BRAND_COLOR}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.kicker}>Campus Guide onboarding</Text>
            <Text style={styles.progressLabel}>
              {currentSlide + 1} of {ONBOARDING_SLIDES.length}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => void handleFinish()}
            disabled={isSaving}
            style={({ pressed }) => [styles.skipButton, pressed && styles.buttonPressed]}
            testID="onboarding-skip"
          >
            <Text style={styles.skipText}>{isSaving ? 'Saving...' : 'Skip'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.badge} />

          <View style={styles.imageFrame}>
            <Image
              source={activeSlide.image}
              style={styles.slideImage}
              accessibilityIgnoresInvertColors
              accessibilityLabel={activeSlide.imageLabel}
            />
          </View>

          <Text style={styles.title}>{activeSlide.title}</Text>
          <Text style={styles.description}>{activeSlide.description}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.dotRow} accessibilityLabel="Onboarding progress">
            {ONBOARDING_SLIDES.map((slide, index) => (
              <View
                key={slide.title}
                style={[styles.dot, index === currentSlide ? styles.activeDot : styles.inactiveDot]}
              />
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={handleNext}
            disabled={isSaving}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
            testID="onboarding-next"
          >
            <Text style={styles.primaryButtonText}>{isLastSlide ? 'Start Exploring' : 'Next'}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FCF7F8',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCF7F8',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  kicker: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND_COLOR,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  progressLabel: {
    marginTop: 6,
    fontSize: 15,
    color: '#4D4D4D',
  },
  skipButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F3E5E8',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND_COLOR,
  },
  card: {
    flex: 1,
    marginVertical: 28,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#E7CDD3',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  badge: {
    width: 64,
    height: 8,
    borderRadius: 999,
    marginBottom: 24,
    backgroundColor: BRAND_COLOR,
  },
  imageFrame: {
    width: '100%',
    maxWidth: 260,
    height: 190,
    backgroundColor: '#F8F1F3',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E7CDD3',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  slideImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    color: '#1F1F1F',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 17,
    lineHeight: 26,
    color: '#444444',
    textAlign: 'center',
  },
  footer: {
    gap: 18,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  activeDot: {
    width: 28,
    backgroundColor: BRAND_COLOR,
  },
  inactiveDot: {
    backgroundColor: '#D5D5D5',
  },
  primaryButton: {
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    backgroundColor: BRAND_COLOR,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
