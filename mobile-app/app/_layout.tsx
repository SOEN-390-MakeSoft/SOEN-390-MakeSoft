import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { LogBox } from 'react-native';
import Smartlook from 'react-native-smartlook-analytics';
import { TamaguiProvider, Theme } from 'tamagui';
import config from '../tamagui.config';
import { SettingsProvider } from '../context/settings';

LogBox.ignoreAllLogs();

export default function RootLayout() {
  useEffect(() => {
    async function initSmartlook() {
      const key = process.env.EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY;
      if (!key) {
        console.warn('Smartlook disabled: EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY is missing.');
        return;
      }

      try {
        if (__DEV__) {
          await Smartlook.instance.enableLogs();
        }
        await Smartlook.instance.preferences.setProjectKey(key);
        await Smartlook.instance.start();

        if (__DEV__) {
          const isRecording = await Smartlook.instance.state.isRecording();
          console.log(`Smartlook started – recording: ${isRecording}`);
        }
      } catch (error) {
        console.warn('Smartlook initialization failed:', error);
      }
    }

    initSmartlook();
  }, []);

  return (
    <TamaguiProvider config={config}>
      <Theme name="light">
        <SettingsProvider>
          <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="menu" options={{ animation: 'slide_from_left' }} />
          </Stack>
        </SettingsProvider>
      </Theme>
    </TamaguiProvider>
  );
}
