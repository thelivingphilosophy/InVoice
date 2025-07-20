import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconSymbol } from '@/components/ui/IconSymbol';
import CustomAlert from '@/components/ui/CustomAlert';
import { Image } from 'react-native';
import VoiceRecorder from '@/components/VoiceRecorder';
import JobDetailsForm, { JobDetails } from '@/components/JobDetailsForm';
import MinimalJobWorkflow from '@/components/MinimalJobWorkflow';
import JobSummaryScreen from '@/components/JobSummaryScreen';
import JobExportScreen from '@/components/JobExportScreen';
import AllJobsScreen from '@/components/AllJobsScreen';
import SettingsScreen from '@/components/SettingsScreen';
import ErrorBoundary from '@/components/ErrorBoundary';
import OfflineIndicator from '@/components/OfflineIndicator';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useNetwork } from '@/contexts/NetworkContext';
import { JobStorageService } from '@/services/jobStorage';
import { JobData, JobWorkflow } from '@/types/job';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type ViewMode = 'home' | 'recorder' | 'job-form' | 'workflow' | 'summary' | 'export' | 'all-jobs' | 'settings';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { isOffline } = useNetwork();
  const [currentView, setCurrentView] = useState<ViewMode>('home');
  const [openAiApiKey, setOpenAiApiKey] = useState('');
  
  // Quick setup for testing - you can paste your keys here
  const [testMode, setTestMode] = useState(false);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [editingJob, setEditingJob] = useState<JobDetails | null>(null);
  const [activeWorkflow, setActiveWorkflow] = useState<JobWorkflow | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const storageService = new JobStorageService();

  // Offline sync functionality
  const { isSyncing, queueStatus, manualSync } = useOfflineSync({
    apiKey: openAiApiKey,
    onSyncComplete: (processedCount) => {
      // Always refresh job data after sync, even if no items were processed
      loadInitialData();
      if (processedCount > 0) {
        Alert.alert(
          'Sync Complete',
          `Successfully processed ${processedCount} offline recordings. Job list has been updated.`,
          [{ text: 'OK' }]
        );
      }
    },
    onSyncError: (error) => {
      Alert.alert('Sync Error', `Failed to sync offline recordings: ${error}`);
      // Still refresh in case some items were processed before the error
      loadInitialData();
    },
  });

  // Load data on component mount
  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      if (!mounted) return;
      try {
        await loadInitialData();
      } catch (error) {
        console.error('Failed to load initial data:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Listen for tab presses to reset to home
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('homeTabPressed', () => {
      if (currentView !== 'home') {
        setCurrentView('home');
      }
    });

    return () => subscription.remove();
  }, [currentView]);

  // Refresh API key when returning from settings
  useEffect(() => {
    if (currentView === 'home') {
      // Reload API key when returning to home view
      const refreshApiKey = async () => {
        try {
          const savedApiKey = await AsyncStorage.getItem('openai_api_key');
          if (savedApiKey !== openAiApiKey) {
            setOpenAiApiKey(savedApiKey || '');
          }
        } catch (error) {
          console.error('Failed to refresh API key:', error);
        }
      };
      refreshApiKey();
    }
  }, [currentView]);


  const loadInitialData = async () => {
    try {
      setIsLoading(true);
      const [savedJobs, savedWorkflow, savedApiKey] = await Promise.all([
        storageService.getAllJobs(),
        storageService.getActiveWorkflow(),
        AsyncStorage.getItem('openai_api_key'),
      ]);
      setJobs(savedJobs);
      setActiveWorkflow(savedWorkflow);
      if (savedApiKey) {
        setOpenAiApiKey(savedApiKey);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranscriptionComplete = async (transcription: string) => {
    // Auto-create job without popup
    try {
      // Get existing completed voice recordings to determine next number
      const allJobs = await storageService.getAllJobs();
      const completedVoiceRecordings = allJobs.filter(job => 
        job.jobType === 'Voice Note' && job.status === 'completed'
      );
      const nextNumber = completedVoiceRecordings.length + 1;
      
      const now = new Date();
      const jobData: JobData = {
        id: Date.now().toString(),
        title: `Voice Recording ${nextNumber}`, // Use Voice Recording N+1 format
        customer: 'Voice Recording', // Actual customer type
        jobType: 'Voice Note',
        equipment: '',
        cost: '',
        location: '',
        additionalNotes: transcription,
        dateCreated: now.toISOString(),
        dateCompleted: now.toISOString(),
        status: 'completed',
        totalSteps: 1,
        completedSteps: 1,
      };

      // Save the job automatically
      await storageService.saveJob(jobData);
      await loadInitialData(); // Refresh the jobs list
      
      // Go directly to summary view
      setSelectedJob(jobData);
      setCurrentView('summary');
    } catch (error) {
      console.error('Failed to save voice recording job:', error);
      Alert.alert('Error', 'Failed to save voice recording');
    }
  };

  const handleOfflineVoiceQueued = async () => {
    // Create a job with pending_transcription status for offline recordings
    try {
      // Get existing completed voice recordings to determine next number
      const allJobs = await storageService.getAllJobs();
      const completedVoiceRecordings = allJobs.filter(job => 
        job.jobType === 'Voice Note' && job.status === 'completed'
      );
      const nextNumber = completedVoiceRecordings.length + 1;
      
      const now = new Date();
      const jobData: JobData = {
        id: Date.now().toString(),
        title: `Voice Recording ${nextNumber}`, // Use Voice Recording N+1 format
        customer: 'Voice Recording', // Actual customer type
        jobType: 'Voice Note',
        equipment: '',
        cost: '',
        location: '',
        additionalNotes: '',
        dateCreated: now.toISOString(),
        dateCompleted: '',
        status: 'pending_transcription',
        totalSteps: 1,
        completedSteps: 0,
      };

      // Save the job automatically
      await storageService.saveJob(jobData);
      await loadInitialData(); // Refresh the jobs list
      
      // Return to home view
      setCurrentView('home');
    } catch (error) {
      console.error('Failed to save offline voice recording job:', error);
      Alert.alert('Error', 'Failed to save offline voice recording');
    }
  };

  const handleSaveJob = async (job: JobDetails) => {
    try {
      // Convert old JobDetails to new JobData format
      const jobData: JobData = {
        id: job.id || Date.now().toString(),
        customer: job.clientName,
        jobType: job.jobType,
        equipment: job.materials,
        cost: job.laborHours,
        location: job.address,
        additionalNotes: job.description + (job.notes ? '\n\nNotes: ' + job.notes : ''),
        dateCreated: job.dateCreated,
        dateCompleted: job.dateCompleted,
        status: 'completed',
        totalSteps: 5,
        completedSteps: 5,
      };

      await storageService.saveJob(jobData);
      await loadInitialData(); // Refresh the jobs list
      
      setEditingJob(null);
      setCurrentView('home');
      Alert.alert('Success', 'Job details saved successfully!');
    } catch (error) {
      console.error('Failed to save job:', error);
      Alert.alert('Error', 'Failed to save job details');
    }
  };

  const handleCancelJob = () => {
    setEditingJob(null);
    setCurrentView('home');
  };

  const handleStartNewWorkflow = async () => {
    // Always clear existing workflows and start fresh
    try {
      await storageService.deleteAllWorkflows();
      setActiveWorkflow(null);
    } catch (error) {
      console.log('No workflows to clear');
    }
    // Don't clear API key - let it persist between workflows
    setCurrentView('workflow');
  };

  const handleWorkflowComplete = async (jobData: JobData) => {
    await loadInitialData(); // Refresh the jobs list
    setActiveWorkflow(null);
    setSelectedJob(jobData);
    setCurrentView('summary');
  };

  const handleWorkflowCancel = async () => {
    await loadInitialData(); // Refresh to get updated workflow state
    setCurrentView('home');
  };

  const handleJobSelect = (job: JobData) => {
    setSelectedJob(job);
    setCurrentView('summary');
  };

  const handleEditSelectedJob = () => {
    if (selectedJob) {
      // Convert JobData to JobDetails for editing
      const jobDetails: JobDetails = {
        id: selectedJob.id,
        clientName: selectedJob.customer,
        address: selectedJob.location || '',
        jobType: selectedJob.jobType,
        description: selectedJob.additionalNotes || '',
        materials: selectedJob.equipment,
        laborHours: selectedJob.cost,
        notes: '',
        dateCreated: selectedJob.dateCreated,
        dateCompleted: selectedJob.dateCompleted,
      };
      setEditingJob(jobDetails);
      setCurrentView('job-form');
    }
  };

  const handleSummaryClose = async () => {
    await loadInitialData(); // Refresh jobs list
    setSelectedJob(null);
    setCurrentView('home');
  };

  const handleExportJobs = () => {
    setCurrentView('export');
  };

  const handleSeeAllJobs = () => {
    setCurrentView('all-jobs');
  };

  const handleSettings = () => {
    setCurrentView('settings');
  };

  if (currentView === 'recorder') {
    if (!openAiApiKey.trim()) {
      // Need to show alert, but do it in useEffect to avoid infinite re-renders
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <CustomAlert
            visible={true}
            title="API Key Required"
            message="Please enter your OpenAI API key in Settings to enable voice transcription."
            buttons={[
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => setCurrentView('home')
              },
              {
                text: "Go to Settings",
                onPress: () => setCurrentView('settings')
              }
            ]}
            onRequestClose={() => setCurrentView('home')}
          />
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: 60 }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: '#f89448', borderColor: '#f89448' }]}
            onPress={() => setCurrentView('home')}
          >
            <IconSymbol name="chevron.left" size={16} color="white" />
            <Text style={[styles.backText, { color: 'white' }]}>Back</Text>
          </TouchableOpacity>
          <View style={styles.titleContainer} />
          <View style={styles.rightSection} />
        </View>
        <VoiceRecorder
          key="voice-recorder"
          openAiApiKey={openAiApiKey}
          onTranscriptionComplete={handleTranscriptionComplete}
          onOfflineQueued={handleOfflineVoiceQueued}
        />
      </View>
    );
  }

  if (currentView === 'workflow') {
    if (!openAiApiKey.trim()) {
      // Need to show alert, but do it in useEffect to avoid infinite re-renders
      return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <CustomAlert
            visible={true}
            title="API Key Required"
            message="Please enter your OpenAI API key in Settings to enable voice transcription for job workflows."
            buttons={[
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => setCurrentView('home')
              },
              {
                text: "Go to Settings",
                onPress: () => setCurrentView('settings')
              }
            ]}
            onRequestClose={() => setCurrentView('home')}
          />
        </View>
      );
    }

    return (
      <ErrorBoundary>
        <MinimalJobWorkflow
          openAiApiKey={openAiApiKey}
          onComplete={handleWorkflowComplete}
          onCancel={handleWorkflowCancel}
        />
      </ErrorBoundary>
    );
  }

  if (currentView === 'summary' && selectedJob) {
    return (
      <JobSummaryScreen
        job={selectedJob}
        onClose={handleSummaryClose}
        onEdit={handleEditSelectedJob}
        onStartNewJob={handleStartNewWorkflow}
      />
    );
  }

  if (currentView === 'export') {
    return (
      <JobExportScreen
        onClose={() => setCurrentView('home')}
      />
    );
  }

  if (currentView === 'all-jobs') {
    return (
      <AllJobsScreen
        onClose={() => setCurrentView('home')}
        onJobSelect={handleJobSelect}
      />
    );
  }

  if (currentView === 'settings') {
    return (
      <SettingsScreen
        onClose={() => setCurrentView('home')}
      />
    );
  }

  if (currentView === 'job-form') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: 60 }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: '#f89448', borderColor: '#f89448' }]}
            onPress={handleCancelJob}
          >
            <IconSymbol name="house" size={16} color="white" />
            <Text style={[styles.backText, { color: 'white' }]}>Home</Text>
          </TouchableOpacity>
          <View style={styles.titleContainer} />
          <View style={styles.rightSection} />
        </View>
        <JobDetailsForm
          key="job-form"
          initialJob={editingJob || undefined}
          onSave={handleSaveJob}
          onCancel={handleCancelJob}
        />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background }]} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Header with Settings */}
          <View style={styles.homeHeader}>
            <View style={styles.headerLeft} />
            <View style={styles.headerCenter}>
              <Image 
                source={require('@/assets/images/icon.png')} 
                style={styles.logo}
              />
              <Text style={[styles.title, { color: colors.text }]}>
                InVoice
              </Text>
              <Text style={[styles.subtitle, { color: colors.text }]}>
                Step-by-step voice workflow for job documentation
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.settingsButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={handleSettings}
            >
              <IconSymbol name="gearshape" size={20} color="white" />
            </TouchableOpacity>
          </View>

        {/* Offline Indicator */}
        <OfflineIndicator />

        {/* Resume Workflow Banner */}
        {activeWorkflow && (
          <TouchableOpacity
            style={[styles.resumeBanner, { backgroundColor: '#0a7ea4' + '20', borderColor: '#0a7ea4' }]}
            onPress={() => setCurrentView('workflow')}
          >
            <View style={styles.resumeContent}>
              <IconSymbol name="play.circle" size={24} color={colors.tint} />
              <View style={styles.resumeText}>
                <Text style={[styles.resumeTitle, { color: colors.tint }]}>
                  Resume Job in Progress
                </Text>
                <Text style={[styles.resumeSubtitle, { color: colors.text }]}>
                  Step {activeWorkflow.currentStepIndex + 1} of {activeWorkflow.steps.length}
                </Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.tint} />
          </TouchableOpacity>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.buttonPrimary }]}
            onPress={handleStartNewWorkflow}
          >
            <IconSymbol name="mic.circle" size={32} color="white" />
            <Text style={styles.actionButtonText}>
              {activeWorkflow ? 'New Job Workflow' : 'Start Job Workflow'}
            </Text>
          </TouchableOpacity>
          

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.buttonSecondary }]}
            onPress={handleExportJobs}
          >
            <IconSymbol name="square.and.arrow.up" size={32} color="white" />
            <Text style={styles.actionButtonText}>Export Jobs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.buttonTertiary }]}
            onPress={() => setCurrentView('recorder')}
          >
            <IconSymbol name="mic" size={32} color="white" />
            <Text style={styles.actionButtonText}>Voice Recorder</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.buttonQuaternary }]}
            onPress={() => setCurrentView('job-form')}
          >
            <IconSymbol name="doc.text" size={32} color="white" />
            <Text style={styles.actionButtonText}>Manual Job Entry</Text>
          </TouchableOpacity>
        </View>

        {jobs.length > 0 && (
          <View style={styles.jobsList}>
            <Text style={[styles.jobsTitle, { color: colors.text }]}>
              Latest Jobs ({jobs.length})
            </Text>
            {jobs
              .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
              .slice(0, 3)
              .map(job => (
              <TouchableOpacity
                key={job.id}
                style={[styles.jobItem, { 
                  backgroundColor: '#12273a', 
                  borderColor: colors.border,
                  shadowColor: '#000000',
                  shadowOffset: { width: 3, height: 3 },
                  shadowOpacity: 0.15,
                  shadowRadius: 4,
                  elevation: 6,
                }]}
                onPress={() => handleJobSelect(job)}
              >
                <View style={styles.jobHeader}>
                  <Text style={[styles.jobClient, { color: '#ffffff' }]}>
                    {job.title || job.customer || 'Unnamed Job'}
                  </Text>
                  <View style={[styles.statusBadge, { 
                    backgroundColor: job.status === 'completed' ? '#22c55e20' : '#f59e0b20' 
                  }]}>
                    <Text style={[styles.statusText, { 
                      color: job.status === 'completed' ? '#22c55e' : '#f59e0b' 
                    }]}>
                      {job.status}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.jobType, { color: '#ffffff' }]}>
                  {job.jobType === 'Voice Note' ? job.jobType : (job.customer || 'General Work')}
                </Text>
                <Text style={[styles.jobProgress, { color: '#ffffff' }]}>
                  {job.completedSteps}/{job.totalSteps} steps • {new Date(job.dateCreated).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            ))}
            
            {/* See More Jobs Button */}
            <TouchableOpacity
              style={[styles.seeMoreButton, { backgroundColor: '#666' }]}
              onPress={handleSeeAllJobs}
            >
              <IconSymbol name="list.bullet" size={20} color="white" />
              <Text style={styles.seeMoreButtonText}>See All Jobs ({jobs.length})</Text>
            </TouchableOpacity>
            
            {/* Export Button */}
            <TouchableOpacity
              style={[styles.exportButton, { backgroundColor: colors.buttonTertiary }]}
              onPress={handleExportJobs}
            >
              <IconSymbol name="square.and.arrow.up" size={20} color="white" />
              <Text style={styles.exportButtonText}>Export Jobs</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>

    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 40, // Reduced padding since no bottom tabs
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Roboto' : 'Roboto',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 140,
    opacity: 0.8,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 10,
  },
  resumeBanner: {
    width: '100%',
    maxWidth: 400,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 30,
  },
  resumeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resumeText: {
    flex: 1,
  },
  resumeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resumeSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  apiKeyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    width: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  apiKeyInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginVertical: 10,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  actions: {
    gap: 15,
    marginBottom: 40,
    width: '100%',
    maxWidth: 320,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    gap: 10,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 5,
    width: '100%',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  jobsList: {
    width: '100%',
    maxWidth: 400,
  },
  jobsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  jobItem: {
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobClient: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  jobType: {
    fontSize: 14,
    marginBottom: 5,
  },
  jobProgress: {
    fontSize: 12,
    opacity: 0.7,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
    gap: 8,
  },
  exportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginTop: 15,
    marginBottom: 10,
    gap: 8,
  },
  seeMoreButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 40,
    paddingTop: 20,
  },
  headerLeft: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
    marginTop: 20,
    marginBottom: 8,
    resizeMode: 'contain',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  settingsIcon: {
    width: 20,
    height: 20,
    tintColor: '#ffffff',
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  rightSection: {
    width: 70,
    alignItems: 'flex-end',
  },
  titleUnderline: {
    width: 60,
    height: 3,
    backgroundColor: '#f89448',
    marginTop: 8,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
