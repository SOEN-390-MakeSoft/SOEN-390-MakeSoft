import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text, YStack, XStack } from 'tamagui';
import type { MainBuilding } from '@/constants/campusBuildings';
import { ConcordiaRed, ConcordiaRedMuted } from '@/constants/theme';

interface BuildingInfoModalProps {
  visible: boolean;
  building: MainBuilding | null;
  onClose: () => void;
}

export default function BuildingInfoModal({
  visible,
  building,
  onClose,
}: Readonly<BuildingInfoModalProps>) {
  if (!building) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.cardAccent} />
          <YStack padding="$4" gap="$3">
            <XStack justifyContent="space-between" alignItems="flex-start" gap="$3">
              <Text fontSize="$6" fontWeight="bold" style={styles.title} flex={1}>
                {building.name}
              </Text>
              <View style={styles.codeBadge}>
                <Text fontSize="$2" fontWeight="600" style={styles.codeText}>
                  {building.code}
                </Text>
              </View>
            </XStack>
            {building.description ? (
              <Text fontSize="$3" style={styles.description} lineHeight={22}>
                {building.description}
              </Text>
            ) : null}
            <Text fontSize="$2" style={styles.hint} marginTop="$2">
              Tap outside to close
            </Text>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: ConcordiaRed,
  },
  title: {
    color: '#11181C',
  },
  codeBadge: {
    backgroundColor: ConcordiaRedMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ConcordiaRed,
  },
  codeText: {
    color: ConcordiaRed,
  },
  description: {
    color: '#444',
  },
  hint: {
    color: '#687076',
  },
});
