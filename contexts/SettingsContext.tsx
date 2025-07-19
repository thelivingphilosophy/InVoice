import React, { createContext, useContext, useState } from 'react';

interface SettingsContextType {
  voiceTone: string;
  setVoiceTone: (tone: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [voiceTone, setVoiceTone] = useState('default');

  return (
    <SettingsContext.Provider value={{ voiceTone, setVoiceTone }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}