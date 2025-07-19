import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { TranscriptionService } from '@/services/transcription';
import { JobStorageService } from '@/services/jobStorage';
import { AudioQuestionService } from '@/services/audioQuestions';
import { JobData, DEFAULT_JOB_STEPS } from '@/types/job';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSettings } from '@/contexts/SettingsContext';
import Tts from 'react-native-tts';
import * as Speech from 'expo-speech';

interface MinimalJobWorkflowProps {
  openAiApiKey: string;
  onComplete: (jobData: JobData) => void;
  onCancel: () => void;
}

type State = 'speaking' | 'ready' | 'recording' | 'processing' | 'review';

export default function MinimalJobWorkflow({
  openAiApiKey,
  onComplete,
  onCancel,
}: MinimalJobWorkflowProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { voiceTone } = useSettings();
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [state, setState] = useState<State>('ready');
  const [answers, setAnswers] = useState<string[]>([]);
  const [useTts, setUseTts] = useState(false);
  const [isRecordingTransition, setIsRecordingTransition] = useState(false);
  const isMountedRef = useRef(true);
  const audioTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const transcriptionService = new TranscriptionService(openAiApiKey);
  const storageService = new JobStorageService();
  const audioQuestionServiceRef = useRef(new AudioQuestionService());
  const audioQuestionService = audioQuestionServiceRef.current;
  const { startRecording, stopRecording, formatDuration, state: recordingState } = useAudioRecording();

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initialize TTS
    const initializeTts = async () => {
      try {
        // Test if react-native-tts is available
        if (Tts && typeof Tts.setDefaultRate === 'function') {
          await Tts.setDefaultRate(0.5);
          await Tts.setDefaultPitch(1.0);
          
          // Try to get available voices and set a good one
          const voices = await Tts.voices();
          console.log('react-native-tts available, voices:', voices.length);
          
          // Look for high-quality voices
          const preferredVoices = [
            'com.apple.ttsbundle.Samantha-compact',
            'com.apple.ttsbundle.Alex-compact',
            'en-US-language',
            'en-us-x-sfg#female_1-local',
            'en-us-x-sfg#male_1-local'
          ];
          
          for (const voiceId of preferredVoices) {
            const voice = voices.find(v => v.id === voiceId);
            if (voice) {
              await Tts.setDefaultVoice(voiceId);
              console.log('Using react-native-tts voice:', voice.name);
              break;
            }
          }
          
          setUseTts(true);
          console.log('react-native-tts initialized successfully');
        } else {
          console.log('react-native-tts not available, using expo-speech');
          setUseTts(false);
        }
      } catch (error) {
        console.log('TTS initialization error, falling back to expo-speech:', error);
        setUseTts(false);
      }
    };
    
    initializeTts();
    
    // Clear any existing workflows to start fresh
    const clearOldWorkflows = async () => {
      try {
        await storageService.deleteAllWorkflows();
      } catch (error) {
        console.log('No workflows to clear');
      }
    };
    
    clearOldWorkflows();
    
    // Initialize with empty answers
    setAnswers(new Array(DEFAULT_JOB_STEPS.length).fill(''));
    
    // Speak first question after a short delay
    setTimeout(() => {
      if (isMountedRef.current) {
        speakQuestion(0);
      }
    }, 1000);

    return () => {
      isMountedRef.current = false;
      
      // Clear any running timer
      if (audioTimerRef.current) {
        clearTimeout(audioTimerRef.current);
        audioTimerRef.current = null;
      }
      
      try {
        // Stop all audio sources
        audioQuestionService.stopAudio();
        if (useTts && Tts) {
          Tts.stop();
        } else {
          Speech.stop();
        }
      } catch (error) {
        console.log('Cleanup error:', error);
      }
    };
  }, []);

  const speakQuestion = async (stepIndex: number) => {
    if (!isMountedRef.current || stepIndex >= DEFAULT_JOB_STEPS.length) return;
    
    const questionNumber = stepIndex + 1;
    console.log(`🗣️ DEBUG: Speaking question ${questionNumber} with tone: ${voiceTone}`);
    console.log(`🗣️ DEBUG: Current state before speaking:`, state);
    
    // Clear any existing audio timer first
    if (audioTimerRef.current) {
      console.log('🗣️ DEBUG: Clearing existing audio timer');
      clearTimeout(audioTimerRef.current);
      audioTimerRef.current = null;
    }
    
    // Reset any recording transition state
    setIsRecordingTransition(false);
    
    console.log(`🗣️ DEBUG: Setting state to 'speaking'`);
    setState('speaking');
    
    try {
      // First try to play recorded audio if not using default
      if (voiceTone !== 'default') {
        try {
          await audioQuestionService.playQuestion(questionNumber, voiceTone);
          
          // Set a timer to change state to ready after a reasonable time
          // Since we can't easily track audio completion with our current setup
          audioTimerRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              console.log(`🗣️ DEBUG: Audio timer completed, setting state to 'ready'`);
              setState('ready');
              audioTimerRef.current = null;
            }
          }, 2500); // Reduced from 3000ms for better responsiveness
          
          return;
        } catch (audioError) {
          console.log('Audio playback failed, falling back to TTS:', audioError);
        }
      }

      // Fallback to TTS for 'default' tone or if audio fails
      const question = DEFAULT_JOB_STEPS[stepIndex].question;
      
      if (useTts && Tts) {
        // Stop any existing speech first
        Tts.stop();
        
        // Set up completion listener
        const finishListener = () => {
          if (isMountedRef.current) {
            console.log(`🗣️ DEBUG: TTS finished, setting state to 'ready'`);
            setState('ready');
          }
          Tts.removeEventListener('tts-finish', finishListener);
        };
        
        Tts.addEventListener('tts-finish', finishListener);
        
        // Speak with react-native-tts
        Tts.speak(question);
      } else {
        // Fallback to expo-speech
        Speech.stop();
        
        Speech.speak(question, {
          language: 'en-US',
          pitch: 1.0,
          rate: 0.75,
          onDone: () => {
            if (isMountedRef.current) {
              console.log(`🗣️ DEBUG: expo-speech finished, setting state to 'ready'`);
              setState('ready');
            }
          },
          onError: (error) => {
            console.error('Speech error:', error);
            if (isMountedRef.current) {
              setState('ready');
            }
          }
        });
      }
    } catch (error) {
      console.error('Speech failed:', error);
      setState('ready');
    }
  };

  const handleButtonPress = async () => {
    // Prevent multiple rapid button presses
    if (isRecordingTransition || state === 'processing') {
      return;
    }

    if (state === 'speaking') {
      // Interrupt speaking and start recording
      setIsRecordingTransition(true);
      
      // Clear audio timer
      if (audioTimerRef.current) {
        clearTimeout(audioTimerRef.current);
        audioTimerRef.current = null;
      }
      
      // Stop audio quickly
      try {
        await audioQuestionService.forceStop();
        if (useTts && Tts) {
          Tts.stop();
        } else {
          Speech.stop();
        }
      } catch (error) {
        console.log('Audio stop error:', error);
      }
      
      // Start recording immediately
      setState('recording');
      try {
        await startRecording();
      } catch (error) {
        console.error('Failed to start recording:', error);
        setState('ready');
      }
      setIsRecordingTransition(false);
      
    } else if (state === 'recording') {
      // Stop recording - let handleStopRecording manage the state
      await handleStopRecording();
      
    } else if (state === 'ready') {
      // Start recording from ready state
      setIsRecordingTransition(true);
      setState('recording');
      try {
        await startRecording();
      } catch (error) {
        console.error('Failed to start recording:', error);
        setState('ready');
      }
      setIsRecordingTransition(false);
    }
  };

  const handleStopRecording = async () => {
    setState('processing');
    
    const audioUri = await stopRecording();
    if (!audioUri) {
      Alert.alert('Error', 'No audio recorded');
      setState('ready');
      return;
    }

    try {
      const result = await transcriptionService.transcribeAudio(audioUri);
      
      if (result.success && result.text.trim()) {
        // Save answer
        const newAnswers = [...answers];
        newAnswers[currentStepIndex] = result.text.trim();
        setAnswers(newAnswers);
        
        // Move to next step
        const nextIndex = currentStepIndex + 1;
        
        if (nextIndex >= DEFAULT_JOB_STEPS.length) {
          // Move to completion view with a delay to let processing finish
          setTimeout(() => {
            setCurrentStepIndex(DEFAULT_JOB_STEPS.length); // Set to completion state
            setState('review');
          }, 1000); // 1 second delay to let processing UI finish
        } else {
          // Next question
          setCurrentStepIndex(nextIndex);
          // Wait a bit longer to ensure UI has updated and previous operations are complete
          setTimeout(() => speakQuestion(nextIndex), 1500);
        }
      } else {
        Alert.alert('Transcription Failed', result.error || 'Could not transcribe audio');
        setState('ready');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      Alert.alert('Error', 'Failed to transcribe audio');
      setState('ready');
    }
  };

  const completeWorkflow = async (finalAnswers: string[]) => {
    try {
      const now = new Date();
      const jobData: JobData = {
        id: Date.now().toString(),
        customer: finalAnswers[0] || '',
        jobType: finalAnswers[1] || '',
        equipment: finalAnswers[2] || '',
        cost: finalAnswers[3] || '',
        additionalNotes: finalAnswers[4] || '',
        dateCreated: now.toISOString(),
        dateCompleted: now.toISOString(),
        status: 'completed',
        totalSteps: DEFAULT_JOB_STEPS.length,
        completedSteps: DEFAULT_JOB_STEPS.length,
      };

      // Show completion options
      Alert.alert(
        'Job Complete!',
        'What would you like to do with this job?',
        [
          { 
            text: 'Review Answers', 
            style: 'cancel',
            onPress: () => {
              // Set a special state to show final review with save option
              setState('review');
            }
          },
          { 
            text: 'Save Job', 
            onPress: async () => {
              await storageService.saveJob(jobData);
              Alert.alert('Success', 'Job saved successfully!', [
                { text: 'OK', onPress: () => onComplete(jobData) }
              ]);
            }
          },
          { 
            text: 'View Summary', 
            onPress: async () => {
              await storageService.saveJob(jobData);
              onComplete(jobData);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Failed to complete workflow:', error);
      Alert.alert('Error', 'Failed to save job');
    }
  };

  const repeatQuestion = async () => {
    // Prevent multiple rapid calls
    if (isRecordingTransition || state === 'processing') {
      return;
    }

    // Clear any running audio timer
    if (audioTimerRef.current) {
      console.log('🎤 DEBUG: Clearing audio timer for repeat');
      clearTimeout(audioTimerRef.current);
      audioTimerRef.current = null;
    }

    // Stop any currently playing audio first
    try {
      await audioQuestionService.stopAudio();
      if (useTts && Tts) {
        Tts.stop();
      } else {
        Speech.stop();
      }
    } catch (error) {
      console.log('Error stopping audio before repeat:', error);
    }
    
    speakQuestion(currentStepIndex);
  };

  const skipStep = async () => {
    // Clear any running audio timer
    if (audioTimerRef.current) {
      console.log('🎤 DEBUG: Clearing audio timer for skip');
      clearTimeout(audioTimerRef.current);
      audioTimerRef.current = null;
    }
    
    // Stop any active recording first
    if (recordingState.isRecording) {
      console.log('🎤 DEBUG: Stopping active recording before skip');
      try {
        await stopRecording();
        setState('ready');
      } catch (error) {
        console.log('Error stopping recording before skip:', error);
      }
    }
    
    // Stop any currently playing audio first - use forceStop for better interruption
    try {
      await audioQuestionService.forceStop();
      if (useTts && Tts) {
        Tts.stop();
      } else {
        Speech.stop();
      }
      
      // Wait a bit to ensure audio has stopped before continuing
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      console.log('Error stopping audio before skip:', error);
    }
    
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= DEFAULT_JOB_STEPS.length) {
      // Move to completion view instead of calling completeWorkflow
      setTimeout(() => {
        setCurrentStepIndex(DEFAULT_JOB_STEPS.length);
        setState('review');
      }, 500); // Shorter delay for skip
    } else {
      setCurrentStepIndex(nextIndex);
      // Wait a bit to ensure audio has stopped before starting new question
      setTimeout(() => speakQuestion(nextIndex), 200);
    }
  };

  const goBackStep = async () => {
    if ((currentStepIndex > 0 || state === 'review') && !isRecordingTransition && state !== 'processing') {
      // Clear any running audio timer
      if (audioTimerRef.current) {
        console.log('🎤 DEBUG: Clearing audio timer for go back');
        clearTimeout(audioTimerRef.current);
        audioTimerRef.current = null;
      }
      
      // Stop any audio first
      try {
        await audioQuestionService.stopAudio();
        if (useTts && Tts) {
          Tts.stop();
        } else {
          Speech.stop();
        }
      } catch (error) {
        console.log('Error stopping audio before going back:', error);
      }

      if (state === 'review') {
        // Going back from review state to last question
        const prevIndex = DEFAULT_JOB_STEPS.length - 1;
        setCurrentStepIndex(prevIndex);
        setState('ready');
        // Don't clear the answer - let them keep what they recorded
        speakQuestion(prevIndex);
      } else {
        const prevIndex = currentStepIndex - 1;
        setCurrentStepIndex(prevIndex);
        // Clear the current answer so they can re-record
        const newAnswers = [...answers];
        newAnswers[currentStepIndex] = '';
        setAnswers(newAnswers);
        speakQuestion(prevIndex);
      }
    }
  };

  if (currentStepIndex >= DEFAULT_JOB_STEPS.length && state !== 'review') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={[styles.text, { color: colors.text }]}>Completing...</Text>
      </View>
    );
  }


  // Handle review state
  const isReviewMode = state === 'review' && currentStepIndex >= DEFAULT_JOB_STEPS.length;
  const displayStepIndex = isReviewMode ? DEFAULT_JOB_STEPS.length - 1 : currentStepIndex;
  const currentStep = DEFAULT_JOB_STEPS[displayStepIndex];
  const progress = isReviewMode ? 1 : (currentStepIndex + 1) / DEFAULT_JOB_STEPS.length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: '#ffffff', borderColor: '#000000' }]}
          onPress={onCancel}
        >
          <IconSymbol name="house" size={16} color="#000000" />
          <Text style={[styles.backText, { color: '#000000' }]}>Home</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Job Entry</Text>
        <TouchableOpacity onPress={repeatQuestion}>
          <IconSymbol name="speaker.wave.2" size={24} color={colors.tint} />
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: colors.text + '20' }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={[styles.progressText, { color: colors.text }]}>
          {state === 'review' ? 'All Steps Complete' : `Step ${currentStepIndex + 1} of ${DEFAULT_JOB_STEPS.length}`}
        </Text>
      </View>

      {/* Question */}
      <View style={styles.questionContainer}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {state === 'review' ? 'Job Recording Complete!' : currentStep.question}
        </Text>
      </View>

      {/* Main Button */}
      <View style={styles.buttonContainer}>
        {state === 'speaking' && (
          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: colors.tint }]}
            onPress={handleButtonPress}
          >
            <IconSymbol name="mic.circle" size={48} color="white" />
            <Text style={styles.buttonText}>Tap to Interrupt & Answer</Text>
          </TouchableOpacity>
        )}

        {state === 'ready' && (
          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: colors.tint }]}
            onPress={handleButtonPress}
          >
            <IconSymbol name="mic.circle" size={48} color="white" />
            <Text style={styles.buttonText}>Tap to Answer</Text>
          </TouchableOpacity>
        )}

        {state === 'recording' && (
          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: '#ff4444' }]}
            onPress={handleButtonPress}
          >
            <IconSymbol name="stop.circle" size={48} color="white" />
            <Text style={styles.buttonText}>Done Speaking</Text>
            <Text style={styles.recordingTime}>
              {formatDuration(recordingState.duration)}
            </Text>
          </TouchableOpacity>
        )}

        {state === 'processing' && (
          <View style={[styles.mainButton, { backgroundColor: '#666' }]}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.buttonText}>Processing...</Text>
          </View>
        )}

        {state === 'review' && (
          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: '#10b981' }]}
            onPress={async () => {
              const now = new Date();
              const jobData: JobData = {
                id: Date.now().toString(),
                customer: answers[0] || '',
                jobType: answers[1] || '',
                equipment: answers[2] || '',
                cost: answers[3] || '',
                additionalNotes: answers[4] || '',
                dateCreated: now.toISOString(),
                dateCompleted: now.toISOString(),
                status: 'completed',
                totalSteps: DEFAULT_JOB_STEPS.length,
                completedSteps: DEFAULT_JOB_STEPS.length,
              };
              
              await storageService.saveJob(jobData);
              Alert.alert('Success', 'Job saved successfully!', [
                { text: 'OK', onPress: () => onComplete(jobData) }
              ]);
            }}
          >
            <IconSymbol name="checkmark.circle" size={48} color="white" />
            <Text style={styles.buttonText}>Save Job</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Previous Answers */}
      <ScrollView style={styles.answersContainer} showsVerticalScrollIndicator={false}>
        <Text style={[styles.answersTitle, { color: colors.text }]}>
          {state === 'review' ? 'Review Your Answers:' : 'Progress:'}
        </Text>
        {(state === 'review' ? DEFAULT_JOB_STEPS : DEFAULT_JOB_STEPS.slice(0, currentStepIndex)).map((step, index) => (
          <View key={index} style={[styles.answerItem, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
            <Text style={[styles.answerLabel, { color: colors.text }]}>
              {step.question}
            </Text>
            <Text style={[styles.answerText, { color: colors.text }]}>
              {answers[index] || 'Skipped'}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        {(currentStepIndex > 0 || state === 'review') && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#FF6B35' }]}
            onPress={goBackStep}
          >
            <IconSymbol name="arrow.left" size={16} color="white" />
            <Text style={styles.actionButtonText}>
              {state === 'review' ? 'Edit Last Answer' : 'Go Back'}
            </Text>
          </TouchableOpacity>
        )}
        
        {state !== 'review' && (
          <TouchableOpacity
            style={[styles.actionButton, { 
              backgroundColor: currentStepIndex === DEFAULT_JOB_STEPS.length - 1 ? '#10b981' : '#666' 
            }]}
            onPress={skipStep}
          >
            <Text style={styles.actionButtonText}>
              {currentStepIndex === DEFAULT_JOB_STEPS.length - 1 ? 'Save Job' : 'Skip This Step'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginBottom: 30,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#0a7ea4',
  },
  progressText: {
    fontSize: 14,
    textAlign: 'center',
  },
  questionContainer: {
    marginBottom: 40,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#0a7ea4' + '10',
    borderWidth: 2,
    borderColor: '#0a7ea4',
  },
  questionText: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  mainButton: {
    alignItems: 'center',
    padding: 30,
    borderRadius: 20,
    gap: 10,
    minWidth: 200,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  recordingTime: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'SpaceMono',
  },
  answersContainer: {
    flex: 1,
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  answersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  answerItem: {
    marginBottom: 10,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    opacity: 0.7,
  },
  answerText: {
    fontSize: 14,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    gap: 8,
    minWidth: 120,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
});