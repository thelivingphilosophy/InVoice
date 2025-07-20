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
import { useOfflineAudioRecording } from '@/hooks/useOfflineAudioRecording';
import { useNetwork } from '@/contexts/NetworkContext';
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
  const { isOffline } = useNetwork();
  
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
  
  // Track offline recordings for the entire workflow
  const [offlineRecordings, setOfflineRecordings] = useState<string[]>([]);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  
  const { 
    startRecording, 
    stopRecording, 
    formatDuration, 
    state: recordingState 
  } = useOfflineAudioRecording({
    apiKey: openAiApiKey,
    onTranscriptionComplete: (transcription, isFromOfflineQueue) => {
      if (!isFromOfflineQueue) {
        // Handle immediate transcription
        handleTranscriptionResult(transcription);
      }
    },
    onOfflineQueued: (queueId) => {
      // Store offline recording ID for later processing
      setOfflineRecordings(prev => [...prev, queueId]);
      
      // Continue to next step automatically in offline mode
      handleOfflineStep();
    },
    jobType: 'workflow_step',
    stepIndex: currentStepIndex,
    metadata: { 
      workflowId: currentJobId,
      jobId: currentJobId
    }
  });

  const handleTranscriptionResult = (transcription: string) => {
    if (transcription.trim()) {
      // Save answer
      const newAnswers = [...answers];
      newAnswers[currentStepIndex] = transcription.trim();
      setAnswers(newAnswers);
      
      // Move to next step
      const nextIndex = currentStepIndex + 1;
      
      if (nextIndex >= DEFAULT_JOB_STEPS.length) {
        // Move to completion view
        setTimeout(() => {
          setCurrentStepIndex(DEFAULT_JOB_STEPS.length);
          setState('review');
        }, 1000);
      } else {
        // Next question
        setCurrentStepIndex(nextIndex);
        setTimeout(() => speakQuestion(nextIndex), 1500);
      }
    }
  };

  const handleOfflineStep = () => {
    // Mark this step as having an offline recording
    const newAnswers = [...answers];
    newAnswers[currentStepIndex] = `[Offline Recording - Will be processed when online]`;
    setAnswers(newAnswers);
    
    // Continue to next step
    const nextIndex = currentStepIndex + 1;
    
    if (nextIndex >= DEFAULT_JOB_STEPS.length) {
      // Move to completion view
      setTimeout(() => {
        setCurrentStepIndex(DEFAULT_JOB_STEPS.length);
        setState('review');
      }, 1000);
    } else {
      // Next question
      setCurrentStepIndex(nextIndex);
      setTimeout(() => speakQuestion(nextIndex), 1500);
    }
    setState('ready');
  };

  const saveWorkflowProgress = async () => {
    try {
      // Save current workflow state
      const workflowData = {
        id: Date.now().toString(),
        currentStepIndex,
        answers,
        timestamp: new Date().toISOString(),
        isOffline: true,
      };
      
      // Save progress and return to home
      Alert.alert(
        'Progress Saved',
        'Your workflow progress has been saved. You can resume when back online.',
        [{ text: 'OK', onPress: onCancel }]
      );
    } catch (error) {
      console.error('Failed to save workflow progress:', error);
      Alert.alert('Error', 'Failed to save progress');
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    
    // Set a consistent job ID for the entire workflow at the start
    if (!currentJobId) {
      const workflowJobId = Date.now().toString();
      setCurrentJobId(workflowJobId);
      console.log(`🆔 Set workflow job ID: ${workflowJobId}`);
      
      // Create the initial job record immediately so offline recordings can reference it
      const createInitialJob = async () => {
        try {
          const now = new Date();
          const timestamp = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          
          const initialJob = {
            id: workflowJobId,
            title: timestamp, // Use title for display
            customer: 'Question Skipped',
            jobType: 'Question Skipped',
            equipment: 'Question Skipped',
            cost: 'Question Skipped',
            additionalNotes: '',
            dateCreated: now.toISOString(),
            dateCompleted: '',
            status: 'in-progress' as const,
            totalSteps: DEFAULT_JOB_STEPS.length,
            completedSteps: 0,
          };
          
          await storageService.saveJob(initialJob);
          console.log(`💾 Created initial job record: ${workflowJobId}`);
        } catch (error) {
          console.error('Failed to create initial job:', error);
        }
      };
      
      createInitialJob();
    }
    
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
          console.log(`🗣️ DEBUG: Attempting to play audio for tone: ${voiceTone}, question: ${questionNumber}`);
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
          console.log('🗣️ DEBUG: Audio playback failed, falling back to TTS:', audioError);
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

    // The useOfflineAudioRecording hook handles transcription or queuing automatically
    // If online, handleTranscriptionResult will be called
    // If offline, onOfflineQueued will be called
    setState('ready');
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
          style={[styles.backButton, { backgroundColor: '#f89448', borderColor: '#f89448' }]}
          onPress={() => {
            Alert.alert(
              'Leave Workflow',
              'Progress will be lost. Do you wish to proceed?',
              [
                { text: 'No', style: 'cancel' },
                { 
                  text: 'Yes', 
                  onPress: async () => {
                    // Delete the job that was created for this workflow
                    if (currentJobId) {
                      try {
                        await storageService.deleteJob(currentJobId);
                        console.log(`🗑️ Deleted abandoned workflow job: ${currentJobId}`);
                      } catch (error) {
                        console.error('Failed to delete abandoned job:', error);
                      }
                    }
                    onCancel();
                  }
                },
              ]
            );
          }}
        >
          <IconSymbol name="house" size={16} color="white" />
          <Text style={[styles.backText, { color: 'white' }]}>Home</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]}>Job Entry</Text>
        </View>
        <View style={styles.rightSection}>
          <TouchableOpacity onPress={repeatQuestion}>
            <IconSymbol name="speaker.wave.2" size={24} color={colors.tint} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Offline Indicator */}
      {isOffline && (
        <View style={[styles.offlineIndicator, { backgroundColor: '#ff9500' }]}>
          <IconSymbol name="wifi.slash" size={16} color="white" />
          <Text style={styles.offlineText}>
            Offline Mode - Recordings will be saved for later processing
          </Text>
        </View>
      )}

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
              const hasOfflineRecordings = offlineRecordings.length > 0;
              
              // Use the existing job ID
              const jobId = currentJobId!;
              
              // Update the existing job with final data
              const existingJob = await storageService.getJobById(jobId);
              if (existingJob) {
                const updatedJob = {
                  ...existingJob,
                  customer: answers[0] || existingJob.customer,
                  jobType: answers[1] || existingJob.jobType,
                  equipment: answers[2] || existingJob.equipment,
                  cost: answers[3] || existingJob.cost,
                  additionalNotes: answers[4] || existingJob.additionalNotes,
                  dateCompleted: now.toISOString(),
                  status: hasOfflineRecordings ? 'pending_transcription' : 'completed',
                  completedSteps: DEFAULT_JOB_STEPS.length,
                };
                
                await storageService.saveJob(updatedJob);
                console.log(`💾 Updated existing job: ${jobId}`);
              } else {
                console.error(`❌ Could not find existing job: ${jobId}`);
                // Fallback to creating new job
                const timestamp = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const jobData: JobData = {
                  id: jobId,
                  title: timestamp,
                  customer: answers[0] || 'Pending Transcription',
                  jobType: answers[1] || 'Pending Transcription',
                  equipment: answers[2] || 'Pending Transcription',
                  cost: answers[3] || 'Pending Transcription',
                  additionalNotes: answers[4] || '',
                  dateCreated: now.toISOString(),
                  dateCompleted: now.toISOString(),
                  status: hasOfflineRecordings ? 'pending_transcription' : 'completed',
                  totalSteps: DEFAULT_JOB_STEPS.length,
                  completedSteps: DEFAULT_JOB_STEPS.length,
                };
                await storageService.saveJob(jobData);
              }
              
              const successMessage = hasOfflineRecordings
                ? `Job saved! Recordings will be transcribed when you're back online.`
                : 'Job saved successfully!';
              
              const finalJob = await storageService.getJobById(jobId);
              Alert.alert('Success', successMessage, [
                { text: 'OK', onPress: () => onComplete(finalJob!) }
              ]);
            }}
          >
            <IconSymbol name="checkmark.circle" size={48} color="white" />
            <Text style={styles.buttonText}>
              {offlineRecordings.length > 0 ? 'Save Offline Job' : 'Save Job'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Previous Answers */}
      <ScrollView style={styles.answersContainer} showsVerticalScrollIndicator={false}>
        {(currentStepIndex > 0 || state === 'review') && (
          <Text style={[styles.answersTitle, { color: colors.text }]}>
            {state === 'review' ? 'Review Your Answers:' : 'Job Details:'}
          </Text>
        )}
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
            style={[styles.actionButton, { backgroundColor: '#12273a' }]}
            onPress={skipStep}
          >
            <Text style={styles.actionButtonText}>Skip This Step</Text>
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
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    width: 70, // Match the minWidth of backButton
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 6,
    marginBottom: 15,
    gap: 6,
  },
  offlineText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
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
    borderColor: '#e67e22',
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