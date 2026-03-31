import * as SecureStore from 'expo-secure-store';

const ONBOARDING_STORE_KEY = 'has_seen_onboarding_v1';

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(ONBOARDING_STORE_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function markOnboardingCompleted(): Promise<void> {
  try {
    await SecureStore.setItemAsync(ONBOARDING_STORE_KEY, 'true');
  } catch (error) {
    // Navigation should still continue even if persistence is temporarily unavailable.
    console.warn('Failed to persist onboarding completion state', error);
  }
}

export { ONBOARDING_STORE_KEY };
