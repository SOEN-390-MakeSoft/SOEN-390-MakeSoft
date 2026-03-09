import React from 'react';
import {
  Image,
  Pressable,
  Text,
  TextInput,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type SearchResult = {
  id: string;
  name: string;
  address: string | null;
  code: string | null;
  polygon?: readonly { latitude: number; longitude: number }[];
};

interface SearchBarProps {
  searchQuery: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onFocus: () => void;
  onBlur: () => void;
  isSearchFocused: boolean;
  isSearchDisabled: boolean;
  searchResults: SearchResult[];
  onSelectResult: (result: SearchResult) => void;
  onOpenMenu: () => void;
  inputRef: React.RefObject<TextInput | null>;
  brandColor: string;
  logoSource: ImageSourcePropType;
  onLogoPress?: () => void;
}

export default function SearchBar({
  searchQuery,
  onChangeText,
  onSubmit,
  onFocus,
  onBlur,
  isSearchFocused,
  isSearchDisabled,
  searchResults,
  onSelectResult,
  onOpenMenu,
  inputRef,
  brandColor,
  logoSource,
  onLogoPress,
}: Readonly<SearchBarProps>) {
  return (
    <>
      <View style={styles.mapSearchRow}>
        <Pressable style={styles.mapIconButton} accessibilityLabel="Open menu" onPress={onOpenMenu}>
          <MaterialIcons name="menu" size={47} color={brandColor} />
        </Pressable>
        <View style={[styles.mapSearchInputWrap, { borderColor: brandColor }]}>
          <MaterialIcons name="search" size={19} color="#8c8c8c" />
          <TextInput
            ref={inputRef}
            value={searchQuery}
            onChangeText={onChangeText}
            placeholder="Search"
            placeholderTextColor="#9a9a9a"
            style={styles.mapSearchInput}
            returnKeyType="search"
            inputAccessoryViewID="searchBar"
            onSubmitEditing={onSubmit}
            onFocus={onFocus}
            onBlur={onBlur}
            editable={!isSearchDisabled}
            showSoftInputOnFocus={!isSearchDisabled}
          />
          {!!searchQuery && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => onChangeText('')}
              style={styles.mapSearchClear}
            >
              <MaterialIcons name="close" size={16} color="#8c8c8c" />
            </Pressable>
          )}
        </View>
        <Pressable
          style={styles.mapBrandBadge}
          onPress={onLogoPress}
          accessibilityLabel="Google Calendar"
          accessibilityRole="button"
          testID="calendar-open-button"
        >
          <Image source={logoSource} style={styles.mapBrandBadgeImage} resizeMode="contain" />
        </Pressable>
      </View>

      {!isSearchDisabled && isSearchFocused && searchResults.length > 0 && (
        <View style={styles.mapSearchResults}>
          {searchResults.map((result, index) => (
            <Pressable
              key={`${result.id}-${result.name}`}
              style={[
                styles.mapSearchResultItem,
                index < searchResults.length - 1 && styles.mapSearchResultDivider,
              ]}
              onPress={() => onSelectResult(result)}
            >
              <Text style={styles.mapSearchResultTitle} numberOfLines={1}>
                {result.name}
              </Text>
              <Text style={styles.mapSearchResultMeta} numberOfLines={1}>
                {result.code ? `${result.code} Â· ` : ''}
                {result.address ?? 'Address unavailable'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  mapSearchRow: { flexDirection: 'row', alignItems: 'center', columnGap: 11 },
  mapIconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  mapSearchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 26,
    paddingHorizontal: 13,
    height: 52,
    borderWidth: 1,
    borderColor: '#b21b2c',
  },
  mapSearchInput: { flex: 1, fontSize: 17, color: '#2b2b2b', marginLeft: 9 },
  mapSearchClear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapSearchResults: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#d8d8d8',
    overflow: 'hidden',
  },
  mapSearchResultItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  mapSearchResultDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#ececec',
  },
  mapSearchResultTitle: { fontSize: 16, fontWeight: '600', color: '#2b2b2b' },
  mapSearchResultMeta: { fontSize: 14, color: '#6b6b6b', marginTop: 2 },
  mapBrandBadge: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapBrandBadgeImage: { width: 40, height: 40 },
});
