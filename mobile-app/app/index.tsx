import { Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Button, Text, YStack, Spacer } from 'tamagui'
import React from 'react'

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <YStack flex={1} backgroundColor="$background">

      <Image
        source={require('../assets/images/Concordia.png')}
        style={{
          width: '100%',
          height: 220,
          resizeMode: 'contain',
          marginTop: 30
        }}
      />

      <YStack
        flex={1}
        alignItems="center"
        paddingHorizontal="$6"
        paddingTop="$13"
      >
        <Text fontSize="$10" fontWeight="$bold" color="$cred">
          Campus Guide
        </Text>

        <Spacer size="$6" />

        <Text
          fontSize="$5"
          textAlign="center"
          color="$cred"
        >
          Navigate campus effortlessly with interactive maps and real-time directions
        </Text>

        <Spacer flex />

        <Button
          size="$5"
          borderRadius="$10"
          backgroundColor="$cred"
          color="white"
          paddingHorizontal="$8"
          marginBottom="$10"
          //Press effect for button
          pressStyle={{
            opacity: 0.7,       // fades the button a bit on press
            scale: 0.95,        // makes it slightly smaller
          }}
          onPress={() => router.push('../(tabs)/Map')}
        >
          Get Started
        </Button>
      </YStack>
    </YStack>
  )
}
