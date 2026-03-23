import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { CLARITY_ENABLE_VERBOSE_LOGGING, CLARITY_PROJECT_ID } from '../../constants/clarity';

let clarityModulePromise: Promise<typeof import('@microsoft/react-native-clarity')> | null = null;
let hasInitialized = false;
let hasWarnedAboutExpoGo = false;
let hasWarnedAboutMissingProjectId = false;
let hasLoggedSessionStart = false;
let lastTrackedScreenName: string | null = null;

function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test';
}

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function loadClarity() {
  if (!clarityModulePromise) {
    clarityModulePromise = Promise.resolve(
      require('@microsoft/react-native-clarity') as typeof import('@microsoft/react-native-clarity'),
    );
  }

  return clarityModulePromise;
}

function warnOnceForMissingProjectId() {
  if (isTestEnvironment() || hasWarnedAboutMissingProjectId) {
    return;
  }

  hasWarnedAboutMissingProjectId = true;
  console.warn(
    '[Clarity] EXPO_PUBLIC_CLARITY_PROJECT_ID is not set. Skipping Clarity initialization.',
  );
}

function warnOnceForExpoGo() {
  if (isTestEnvironment() || hasWarnedAboutExpoGo) {
    return;
  }

  hasWarnedAboutExpoGo = true;
  console.warn(
    '[Clarity] Expo Go does not load native Clarity modules. Use a development build instead.',
  );
}

function buildScreenName(pathname: string | null): string {
  if (!pathname || pathname === '/') {
    return 'index';
  }

  return pathname.replace(/^\/+|\/+$/g, '') || 'index';
}

function canUseNativeClarity(): boolean {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return false;
  }

  if (!CLARITY_PROJECT_ID) {
    warnOnceForMissingProjectId();
    return false;
  }

  if (isExpoGo()) {
    warnOnceForExpoGo();
    return false;
  }

  return true;
}

export function initializeClarity(): void {
  if (hasInitialized || !canUseNativeClarity()) {
    return;
  }

  hasInitialized = true;

  void loadClarity()
    .then((Clarity) => {
      Clarity.initialize(CLARITY_PROJECT_ID!, {
        logLevel: CLARITY_ENABLE_VERBOSE_LOGGING ? Clarity.LogLevel.Verbose : Clarity.LogLevel.None,
      });

      if (CLARITY_ENABLE_VERBOSE_LOGGING && !hasLoggedSessionStart) {
        hasLoggedSessionStart = true;
        Clarity.setOnSessionStartedCallback((sessionId) => {
          console.info(`[Clarity] Session started: ${String(sessionId)}`);
        });
      }

      if (lastTrackedScreenName) {
        void Clarity.setCurrentScreenName(lastTrackedScreenName);
      }
    })
    .catch((error) => {
      hasInitialized = false;
      console.warn('[Clarity] Failed to load the native SDK.', error);
    });
}

export function trackClarityScreen(pathname: string | null): void {
  const screenName = buildScreenName(pathname);

  if (screenName === lastTrackedScreenName) {
    return;
  }

  lastTrackedScreenName = screenName;

  if (!hasInitialized || !canUseNativeClarity()) {
    return;
  }

  void loadClarity()
    .then((Clarity) => Clarity.setCurrentScreenName(screenName))
    .catch((error) => {
      console.warn('[Clarity] Failed to update the current screen name.', error);
    });
}
