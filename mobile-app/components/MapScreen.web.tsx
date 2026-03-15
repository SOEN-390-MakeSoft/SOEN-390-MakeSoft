import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function MapScreen() {
  return (
    <View style={styles.container} testID="map-screen">
      <Text style={styles.title}>Map is not available on web</Text>
      <Text style={styles.subtitle}>Open this screen on iOS or Android.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f6f6f6',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2b2b2b',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b6b6b',
    textAlign: 'center',
  },
});
