import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from 'tamagui';
import { useSettings } from '../context/settings';
import { useRouter } from 'expo-router';
import {
  OUTDOOR_POI_CATEGORY_OPTIONS,
  type OutdoorPOICategory,
} from '../services/outdoorPOIService';

interface MapMenuProps {
  visible: boolean;
  onClose: () => void;
  fullScreen?: boolean;
  /** POI amenity types currently visible. */
  visiblePoiAmenities?: string[];
  /** Callback when POI visibility changes. */
  onVisiblePoiAmenitiesChange?: (amenities: string[]) => void;
  /** Currently selected outdoor POI categories. */
  selectedOutdoorPOICategories?: OutdoorPOICategory[];
  /** Callback when outdoor POI categories change. */
  onOutdoorPOICategoriesChange?: (categories: OutdoorPOICategory[]) => void;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toLocalDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toLocalTimeInput(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function parseLocalDateTime(dateText: string, timeText: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText.trim());
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText.trim());
  if (!dateMatch || !timeMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;

  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }

  return parsed;
}

export default function MapMenu({
  visible,
  onClose,
  fullScreen = false,
  visiblePoiAmenities = ['toilets', 'drinking_water'],
  onVisiblePoiAmenitiesChange,
  selectedOutdoorPOICategories = [],
  onOutdoorPOICategoriesChange,
}: Readonly<MapMenuProps>) {
  const { colourBlindMode, setColourBlindMode, simulatedNow, setSimulatedNow, resetSimulatedNow } =
    useSettings();
  const theme = useTheme();
  const brandRed = theme?.cred?.get?.() ?? '#b21b2c';
  const router = useRouter();
  const [dateInput, setDateInput] = useState('');
  const [timeInput, setTimeInput] = useState('');

  const seedInputs = useCallback((date: Date) => {
    setDateInput(toLocalDateInput(date));
    setTimeInput(toLocalTimeInput(date));
  }, []);

  useEffect(() => {
    if (!visible) return;
    seedInputs(simulatedNow ?? new Date());
  }, [visible, simulatedNow, seedInputs]);

  if (!visible) return null;

  const handleApplySimulation = () => {
    const parsed = parseLocalDateTime(dateInput, timeInput);
    if (!parsed) {
      Alert.alert('Invalid date/time', 'Use date YYYY-MM-DD and time HH:mm.');
      return;
    }
    setSimulatedNow(parsed);
  };

  const handleNow = () => {
    resetSimulatedNow();
    seedInputs(new Date());
  };

  const allOutdoorCategoryTypes = OUTDOOR_POI_CATEGORY_OPTIONS.map((category) => category.type);
  const areAllOutdoorCategoriesSelected =
    selectedOutdoorPOICategories.length === allOutdoorCategoryTypes.length;
  const allOutdoorCategoriesAccessibilityLabel = areAllOutdoorCategoriesSelected
    ? 'Clear all outdoor POI categories'
    : 'Select all outdoor POI categories';

  const handleOutdoorCategoryToggle = (category: OutdoorPOICategory) => {
    const nextCategories = selectedOutdoorPOICategories.includes(category)
      ? selectedOutdoorPOICategories.filter((selectedCategory) => selectedCategory !== category)
      : [...selectedOutdoorPOICategories, category];

    onOutdoorPOICategoriesChange?.(nextCategories);
  };

  const handleAllOutdoorCategoriesPress = () => {
    onOutdoorPOICategoriesChange?.(areAllOutdoorCategoriesSelected ? [] : allOutdoorCategoryTypes);
  };

  const content = (
    <SafeAreaView style={styles.menuScreen}>
      <View style={styles.menuHeader}>
        <Pressable onPress={onClose} style={styles.menuBack}>
          <MaterialIcons name="chevron-left" size={43} color={brandRed} />
        </Pressable>
        <Text style={styles.menuTitle}>Menu</Text>
        <View style={styles.menuSpacer} />
      </View>
      <ScrollView
        style={styles.menuScroll}
        contentContainerStyle={styles.menuScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.menuSubtitle}>Customize your map experience</Text>
        <View style={styles.menuRow}>
          <View style={styles.menuRowLeft}>
            <MaterialIcons name="remove-red-eye" size={21} color={brandRed} />
            <Text style={styles.menuRowText}>Color-blind mode</Text>
          </View>
          <Switch
            value={colourBlindMode}
            onValueChange={setColourBlindMode}
            trackColor={{ false: '#ddd', true: '#f3b6bf' }}
            thumbColor={colourBlindMode ? brandRed : '#fff'}
          />
        </View>

        {/* POI Visibility Filters */}
        <View style={[styles.menuRow, styles.simulationRow]}>
          <View style={styles.simulationHeader}>
            <MaterialIcons name="place" size={21} color={brandRed} />
            <Text style={styles.menuRowText}>Indoor Points of Interest</Text>
          </View>
          <View style={styles.poiFilterRow}>
            <View style={styles.poiFilterItem}>
              <Text style={styles.poiFilterLabel}>Washrooms</Text>
              <Switch
                value={visiblePoiAmenities.includes('toilets')}
                onValueChange={(enabled) => {
                  const updated = enabled
                    ? [...visiblePoiAmenities, 'toilets']
                    : visiblePoiAmenities.filter((a) => a !== 'toilets');
                  onVisiblePoiAmenitiesChange?.(updated);
                }}
                trackColor={{ false: '#ddd', true: '#f3b6bf' }}
                thumbColor={visiblePoiAmenities.includes('toilets') ? brandRed : '#fff'}
              />
            </View>
            <View style={styles.poiFilterItem}>
              <Text style={styles.poiFilterLabel}>Water Fountains</Text>
              <Switch
                value={visiblePoiAmenities.includes('drinking_water')}
                onValueChange={(enabled) => {
                  const updated = enabled
                    ? [...visiblePoiAmenities, 'drinking_water']
                    : visiblePoiAmenities.filter((a) => a !== 'drinking_water');
                  onVisiblePoiAmenitiesChange?.(updated);
                }}
                trackColor={{ false: '#ddd', true: '#f3b6bf' }}
                thumbColor={visiblePoiAmenities.includes('drinking_water') ? brandRed : '#fff'}
              />
            </View>
          </View>
        </View>

        <View style={[styles.menuRow, styles.simulationRow]}>
          <View style={styles.simulationHeader}>
            <MaterialIcons name="map" size={21} color={brandRed} />
            <Text style={styles.menuRowText}>Outdoor POI categories</Text>
          </View>
          <Text style={styles.simulationStatus}>
            Select one or more categories to search nearby places on the map.
          </Text>
          <View style={styles.outdoorChipGrid}>
            <Pressable
              testID="outdoor-poi-chip-all"
              accessibilityRole="button"
              accessibilityLabel={allOutdoorCategoriesAccessibilityLabel}
              accessibilityState={{ selected: areAllOutdoorCategoriesSelected }}
              style={[
                styles.outdoorChip,
                areAllOutdoorCategoriesSelected && styles.outdoorChipSelected,
              ]}
              onPress={handleAllOutdoorCategoriesPress}
            >
              <MaterialIcons
                name="public"
                size={18}
                color={areAllOutdoorCategoriesSelected ? '#fff' : brandRed}
              />
              <Text
                style={[
                  styles.outdoorChipText,
                  areAllOutdoorCategoriesSelected && styles.outdoorChipTextSelected,
                ]}
              >
                All
              </Text>
            </Pressable>

            {OUTDOOR_POI_CATEGORY_OPTIONS.map((category) => {
              const isSelected = selectedOutdoorPOICategories.includes(category.type);

              return (
                <Pressable
                  key={category.type}
                  testID={`outdoor-poi-chip-${category.type}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle nearby ${category.label.toLowerCase()} locations`}
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.outdoorChip, isSelected && styles.outdoorChipSelected]}
                  onPress={() => handleOutdoorCategoryToggle(category.type)}
                >
                  <MaterialIcons
                    name={category.icon as keyof typeof MaterialIcons.glyphMap}
                    size={18}
                    color={isSelected ? '#fff' : brandRed}
                  />
                  <Text
                    style={[styles.outdoorChipText, isSelected && styles.outdoorChipTextSelected]}
                  >
                    {category.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.menuRow, styles.simulationRow]}>
          <View style={styles.simulationHeader}>
            <MaterialIcons name="schedule" size={21} color={brandRed} />
            <Text style={styles.menuRowText}>Simulated date and time</Text>
          </View>
          <Text style={styles.simulationStatus} testID="simulated-now-status">
            {simulatedNow
              ? `Using simulated: ${simulatedNow.toLocaleString()}`
              : 'Using current date & time'}
          </Text>
          <View style={styles.simulationInputs}>
            <TextInput
              testID="simulated-date-input"
              value={dateInput}
              onChangeText={setDateInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9a8f93"
              style={styles.simulationInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              testID="simulated-time-input"
              value={timeInput}
              onChangeText={setTimeInput}
              placeholder="HH:mm"
              placeholderTextColor="#9a8f93"
              style={styles.simulationInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.simulationActions}>
            <Pressable
              testID="simulated-apply-button"
              onPress={handleApplySimulation}
              style={[styles.simulationButton, styles.simulationApplyButton]}
            >
              <Text style={[styles.simulationButtonText, styles.simulationApplyButtonText]}>
                Apply
              </Text>
            </Pressable>
            <Pressable
              testID="simulated-now-button"
              onPress={handleNow}
              style={[styles.simulationButton, styles.simulationNowButton]}
            >
              <Text style={styles.simulationButtonText}>Now</Text>
            </Pressable>
          </View>
        </View>

        {/* New menu item for Google Calendar Instructions */}
        <View style={[styles.menuRow, { marginTop: 18, alignItems: 'center' }]}>
          <Pressable
            onPress={() => {
              onClose();
              setTimeout(() => router.push('/google-calendar-instructions'), 300);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
            accessibilityLabel="Instructions to connect Google Calendar"
          >
            <MaterialIcons
              name="info-outline"
              size={21}
              color={brandRed}
              style={{ marginRight: 10 }}
            />
            <Text style={styles.menuRowText}>Instructions to connect Google Calendar</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  if (fullScreen) {
    return (
      <Modal
        visible
        animationType="fade"
        transparent={false}
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        {content}
      </Modal>
    );
  }

  return <View style={styles.menuOverlay}>{content}</View>;
}

const styles = StyleSheet.create({
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'flex-start',
  },
  menuScreen: {
    flex: 1,
    backgroundColor: '#f9f1f4',
    paddingHorizontal: 26,
    paddingTop: 14,
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingBottom: 28,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 19,
  },
  menuBack: {
    width: 53,
    height: 53,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: { fontSize: 24, fontWeight: '700', color: '#1c1c1e' },
  menuSpacer: { width: 53 },
  menuSubtitle: { fontSize: 17, color: '#b9a9ad', marginBottom: 22 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 19,
  },
  simulationRow: {
    marginTop: 18,
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  simulationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  simulationStatus: {
    marginTop: 8,
    fontSize: 14,
    color: '#7a6d70',
  },
  simulationInputs: {
    marginTop: 12,
    flexDirection: 'row',
    columnGap: 10,
  },
  simulationInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ead8dc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#4a4a4a',
    backgroundColor: '#fff',
  },
  simulationActions: {
    marginTop: 12,
    flexDirection: 'row',
    columnGap: 10,
    justifyContent: 'flex-end',
  },
  simulationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ead8dc',
    backgroundColor: '#fff',
  },
  simulationApplyButton: {
    backgroundColor: '#8e2334',
    borderColor: '#8e2334',
  },
  simulationButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8e2334',
  },
  simulationApplyButtonText: {
    color: '#fff',
  },
  simulationNowButton: {
    backgroundColor: '#fff',
  },
  menuRowLeft: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },
  menuRowText: { fontSize: 19, color: '#4a4a4a', fontWeight: '600' },
  poiFilterRow: {
    marginTop: 12,
    flexDirection: 'column',
    rowGap: 10,
  },
  poiFilterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  poiFilterLabel: {
    fontSize: 16,
    color: '#4a4a4a',
    fontWeight: '500',
  },
  outdoorChipGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  outdoorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ead8dc',
    backgroundColor: '#fff',
  },
  outdoorChipSelected: {
    backgroundColor: '#8e2334',
    borderColor: '#8e2334',
  },
  outdoorChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5a4a4f',
  },
  outdoorChipTextSelected: {
    color: '#fff',
  },
});
