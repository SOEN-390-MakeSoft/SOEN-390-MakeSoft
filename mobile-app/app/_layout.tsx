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
    const key = process.env.EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY;
    if (!key) return;

    try {
      Smartlook.instance.preferences.setProjectKey(key);
      Smartlook.instance.start();
    } catch (error) {
      console.warn('Smartlook initialization failed:', error);
    }
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
