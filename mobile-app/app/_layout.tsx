import { Stack } from 'expo-router'
import { LogBox } from 'react-native'
import { TamaguiProvider, Theme } from 'tamagui'
import config from '../tamagui.config'
import React from 'react'

LogBox.ignoreAllLogs()

export default function RootLayout() {
  return (
    <TamaguiProvider config={config}>
      <Theme name="light">
        <Stack screenOptions={{ headerShown: false }} />
      </Theme>
    </TamaguiProvider>

  )
}
