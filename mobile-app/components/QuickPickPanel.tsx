import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type QuickPick = {
  code: string;
  label: string;
  color: string;
  colorBlind?: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  hint?: string;
};

const COLOR_BLIND_CARD_TEXT = '#4b4b4b';

interface QuickPickPanelProps {
  activeCampus: 'sgw' | 'loyola';
  isColorBlind: boolean;
  isQuickPickOpen: boolean;
  quickPickMaxHeight: number;
  quickPickVisibleHeight: Animated.Value;
  quickPickContentHeight: number;
  featuredBuildings: QuickPick[];
  isLocating: boolean;
  onToggleOpen: () => void;
  onHeightChange: (height: number) => void;
  onQuickPick: (pick: QuickPick) => void;
  onLocationPress: () => void;
}

/**
 * Panel component displaying featured building quick pick cards
 * Collapsible panel with swipe gesture and animation, plus location button
 * that repositions when collapsed.
 */
export default function QuickPickPanel({
  activeCampus,
  isColorBlind,
  isQuickPickOpen,
  quickPickMaxHeight,
  quickPickVisibleHeight,
  quickPickContentHeight,
  featuredBuildings,
  isLocating,
  onToggleOpen,
  onHeightChange,
  onQuickPick,
  onLocationPress,
}: Readonly<QuickPickPanelProps>) {
  // Swipe gesture: down to collapse, up to expand
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // Only capture vertical swipes (not horizontal scrolls)
        return (
          Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
        );
      },
      onPanResponderRelease: (_evt, gestureState) => {
        const SWIPE_THRESHOLD = 30;
        if (gestureState.dy > SWIPE_THRESHOLD && isQuickPickOpen) {
          // Swipe down → collapse
          onToggleOpen();
        } else if (gestureState.dy < -SWIPE_THRESHOLD && !isQuickPickOpen) {
          // Swipe up → expand
          onToggleOpen();
        }
      },
    }),
  ).current;

  return (
    <>
      {/* Location button — repositions to bottom-right when panel is collapsed */}
      {!isQuickPickOpen && (
        <Pressable
          testID="location-button"
          style={[styles.recenterButtonFloating, { opacity: isLocating ? 0.85 : 1 }]}
          onPress={onLocationPress}
          disabled={isLocating}
          accessibilityLabel="Go to my location"
        >
          {isLocating ? (
            <ActivityIndicator testID="activity-indicator" size="small" color="#c41230" />
          ) : (
            <MaterialIcons name="my-location" size={32} color="#c41230" />
          )}
        </Pressable>
      )}

      <View
        style={styles.quickPickWrapper}
        pointerEvents="auto"
        testID="quick-pick-panel"
        {...panResponder.panHandlers}
      >
        {/* Location button inside the panel when open */}
        {isQuickPickOpen && (
          <Pressable
            testID="location-button"
            style={[styles.recenterButton, { opacity: isLocating ? 0.85 : 1 }]}
            onPress={onLocationPress}
            disabled={isLocating}
            accessibilityLabel="Go to my location"
          >
            {isLocating ? (
              <ActivityIndicator testID="activity-indicator" size="small" color="#c41230" />
            ) : (
              <MaterialIcons name="my-location" size={32} color="#c41230" />
            )}
          </Pressable>
        )}

        {/* Drag handle indicator */}
        <View style={styles.dragHandle} />

        <Pressable style={styles.quickPickHeader} onPress={onToggleOpen}>
          <Text style={styles.quickPickTitle} testID="campus-label">
            {activeCampus === 'loyola' ? 'LOYOLA' : 'SGW'}
          </Text>
        </Pressable>
        <Animated.View
          style={[
            styles.quickPickGridWrapper,
            quickPickContentHeight ? { height: quickPickVisibleHeight } : null,
          ]}
        >
          <View
            style={styles.quickPickGrid}
            onLayout={(event) => {
              const height = event.nativeEvent.layout.height;
              if (height > 0 && height !== quickPickContentHeight) {
                onHeightChange(height);
              }
            }}
          >
            {featuredBuildings.map((pick) => {
              const cardBackground = isColorBlind && pick.colorBlind ? pick.colorBlind : pick.color;
              const cardTextColor = isColorBlind ? COLOR_BLIND_CARD_TEXT : '#fff';
              return (
                <Pressable
                  key={pick.label}
                  style={[styles.quickPickCard, { backgroundColor: cardBackground }]}
                  onPress={() => onQuickPick(pick)}
                >
                  <MaterialIcons name={pick.icon} size={21} color={cardTextColor} />
                  <Text style={[styles.quickPickLabel, { color: cardTextColor }]} numberOfLines={3}>
                    {pick.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  quickPickWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 17,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'visible',
    zIndex: 2,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    marginBottom: 8,
  },
  quickPickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickPickTitle: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#b21b2c',
    letterSpacing: 1,
  },
  quickPickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    columnGap: 12,
  },
  quickPickGridWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  quickPickCard: {
    width: '48%',
    borderRadius: 11,
    paddingVertical: 13,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 11,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
    height: 83,
    justifyContent: 'center',
  },
  quickPickLabel: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 18 },
  recenterButton: {
    position: 'absolute',
    top: -44,
    right: 18,
    width: 65,
    height: 65,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d8d8d8',
    zIndex: 4,
    elevation: 6,
  },
  recenterButtonFloating: {
    position: 'absolute',
    bottom: 60,
    right: 18,
    width: 65,
    height: 65,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d8d8d8',
    zIndex: 10,
    elevation: 6,
  },
});
