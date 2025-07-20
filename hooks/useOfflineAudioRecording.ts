import { useState, useEffect, useRef } from 'react';
import { useAudioRecording } from './useAudioRecording';
import { useNetwork } from '@/contexts/NetworkContext';
import { OfflineQueueService } from '@/services/offlineQueue';
import { TranscriptionService } from '@/services/transcription';

interface OfflineAudioRecordingState {
  isRecording: boolean;
  duration: number;
  uri: string | null;
  isProcessing: boolean;
  isOfflineQueued: boolean;
  queueId: string | null;
}

interface UseOfflineAudioRecordingProps {
  apiKey?: string;
  onTranscriptionComplete?: (transcription: string, isFromOfflineQueue?: boolean) => void;
  onOfflineQueued?: (queueId: string) => void;
  jobType?: 'voice_note' | 'workflow_step';
  stepIndex?: number;
  metadata?: any;
}

export function useOfflineAudioRecording({
  apiKey,
  onTranscriptionComplete,
  onOfflineQueued,
  jobType = 'voice_note',
  stepIndex,
  metadata,
}: UseOfflineAudioRecordingProps = {}) {
  const { isOffline, isConnected } = useNetwork();
  const { 
    startRecording: originalStartRecording, 
    stopRecording: originalStopRecording, 
    formatDuration, 
    state: recordingState 
  } = useAudioRecording();

  const [offlineState, setOfflineState] = useState<OfflineAudioRecordingState>({
    isRecording: false,
    duration: 0,
    uri: null,
    isProcessing: false,
    isOfflineQueued: false,
    queueId: null,
  });

  const offlineQueueService = useRef(new OfflineQueueService());
  const transcriptionService = useRef<TranscriptionService | null>(null);

  // Initialize transcription service when apiKey is available
  useEffect(() => {
    if (apiKey) {
      transcriptionService.current = new TranscriptionService(apiKey);
    }
  }, [apiKey]);

  // Sync recording state with offline state
  useEffect(() => {
    setOfflineState(prev => ({
      ...prev,
      isRecording: recordingState.isRecording,
      duration: recordingState.duration,
      uri: recordingState.uri,
    }));
  }, [recordingState]);

  const startRecording = async (): Promise<void> => {
    setOfflineState(prev => ({
      ...prev,
      isProcessing: false,
      isOfflineQueued: false,
      queueId: null,
    }));
    
    return originalStartRecording();
  };

  const stopRecording = async (): Promise<string | null> => {
    const audioUri = await originalStopRecording();
    
    if (!audioUri) {
      return null;
    }

    setOfflineState(prev => ({ ...prev, isProcessing: true }));

    try {
      if (isOffline || !apiKey) {
        // Queue for offline processing
        console.log('📱 Device offline or no API key - queuing recording');
        const queueId = await offlineQueueService.current.addToQueue(
          audioUri,
          jobType,
          metadata,
          stepIndex,
          metadata?.jobId
        );

        setOfflineState(prev => ({
          ...prev,
          isProcessing: false,
          isOfflineQueued: true,
          queueId,
        }));

        if (onOfflineQueued) {
          onOfflineQueued(queueId);
        }

        return audioUri;
      } else {
        // Process immediately when online
        console.log('🌐 Device online - processing immediately');
        return await processImmediately(audioUri);
      }
    } catch (error) {
      console.error('❌ Failed to process recording:', error);
      setOfflineState(prev => ({ ...prev, isProcessing: false }));
      throw error;
    }
  };

  const processImmediately = async (audioUri: string): Promise<string> => {
    if (!transcriptionService.current) {
      throw new Error('Transcription service not available');
    }

    try {
      const result = await transcriptionService.current.transcribeAudio(audioUri);
      
      setOfflineState(prev => ({ ...prev, isProcessing: false }));

      if (result.success && result.text?.trim()) {
        if (onTranscriptionComplete) {
          onTranscriptionComplete(result.text.trim(), false);
        }
        return result.text.trim();
      } else {
        throw new Error(result.error || 'Transcription failed');
      }
    } catch (error) {
      setOfflineState(prev => ({ ...prev, isProcessing: false }));
      throw error;
    }
  };

  const getState = () => ({
    ...offlineState,
    isOffline,
    isConnected,
    canProcessImmediately: isConnected && !!apiKey,
  });

  const retryQueuedItem = async (queueId: string): Promise<void> => {
    if (!apiKey || isOffline) {
      throw new Error('Cannot retry: offline or no API key');
    }

    await offlineQueueService.current.processQueue(apiKey);
  };

  return {
    startRecording,
    stopRecording,
    formatDuration,
    state: getState(),
    retryQueuedItem,
    offlineQueueService: offlineQueueService.current,
  };
}