import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from 'tamagui';

type CampusSwitchProps = Readonly<{
  selectedCampus: 'SGW' | 'Loyola';
  onCampusChange: (campus: 'SGW' | 'Loyola') => void;
}>;

export default function CampusSwitch({ selectedCampus, onCampusChange }: CampusSwitchProps) {
  const theme = useTheme();
  const activeColor = theme.cred ? theme.cred.get() : '#912338';

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => onCampusChange('SGW')}
        testID="campus-btn-sgw"
        style={[
          styles.button,
          styles.leftButton,
          selectedCampus === 'SGW' && { backgroundColor: activeColor },
        ]}
      >
        <Text style={[styles.text, selectedCampus === 'SGW' && styles.activeText]}>SGW</Text>
      </Pressable>
      <Pressable
        onPress={() => onCampusChange('Loyola')}
        testID="campus-btn-loyola"
        style={[
          styles.button,
          styles.rightButton,
          selectedCampus === 'Loyola' && { backgroundColor: activeColor },
        ]}
      >
        <Text style={[styles.text, selectedCampus === 'Loyola' && styles.activeText]}>Loyola</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftButton: {
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  rightButton: {
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeText: {
    color: '#fff',
  },
});
