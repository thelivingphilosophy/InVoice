import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Platform } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSettings } from '@/contexts/SettingsContext';

interface SettingsScreenProps {
  onClose: () => void;
}

export default function SettingsScreen({ onClose }: SettingsScreenProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { voiceTone, setVoiceTone } = useSettings();
  
  const [apiKey, setApiKey] = useState('');
  const [isEditingApiKey, setIsEditingApiKey] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  const isFocused = useIsFocused();
  const scrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);

  // Load API key on mount and whenever screen comes into focus
  useEffect(() => {
    loadApiKey();
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadApiKey();
    }
  }, [isFocused]);

  const loadApiKey = async () => {
    try {
      const savedApiKey = await AsyncStorage.getItem('openai_api_key');
      if (savedApiKey) {
        setHasApiKey(true);
        // Show masked version for security
        setApiKey('sk-' + '*'.repeat(20));
      } else {
        setHasApiKey(false);
        setApiKey('');
      }
    } catch (error) {
      console.error('Failed to load API key:', error);
    }
  };

  const saveApiKey = async () => {
    try {
      if (apiKey.trim() && !apiKey.includes('*')) {
        await AsyncStorage.setItem('openai_api_key', apiKey.trim());
        setHasApiKey(true);
        setIsEditingApiKey(false);
        // Show masked version
        setApiKey('sk-' + '*'.repeat(20));
        Alert.alert('Success', 'API key saved successfully!');
      } else {
        Alert.alert('Error', 'Please enter a valid OpenAI API key');
      }
    } catch (error) {
      console.error('Failed to save API key:', error);
      Alert.alert('Error', 'Failed to save API key');
    }
  };

  const removeApiKey = () => {
    Alert.alert(
      'Remove API Key',
      'Are you sure you want to remove the saved API key? You will need to enter it again to use voice features.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('openai_api_key');
              setApiKey('');
              setHasApiKey(false);
              setIsEditingApiKey(false);
              Alert.alert('Success', 'API key removed');
            } catch (error) {
              console.error('Failed to remove API key:', error);
              Alert.alert('Error', 'Failed to remove API key');
            }
          }
        }
      ]
    );
  };

  const startEditingApiKey = () => {
    setApiKey('');
    setIsEditingApiKey(true);
    // Auto-focus and scroll to input after state updates
    setTimeout(() => {
      textInputRef.current?.focus();
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const voiceOptions = [
    { id: 'default', name: 'Default TTS', description: 'Standard text-to-speech' },
    { id: 'casual', name: 'Casual', description: 'Relaxed and friendly voice' },
    { id: 'direct', name: 'Direct', description: 'Straightforward and clear' },
    { id: 'whacky', name: 'Whacky', description: 'Fun and energetic voice' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: '#f89448', borderColor: '#f89448' }]} 
            onPress={onClose}
          >
            <IconSymbol name="chevron.left" size={16} color="white" />
            <Text style={[styles.backText, { color: 'white' }]}>Back</Text>
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
          </View>
          <View style={styles.rightSection} />
        </View>
        {/* Voice Tone Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Voice Tone</Text>
          <Text style={[styles.sectionDescription, { color: colors.text, opacity: 0.7 }]}>
            Choose how questions are spoken during job entry
          </Text>
          
          {voiceOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.voiceOption,
                { 
                  backgroundColor: colors.background,
                  borderColor: voiceTone === option.id ? colors.tint : colors.text + '20',
                  borderWidth: voiceTone === option.id ? 2 : 1,
                }
              ]}
              onPress={() => setVoiceTone(option.id as any)}
            >
              <View style={styles.voiceOptionContent}>
                <View style={styles.voiceOptionText}>
                  <Text style={[styles.voiceOptionName, { color: colors.text }]}>
                    {option.name}
                  </Text>
                  <Text style={[styles.voiceOptionDescription, { color: colors.text, opacity: 0.7 }]}>
                    {option.description}
                  </Text>
                </View>
                {voiceTone === option.id && (
                  <IconSymbol name="checkmark.circle.fill" size={24} color={colors.tint} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* API Key Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>OpenAI API Key</Text>
          <Text style={[styles.sectionDescription, { color: colors.text, opacity: 0.7 }]}>
            Required for voice transcription features. Your key is stored securely on your device.
          </Text>
          
          {!isEditingApiKey ? (
            <View style={[styles.apiKeyContainer, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
              <View style={styles.apiKeyContent}>
                <Text style={[styles.apiKeyLabel, { color: colors.text, opacity: 0.7 }]}>
                  API Key Status
                </Text>
                <Text style={[styles.apiKeyValue, { color: hasApiKey ? '#22c55e' : '#f59e0b' }]}>
                  {hasApiKey ? 'Configured ✓' : 'Not configured'}
                </Text>
                {hasApiKey && (
                  <Text style={[styles.apiKeyMasked, { color: colors.text, opacity: 0.5 }]}>
                    {apiKey}
                  </Text>
                )}
              </View>
              <View style={styles.apiKeyActions}>
                <TouchableOpacity
                  style={[styles.apiKeyButton, { backgroundColor: colors.tint }]}
                  onPress={startEditingApiKey}
                >
                  <Text style={styles.apiKeyButtonText}>
                    {hasApiKey ? 'Update' : 'Add'}
                  </Text>
                </TouchableOpacity>
                {hasApiKey && (
                  <TouchableOpacity
                    style={[styles.apiKeyButton, { backgroundColor: '#ef4444' }]}
                    onPress={removeApiKey}
                  >
                    <Text style={styles.apiKeyButtonText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.apiKeyEditContainer}>
              <TextInput
                ref={textInputRef}
                style={[styles.apiKeyInput, { backgroundColor: colors.background, borderColor: colors.text, color: colors.text }]}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="sk-..."
                placeholderTextColor={colors.text + '60'}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={saveApiKey}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }}
              />
              <View style={styles.apiKeyEditActions}>
                <TouchableOpacity
                  style={[styles.apiKeyButton, { backgroundColor: '#22c55e' }]}
                  onPress={saveApiKey}
                >
                  <Text style={styles.apiKeyButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.apiKeyButton, { backgroundColor: '#666' }]}
                  onPress={() => {
                    setIsEditingApiKey(false);
                    loadApiKey(); // Reset to previous state
                  }}
                >
                  <Text style={styles.apiKeyButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  rightSection: {
    width: 70,
    alignItems: 'flex-end',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    minWidth: 70,
  },
  backText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 300,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 20,
  },
  voiceOption: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  voiceOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voiceOptionText: {
    flex: 1,
  },
  voiceOptionName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  voiceOptionDescription: {
    fontSize: 14,
  },
  apiKeyContainer: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  apiKeyContent: {
    marginBottom: 12,
  },
  apiKeyLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  apiKeyValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  apiKeyMasked: {
    fontSize: 14,
    fontFamily: 'monospace',
  },
  apiKeyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  apiKeyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
  },
  apiKeyButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  apiKeyEditContainer: {
    marginBottom: 12,
  },
  apiKeyInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  apiKeyEditActions: {
    flexDirection: 'row',
    gap: 8,
  },
});