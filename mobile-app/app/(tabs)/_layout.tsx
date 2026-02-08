import { Tabs } from 'expo-router'
import React from 'react'

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}>
    <Tabs.Screen name="Map" />
    </Tabs>
  )
}
