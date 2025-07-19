import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { Alert, Platform } from 'react-native';

interface AudioRecordingState {
  isRecording: boolean;
  duration: number;
  uri: string | null;
}

export function useAudioRecording() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
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
      // Cleanup recording and timer if component unmounts
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (recording) {
        recording.stopAndUnloadAsync().catch(console.error);
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
      if (recording || state.isRecording) {
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

      // Stop any existing recording first (defensive)
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch (error) {
          console.log('Error stopping existing recording:', error);
        }
        setRecording(null);
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      // Use M4A format explicitly since that's what RN actually creates
      const recordingOptions: Audio.RecordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100, // Standard sample rate
          numberOfChannels: 1, // Mono for speech
          bitRate: 128000, // Higher bitrate for better quality
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100, // Standard sample rate
          numberOfChannels: 1, // Mono for speech
          bitRate: 128000, // Higher bitrate for better quality
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      console.log('🎤 Starting recording...');
      const { recording: newRecording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(newRecording);

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
      if (!recording) {
        console.log('⚠️ No active recording to stop');
        return null;
      }

      console.log('🛑 Stopping recording...');

      // Clear timer first
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Get URI before stopping (in case it gets cleared)
      let uri: string | null = null;
      try {
        uri = recording.getURI();
      } catch (error) {
        console.log('Could not get URI before stopping:', error);
      }

      // Stop and unload recording safely
      try {
        await recording.stopAndUnloadAsync();
        // Try to get URI again if we didn't get it before
        if (!uri) {
          uri = recording.getURI();
        }
      } catch (error) {
        console.log('Recording already stopped/unloaded:', error);
        // If it's already stopped, that's okay - just ensure we have the URI
      }
      
      // Clear the recording reference
      setRecording(null);
      setState(prev => ({
        ...prev,
        isRecording: false,
        uri,
      }));

      console.log('✅ Recording stopped, URI:', uri);
      return uri;
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      // Still clear the recording reference even if stopping failed
      setRecording(null);
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