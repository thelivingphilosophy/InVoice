import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsContextType {
  voiceTone: string;
  setVoiceTone: (tone: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [voiceTone, setVoiceTone] = useState('default');

  // Load saved voice tone on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedVoiceTone = await AsyncStorage.getItem('voice_tone');
        if (savedVoiceTone) {
          setVoiceTone(savedVoiceTone);
        }
      } catch (error) {
        console.error('Failed to load voice tone setting:', error);
      }
    };
    loadSettings();
  }, []);

  // Save voice tone when it changes
  const handleSetVoiceTone = async (tone: string) => {
    try {
      await AsyncStorage.setItem('voice_tone', tone);
      setVoiceTone(tone);
      console.log('Voice tone saved:', tone);
    } catch (error) {
      console.error('Failed to save voice tone:', error);
      // Still set the tone even if save fails
      setVoiceTone(tone);
    }
  };

  return (
    <SettingsContext.Provider value={{ voiceTone, setVoiceTone: handleSetVoiceTone }}>
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