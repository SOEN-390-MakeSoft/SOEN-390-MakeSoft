import { Stack } from 'expo-router'
import { LogBox } from 'react-native'
import { TamaguiProvider, Theme } from 'tamagui'
import config from '../tamagui.config'
import React from 'react'
import { SettingsProvider } from '../context/settings'

LogBox.ignoreAllLogs()

export default function RootLayout() {
  return (
    <TamaguiProvider config={config}>
      <Theme name="light">
        <SettingsProvider>
          <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="menu"
              options={{ animation: "slide_from_left" }}
            />
          </Stack>
        </SettingsProvider>
      </Theme>
    </TamaguiProvider>

  )
}
