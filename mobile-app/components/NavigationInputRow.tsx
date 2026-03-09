import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface NavigationInputRowProps {
  value: string;
  onChangeText: (text: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  placeholder: string;
  clearLabel: string;
  clearIconColor: string;
  clearButtonBg: string;
  locked?: boolean;
  testID?: string;
}

export default function NavigationInputRow({
  value,
  onChangeText,
  onFocus,
  onBlur,
  icon,
  iconColor,
  placeholder,
  clearLabel,
  clearIconColor,
  clearButtonBg,
  locked = false,
  testID,
}: Readonly<NavigationInputRowProps>) {
  return (
    <View style={styles.routeRow}>
      <MaterialIcons name={icon} size={20} color={iconColor} />
      <View style={styles.inputWrap}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={(text) => {
            if (!locked) onChangeText(text);
          }}
          onFocus={() => {
            if (!locked) onFocus();
          }}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor="#6b6b6b"
          style={[styles.routeInput, locked && styles.routeInputLocked]}
          editable={!locked}
        />
        {!!value && !locked && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            onPress={() => onChangeText('')}
            style={[styles.clearButton, { backgroundColor: clearButtonBg }]}
          >
            <MaterialIcons name="close" size={16} color={clearIconColor} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  routeInput: {
    flex: 1,
    fontSize: 16,
    color: '#1c1c1e',
    fontWeight: '600',
    paddingVertical: 0,
    paddingRight: 40,
  },
  routeInputLocked: {
    color: '#6b6b6b',
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    zIndex: 2,
  },
});
