import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type SettingsContextValue = {
  colourBlindMode: boolean;
  setColourBlindMode: (value: boolean) => void;
  simulatedNow: Date | null;
  setSimulatedNow: (value: Date | null) => void;
  resetSimulatedNow: () => void;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

function defaultSimulatedNow(): Date {
  // Fixed default for testing: March 27, 2026 at 8:00 AM (local time)
  return new Date(2026, 2, 27, 8, 0, 0, 0);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [colourBlindMode, setColourBlindMode] = useState(false);
  const [simulatedNow, setSimulatedNow] = useState<Date | null>(() => defaultSimulatedNow());

  const resetSimulatedNow = useCallback(() => setSimulatedNow(null), []);

  const value = useMemo(
    () => ({
      colourBlindMode,
      setColourBlindMode,
      simulatedNow,
      setSimulatedNow,
      resetSimulatedNow,
    }),
    [colourBlindMode, simulatedNow, resetSimulatedNow],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}
