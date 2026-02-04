import React, { createContext, useContext, useMemo, useState } from "react";

type SettingsContextValue = {
    colourBlindMode: boolean;
    setColourBlindMode: (value: boolean) => void;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [colourBlindMode, setColourBlindMode] = useState(false);

    const value = useMemo(
        () => ({ colourBlindMode, setColourBlindMode }),
        [colourBlindMode]
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error("useSettings must be used within SettingsProvider");
    }
    return context;
}
