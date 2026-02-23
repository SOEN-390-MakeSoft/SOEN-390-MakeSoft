import React from 'react';
import { Platform, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Switch, Text, XStack, YStack, useTheme } from 'tamagui';
import { useSettings } from '../context/settings';

export default function MenuScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { colourBlindMode, setColourBlindMode } = useSettings();
  const { height } = useWindowDimensions();
  const topOffset =
    Platform.OS === 'ios'
      ? Math.max(16, Math.round(height * 0.09))
      : Math.max(12, Math.round(height * 0.04));
  const red = theme.cred ? theme.cred.get() : '#912338';
  const switchTrackColor = colourBlindMode ? red : '#D1D5DB';

  return (
    <YStack flex={1} backgroundColor="$background" padding="$5" paddingTop={topOffset} gap="$5">
      <XStack alignItems="center" justifyContent="center">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          style={{ position: 'absolute', left: 0 }}
        >
          <MaterialIcons
            name="chevron-left"
            size={28}
            color={theme.cred ? theme.cred.get() : '#912338'}
          />
        </Pressable>
        <Text fontSize={22} fontWeight="700">
          Menu
        </Text>
      </XStack>

      <YStack gap="$3" backgroundColor="white" borderRadius="$4" padding="$4">
        <XStack alignItems="center" justifyContent="space-between">
          <XStack alignItems="center" gap="$2">
            <MaterialIcons
              name="visibility"
              size={20}
              color={theme.cred ? theme.cred.get() : '#912338'}
            />
            <Text>Colour blind mode</Text>
          </XStack>
          <Switch
            checked={colourBlindMode}
            onCheckedChange={setColourBlindMode}
            backgroundColor={switchTrackColor}
            borderColor={switchTrackColor}
            width={64}
            height={28}
            animation="quick"
            animateOnly={['transform']}
          >
            <Switch.Thumb backgroundColor="#FFFFFF" animation="quick" animateOnly={['transform']} />
          </Switch>
        </XStack>
      </YStack>
    </YStack>
  );
}
