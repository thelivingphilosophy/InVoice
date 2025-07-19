import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
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

  const voiceOptions = [
    { id: 'default', name: 'Default TTS', description: 'Standard text-to-speech' },
    { id: 'casual', name: 'Casual', description: 'Relaxed and friendly voice' },
    { id: 'direct', name: 'Direct', description: 'Straightforward and clear' },
    { id: 'whacky', name: 'Whacky', description: 'Fun and energetic voice' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    marginLeft: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
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
});