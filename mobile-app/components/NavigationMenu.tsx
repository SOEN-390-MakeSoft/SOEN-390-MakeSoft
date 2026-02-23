import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BUILDING_ADDRESSES } from '../data/building-addresses';
import { LOYOLA_BUILDING_POLYGONS } from '../data/buildingPolygonsLoyola';
import { extractCodeFromName, normalizeLabel } from '../utils/stringUtils';
import { formatAddress } from '../utils/mapUtils';
import MapMenu from './MapMenu';
import { useSettings } from '../context/settings';

type ActiveField = 'start' | 'destination' | null;

interface NavigationMenuProps {
  startLabel?: string;
  destinationLabel?: string;
  onActiveFieldChange?: (field: ActiveField) => void;
  onBuildingSelect?: (field: 'start' | 'destination', name: string, code: string | null) => void;
}

type SearchEntry = {
  name: string;
  code: string | null;
  address: string | null;
  aliases?: string[];
};

const buildLabel = (name: string, code: string | null) => {
  if (!code) return name;
  return name.includes(`(${code})`) ? name : `${name} (${code})`;
};

export default function NavigationMenu({
  startLabel = 'Your location',
  destinationLabel = '',
  onActiveFieldChange,
  onBuildingSelect,
}: Readonly<NavigationMenuProps>) {
  const { colourBlindMode } = useSettings();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeField, setActiveField] = useState<ActiveField>(null);
  const activeFieldRef = useRef<ActiveField>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [startQuery, setStartQuery] = useState(startLabel);
  const [destinationQuery, setDestinationQuery] = useState(destinationLabel);
  const isColorBlind = colourBlindMode;
  const topBarColor = isColorBlind ? '#9aa7b2' : '#8e2334';
  const routeCardColor = isColorBlind ? '#e6eaee' : '#f6dce0';
  const menuIconColor = isColorBlind ? '#b21b2c' : '#e8c9cf';
  const destinationIconColor = '#c1464f';
  const clearIconColor = isColorBlind ? '#b21b2c' : '#8e2334';
  const dividerColor = isColorBlind ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.15)';

  useEffect(() => {
    setStartQuery(startLabel);
  }, [startLabel]);

  useEffect(() => {
    setDestinationQuery(destinationLabel);
  }, [destinationLabel]);

  useEffect(() => {
    onActiveFieldChange?.(activeField);
  }, [activeField, onActiveFieldChange]);

  const activateField = useCallback((field: ActiveField) => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    activeFieldRef.current = field;
    setActiveField(field);
  }, []);

  const deactivateField = useCallback(() => {
    blurTimer.current = setTimeout(() => {
      blurTimer.current = null;
      activeFieldRef.current = null;
      setActiveField(null);
    }, 400);
  }, []);

  const activeQuery = activeField === 'start' ? startQuery : destinationQuery;
  const buildingOptions = useMemo<SearchEntry[]>(() => {
    const addressLookup = new Map<string, string>();
    for (const entry of BUILDING_ADDRESSES) {
      addressLookup.set(normalizeLabel(entry.name), entry.address);
      if (entry.aliases) {
        for (const alias of entry.aliases) {
          addressLookup.set(normalizeLabel(alias), entry.address);
        }
      }
    }

    const sgw = BUILDING_ADDRESSES.map((entry) => ({
      name: entry.name,
      code: entry.code,
      address: entry.address,
      aliases: entry.aliases,
    }));
    const loyola = Object.values(LOYOLA_BUILDING_POLYGONS).map((entry) => ({
      name: entry.name,
      code: extractCodeFromName(entry.name),
      address: formatAddress(entry) ?? addressLookup.get(normalizeLabel(entry.name)) ?? null,
    }));
    return [...sgw, ...loyola];
  }, []);

  const results = useMemo(() => {
    const query = normalizeLabel(activeQuery);
    if (!query) return [];
    return buildingOptions
      .filter((entry) => {
        const name = normalizeLabel(entry.name);
        const code = entry.code ? normalizeLabel(entry.code) : '';
        const address = entry.address ? normalizeLabel(entry.address) : '';
        const aliases = entry.aliases?.some((alias) => normalizeLabel(alias).includes(query));
        return (
          name.includes(query) ||
          code.includes(query) ||
          address.includes(query) ||
          aliases === true
        );
      })
      .slice(0, 6);
  }, [activeQuery, buildingOptions]);

  const handleSelect = (field: 'start' | 'destination', entry: SearchEntry) => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    const label = buildLabel(entry.name, entry.code);
    if (field === 'start') {
      setStartQuery(label);
      onBuildingSelect?.('start', entry.name, entry.code);
    } else {
      setDestinationQuery(label);
      onBuildingSelect?.('destination', entry.name, entry.code);
    }
    activeFieldRef.current = null;
    setActiveField(null);
  };

  const renderInputRow = (
    field: ActiveField,
    value: string,
    setValue: (text: string) => void,
    icon: keyof typeof MaterialIcons.glyphMap,
    iconColor: string,
    placeholder: string,
    clearLabel: string,
  ) => (
    <View style={styles.routeRow}>
      <MaterialIcons name={icon} size={20} color={iconColor} />
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={setValue}
          onFocus={() => activateField(field)}
          onBlur={deactivateField}
          placeholder={placeholder}
          placeholderTextColor="#6b6b6b"
          style={styles.routeInput}
        />
        {!!value && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            onPress={() => setValue('')}
            style={[styles.clearButton, { backgroundColor: routeCardColor }]}
          >
            <MaterialIcons name="close" size={16} color={clearIconColor} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.topBar, { backgroundColor: topBarColor }]}>
      <Pressable
        style={styles.menuIcon}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        onPress={() => setIsMenuOpen(true)}
      >
        <MaterialIcons name="menu" size={28} color={menuIconColor} />
      </Pressable>

      <View style={styles.searchColumn}>
        <View style={[styles.routeCard, { backgroundColor: routeCardColor }]}>
          {renderInputRow(
            'start',
            startQuery,
            setStartQuery,
            'radio-button-unchecked',
            '#1c1c1e',
            'Start',
            'Clear start',
          )}
          <View style={[styles.routeDivider, { backgroundColor: dividerColor }]} />
          {renderInputRow(
            'destination',
            destinationQuery,
            setDestinationQuery,
            'location-on',
            destinationIconColor,
            'Destination',
            'Clear destination',
          )}
        </View>

        {activeField && (
          <View style={styles.resultsCard}>
            {activeField === 'start' && (
              <Pressable
                style={[styles.resultItem, results.length > 0 && styles.resultDivider]}
                onPress={() =>
                  handleSelect('start', {
                    name: 'Your location',
                    code: null,
                    address: null,
                  })
                }
              >
                <Text style={styles.resultTitle} numberOfLines={1}>
                  Use your location
                </Text>
                <Text style={styles.resultMeta} numberOfLines={1}>
                  Current location
                </Text>
              </Pressable>
            )}
            {results.map((entry, index) => {
              const label = buildLabel(entry.name, entry.code);
              return (
                <Pressable
                  key={`${entry.code}-${index}`}
                  style={[styles.resultItem, index < results.length - 1 && styles.resultDivider]}
                  onPress={() => handleSelect(activeField, entry)}
                >
                  <Text style={styles.resultTitle} numberOfLines={1}>
                    {label}
                  </Text>
                  <Text style={styles.resultMeta} numberOfLines={1}>
                    {entry.address ?? 'Address unavailable'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <MapMenu visible={isMenuOpen} onClose={() => setIsMenuOpen(false)} fullScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    backgroundColor: '#8e2334',
    paddingTop: 58,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 12,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  menuIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  searchColumn: { flex: 1 },
  routeCard: {
    backgroundColor: '#f6dce0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
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
  routeDivider: {
    borderStyle: 'dotted',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0,0,0,0.2)',
    marginVertical: 8,
    marginLeft: 28,
  },
  routeInput: {
    flex: 1,
    fontSize: 16,
    color: '#1c1c1e',
    fontWeight: '600',
    paddingVertical: 0,
    paddingRight: 40,
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
  resultsCard: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5c8cd',
    overflow: 'hidden',
  },
  resultItem: { paddingVertical: 10, paddingHorizontal: 12 },
  resultDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0e0e3',
  },
  resultTitle: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  resultMeta: { fontSize: 13, color: '#6b6b6b', marginTop: 2 },
});
