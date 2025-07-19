import { useState, useEffect, useRef } from 'react';
import { useAudioRecorder } from 'expo-audio';
import { Audio } from 'expo-av'; // For permissions only
import { Alert, Platform } from 'react-native';

interface AudioRecordingState {
  isRecording: boolean;
  duration: number;
  uri: string | null;
}

export function useAudioRecording() {
  const recorder = useAudioRecorder({
    bitRate: 64000,
    extension: '.mp3',
    numberOfChannels: 1,
    sampleRate: 16000,
    android: {
      audioEncoder: 'aac',
      outputFormat: 'mpeg4'
    },
    ios: {
      audioQuality: 'high',
      outputFormat: 'mpeg4aac'
    }
  });
  const [state, setState] = useState<AudioRecordingState>({
    isRecording: false,
    duration: 0,
    uri: null,
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Request permissions when hook is initialized
    requestPermissions();
    
    return () => {
      // Cleanup timer if component unmounts
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const requestPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please enable microphone permissions in your device settings to use voice recording.',
          [{ text: 'OK' }]
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  };

  const startRecording = async (): Promise<void> => {
    try {
      // Check if already recording
      if (state.isRecording) {
        console.log('⚠️ Already recording, ignoring start request');
        return;
      }

      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission not granted');
      }

      // Clear any existing timer first
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      console.log('🎤 Starting recording with expo-audio...');
      
      // Prepare and start recording
      await recorder.prepareToRecordAsync();
      await recorder.record();

      // Update state
      setState(prev => ({
        ...prev,
        isRecording: true,
        duration: 0,
        uri: null,
      }));

      // Start duration timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          duration: Date.now() - startTime,
        }));
      }, 100);

      console.log('✅ Recording started successfully');
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      throw error;
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    try {
      if (!state.isRecording) {
        console.log('⚠️ No active recording to stop');
        return null;
      }

      console.log('🛑 Stopping recording...');

      // Clear timer first
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Stop recording and get URI
      const result = await recorder.stop();
      console.log('🛑 expo-audio stopped, result:', result);
      
      // Extract URI from the result object
      const uri = typeof result === 'string' ? result : result?.url || result?.uri;
      console.log('🛑 Extracted URI:', uri);
      
      // Update state
      setState(prev => ({
        ...prev,
        isRecording: false,
        uri,
      }));

      console.log('✅ Recording stopped, URI:', uri);
      return uri;
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      // Still clear the recording state even if stopping failed
      setState(prev => ({
        ...prev,
        isRecording: false,
        uri: null,
      }));
      return null;
    }
  };

  const formatDuration = (duration: number): string => {
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return {
    startRecording,
    stopRecording,
    formatDuration,
    state,
  };
}