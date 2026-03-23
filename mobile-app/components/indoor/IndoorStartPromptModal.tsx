import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';

interface IndoorStartPromptModalProps {
  visible: boolean;
  buildingCode: string;
  levels: string[];
  onSelectLevel: (level: string) => void;
  onCancel: () => void;
}

function getFloorLabel(level: string): string {
  const n = Number(level);
  if (Number.isNaN(n)) return level;
  if (n < 0) return `B${Math.abs(n)}`;
  if (n === 0) return 'G';
  return String(n);
}

export default function IndoorStartPromptModal({
  visible,
  buildingCode,
  levels,
  onSelectLevel,
  onCancel,
}: IndoorStartPromptModalProps) {
  const sortedLevels = [...levels].sort((a, b) => Number(b) - Number(a));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay} testID="floor-select-modal">
        <View style={styles.container}>
          <Text style={styles.title}>You are in {buildingCode}</Text>
          <Text style={styles.subtitle}>Which floor are you currently on?</Text>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {sortedLevels.map((level) => (
              <Pressable
                key={level}
                style={styles.levelButton}
                onPress={() => onSelectLevel(level)}
                android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
                testID={`floor-select-${level}`}
                accessibilityLabel={`Select floor ${getFloorLabel(level)}`}
              >
                <Text style={styles.levelText}>Floor {getFloorLabel(level)}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    maxHeight: '70%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  list: {
    maxHeight: 250,
  },
  listContent: {
    paddingBottom: 10,
  },
  levelButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginVertical: 4,
    alignItems: 'center',
  },
  levelText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#8e2334', // SGW primary color for consistency
    fontWeight: 'bold',
  },
});
