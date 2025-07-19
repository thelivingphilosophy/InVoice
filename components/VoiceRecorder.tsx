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
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { TranscriptionService } from '@/services/transcription';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface VoiceRecorderProps {
  openAiApiKey: string;
  onTranscriptionComplete: (transcription: string) => void;
}

export default function VoiceRecorder({ openAiApiKey, onTranscriptionComplete }: VoiceRecorderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const { startRecording, stopRecording, formatDuration, state } = useAudioRecording();
  const transcriptionService = new TranscriptionService(openAiApiKey);

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const handleStopAndTranscribe = async () => {
    try {
      setIsTranscribing(true);
      const audioUri = await stopRecording();
      
      if (!audioUri) {
        Alert.alert('Error', 'No audio recorded');
        return;
      }

      const result = await transcriptionService.transcribeAudio(audioUri);
      
      if (result.success && result.text.trim()) {
        onTranscriptionComplete(result.text.trim());
      } else {
        Alert.alert('Transcription Failed', result.error || 'Could not transcribe audio');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      Alert.alert('Error', 'Failed to transcribe audio');
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          Voice Recorder
        </Text>
        
        <View style={styles.recordingArea}>
          {!state.isRecording && !isTranscribing && (
            <TouchableOpacity
              style={[styles.recordButton, { backgroundColor: colors.tint }]}
              onPress={handleStartRecording}
            >
              <IconSymbol name="mic" size={48} color="white" />
              <Text style={styles.recordButtonText}>Start Recording</Text>
            </TouchableOpacity>
          )}

          {state.isRecording && (
            <TouchableOpacity
              style={[styles.recordButton, { backgroundColor: '#ff4444' }]}
              onPress={handleStopAndTranscribe}
            >
              <IconSymbol name="stop" size={48} color="white" />
              <Text style={styles.recordButtonText}>Stop & Transcribe</Text>
              <Text style={styles.recordingTime}>
                {formatDuration(state.duration)}
              </Text>
            </TouchableOpacity>
          )}

          {isTranscribing && (
            <View style={[styles.recordButton, { backgroundColor: '#666' }]}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.recordButtonText}>Transcribing...</Text>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
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