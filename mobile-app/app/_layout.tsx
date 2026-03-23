import { Stack, usePathname } from 'expo-router';
import { LogBox } from 'react-native';
import { TamaguiProvider, Theme } from 'tamagui';
import config from '../tamagui.config';
import React, { useEffect } from 'react';
import { SettingsProvider } from '../context/settings';
import { initializeClarity, trackClarityScreen } from '../services/clarity';

LogBox.ignoreAllLogs();

function ClarityBootstrap() {
  const pathname = usePathname();

  useEffect(() => {
    initializeClarity();
  }, []);

  useEffect(() => {
    trackClarityScreen(pathname);
  }, [pathname]);

  return null;
}

export default function RootLayout() {
  return (
    <TamaguiProvider config={config}>
      <Theme name="light">
        <SettingsProvider>
          <ClarityBootstrap />
          <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="menu" options={{ animation: 'slide_from_left' }} />
          </Stack>
        </SettingsProvider>
      </Theme>
    </TamaguiProvider>
  );
}
