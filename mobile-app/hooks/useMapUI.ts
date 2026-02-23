import { useEffect, useRef, useState, useMemo } from 'react';
import { Animated } from 'react-native';

/**
 * Hook to manage UI state for map screen including menu, color blind mode, and quick pick animation
 */
export function useMapUI() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isColorBlind, setIsColorBlind] = useState(false);
  const [isQuickPickOpen, setIsQuickPickOpen] = useState(true);
  const [quickPickContentHeight, setQuickPickContentHeight] = useState(0);
  const quickPickVisibleHeight = useRef(new Animated.Value(0)).current;

  const quickPickMaxHeight = useMemo(
    () => Math.max(0, quickPickContentHeight),
    [quickPickContentHeight],
  );

  // Effect: Handle quick pick animation
  useEffect(() => {
    if (!quickPickContentHeight) return;
    if (isQuickPickOpen) {
      quickPickVisibleHeight.setValue(quickPickContentHeight);
    }
  }, [isQuickPickOpen, quickPickContentHeight, quickPickVisibleHeight]);

  /**
   * Toggles quick pick open/closed with animation
   */
  const handleToggleQuickPick = () => {
    const nextOpen = !isQuickPickOpen;
    const target = nextOpen ? quickPickMaxHeight : 0;
    Animated.timing(quickPickVisibleHeight, {
      toValue: target,
      duration: 220,
      useNativeDriver: false,
    }).start();
    setIsQuickPickOpen(nextOpen);
  };

  return {
    isMenuOpen,
    setIsMenuOpen,
    isColorBlind,
    setIsColorBlind,
    isQuickPickOpen,
    setIsQuickPickOpen,
    quickPickContentHeight,
    setQuickPickContentHeight,
    quickPickVisibleHeight,
    quickPickMaxHeight,
    handleToggleQuickPick,
  };
}
