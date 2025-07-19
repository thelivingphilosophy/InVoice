import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useOfflineAudioRecording } from '@/hooks/useOfflineAudioRecording';
import { useNetwork } from '@/contexts/NetworkContext';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface VoiceRecorderProps {
  openAiApiKey: string;
  onTranscriptionComplete: (transcription: string) => void;
}

export default function VoiceRecorder({ openAiApiKey, onTranscriptionComplete }: VoiceRecorderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { isOffline } = useNetwork();
  
  const { 
    startRecording, 
    stopRecording, 
    formatDuration, 
    state 
  } = useOfflineAudioRecording({
    apiKey: openAiApiKey,
    onTranscriptionComplete: (transcription, isFromOfflineQueue) => {
      if (isFromOfflineQueue) {
        Alert.alert(
          'Offline Recording Processed', 
          'A previously recorded audio has been transcribed and saved.',
          [{ text: 'OK' }]
        );
      } else {
        onTranscriptionComplete(transcription);
      }
    },
    onOfflineQueued: (queueId) => {
      Alert.alert(
        'Recording Saved Offline',
        'Your recording has been saved and will be processed when you\'re back online.',
        [{ text: 'OK', onPress: () => onTranscriptionComplete('') }]
      );
    },
    jobType: 'voice_note'
  });

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const handleStopAndProcess = async () => {
    try {
      const audioUri = await stopRecording();
      
      if (!audioUri) {
        Alert.alert('Error', 'No audio recorded');
        return;
      }

      // The useOfflineAudioRecording hook handles transcription or queuing automatically
    } catch (error) {
      console.error('Processing error:', error);
      Alert.alert('Error', 'Failed to process recording');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Offline Status Indicator */}
        {isOffline && (
          <View style={[styles.offlineIndicator, { backgroundColor: '#ff9500' }]}>
            <IconSymbol name="wifi.slash" size={20} color="white" />
            <Text style={styles.offlineText}>
              Offline Mode - Recordings will be saved for later processing
            </Text>
          </View>
        )}

        <View style={styles.recordingArea}>
          {!state.isRecording && !state.isProcessing && (
            <TouchableOpacity
              style={[styles.recordButton, { backgroundColor: isOffline ? '#ff9500' : colors.tint }]}
              onPress={handleStartRecording}
            >
              <IconSymbol name="mic" size={48} color="white" />
              <Text style={styles.recordButtonText}>
                {isOffline ? 'Record Offline' : 'Start Recording'}
              </Text>
            </TouchableOpacity>
          )}

          {state.isRecording && (
            <TouchableOpacity
              style={[styles.recordButton, { backgroundColor: '#ff4444' }]}
              onPress={handleStopAndProcess}
            >
              <IconSymbol name="stop" size={48} color="white" />
              <Text style={styles.recordButtonText}>
                {isOffline ? 'Stop & Save' : 'Stop & Transcribe'}
              </Text>
              <Text style={styles.recordingTime}>
                {formatDuration(state.duration)}
              </Text>
            </TouchableOpacity>
          )}

          {state.isProcessing && (
            <View style={[styles.recordButton, { backgroundColor: '#666' }]}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.recordButtonText}>
                {isOffline ? 'Saving...' : 'Transcribing...'}
              </Text>
            </View>
          )}

          {state.isOfflineQueued && (
            <View style={[styles.recordButton, { backgroundColor: '#22c55e' }]}>
              <IconSymbol name="checkmark.circle" size={48} color="white" />
              <Text style={styles.recordButtonText}>Saved for Later Processing</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
    width: '100%',
  },
  offlineText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  recordingArea: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  recordButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: 20,
    gap: 10,
    minWidth: 200,
  },
  recordButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  recordingTime: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
  },
});