import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconSymbol } from '@/components/ui/IconSymbol';
import VoiceRecorder from '@/components/VoiceRecorder';
import JobDetailsForm, { JobDetails } from '@/components/JobDetailsForm';
import MinimalJobWorkflow from '@/components/MinimalJobWorkflow';
import JobSummaryScreen from '@/components/JobSummaryScreen';
import JobExportScreen from '@/components/JobExportScreen';
import AllJobsScreen from '@/components/AllJobsScreen';
import SettingsScreen from '@/components/SettingsScreen';
import ErrorBoundary from '@/components/ErrorBoundary';
import { JobStorageService } from '@/services/jobStorage';
import { JobData, JobWorkflow } from '@/types/job';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type ViewMode = 'home' | 'recorder' | 'job-form' | 'workflow' | 'summary' | 'export' | 'all-jobs' | 'settings';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
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
      // Generate auto client name for voice recordings
      const voiceRecordingCount = jobs.filter(job => 
        job.customer?.startsWith('Voice Recording ')
      ).length;
      const nextNumber = voiceRecordingCount + 1;
      
      // Create job data directly
      const now = new Date();
      const jobData: JobData = {
        id: Date.now().toString(),
        customer: `Voice Recording ${nextNumber}`,
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
      return (
        <KeyboardAvoidingView 
          style={[styles.container, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'position' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
          enabled={true}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            enableOnAndroid={true}
            extraScrollHeight={Platform.OS === 'ios' ? 20 : 100}
          >
            <View style={styles.apiKeyContainer}>
              <Text style={[styles.title, { color: colors.text }]}>
                API Keys Required
              </Text>
              <Text style={[styles.subtitle, { color: colors.text }]}>
                Enter your OpenAI API key for voice transcription
              </Text>
              
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                OpenAI API Key (for transcription)
              </Text>
              <TextInput
                style={[styles.apiKeyInput, { backgroundColor: colors.background, borderColor: colors.text, color: colors.text }]}
                value={openAiApiKey}
                onChangeText={setOpenAiApiKey}
                placeholder="sk-..."
                placeholderTextColor={colors.text + '80'}
                secureTextEntry
                returnKeyType="done"
              />
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#0a7ea4', opacity: openAiApiKey.trim() ? 1 : 0.5 }]}
                onPress={async () => {
                  if (openAiApiKey.trim()) {
                    await AsyncStorage.setItem('openai_api_key', openAiApiKey.trim());
                    setCurrentView('recorder');
                  }
                }}
                disabled={!openAiApiKey.trim()}
              >
                <Text style={styles.buttonText}>Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#666' }]}
                onPress={() => setCurrentView('home')}
              >
                <Text style={styles.buttonText}>Back</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setCurrentView('home')}
          >
            <IconSymbol name="chevron.left" size={24} color={colors.text} />
            <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Voice Recorder</Text>
        </View>
        <VoiceRecorder
          key="voice-recorder"
          openAiApiKey={openAiApiKey}
          onTranscriptionComplete={handleTranscriptionComplete}
        />
      </View>
    );
  }

  if (currentView === 'workflow') {
    if (!openAiApiKey.trim()) {
      return (
        <KeyboardAvoidingView 
          style={[styles.container, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'position' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
          enabled={true}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setCurrentView('home')}
            >
              <IconSymbol name="chevron.left" size={24} color={colors.text} />
              <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>API Keys Required</Text>
            <View style={{ width: 40 }} />
          </View>
          
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            enableOnAndroid={true}
            extraScrollHeight={Platform.OS === 'ios' ? 20 : 100}
          >
            <View style={styles.apiKeyContainer}>
              <Text style={[styles.title, { color: colors.text }]}>
                API Key Required
              </Text>
              <Text style={[styles.subtitle, { color: colors.text }]}>
                Enter your OpenAI API key for voice transcription
              </Text>
              
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                OpenAI API Key (for transcription)
              </Text>
              <TextInput
                style={[styles.apiKeyInput, { backgroundColor: colors.background, borderColor: colors.text, color: colors.text }]}
                value={openAiApiKey}
                onChangeText={setOpenAiApiKey}
                placeholder="sk-..."
                placeholderTextColor={colors.text + '80'}
                secureTextEntry
                returnKeyType="done"
              />
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#0a7ea4', opacity: openAiApiKey.trim() ? 1 : 0.5 }]}
                onPress={async () => {
                  if (openAiApiKey.trim()) {
                    await AsyncStorage.setItem('openai_api_key', openAiApiKey.trim());
                    setCurrentView('workflow');
                  }
                }}
                disabled={!openAiApiKey.trim()}
              >
                <Text style={styles.buttonText}>Start Workflow</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleCancelJob}
          >
            <IconSymbol name="chevron.left" size={24} color={colors.text} />
            <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>
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
            <Text style={[styles.title, { color: colors.text }]}>
              Tradesman Voice Assistant
            </Text>
            <Text style={[styles.subtitle, { color: colors.text }]}>
              Step-by-step voice workflow for job documentation
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.settingsButton, { backgroundColor: '#000000', borderColor: '#000000' }]}
            onPress={handleSettings}
          >
            <IconSymbol name="gearshape" size={20} color="white" />
          </TouchableOpacity>
        </View>

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
            style={[styles.actionButton, { backgroundColor: '#0a7ea4' }]}
            onPress={handleStartNewWorkflow}
          >
            <IconSymbol name="mic.circle" size={32} color="white" />
            <Text style={styles.actionButtonText}>
              {activeWorkflow ? 'New Job Workflow' : 'Start Job Workflow'}
            </Text>
          </TouchableOpacity>
          
          {/* Quick Test button removed - use the regular workflow that prompts for API key */}

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#FF6B35' }]}
            onPress={handleExportJobs}
          >
            <IconSymbol name="square.and.arrow.up" size={32} color="white" />
            <Text style={styles.actionButtonText}>Export Jobs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#666' }]}
            onPress={() => setCurrentView('recorder')}
          >
            <IconSymbol name="mic" size={32} color="white" />
            <Text style={styles.actionButtonText}>Voice Recorder</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#8B5CF6' }]}
            onPress={() => setCurrentView('job-form')}
          >
            <IconSymbol name="doc.text" size={32} color="white" />
            <Text style={styles.actionButtonText}>Manual Job Entry</Text>
          </TouchableOpacity>
        </View>

        {jobs.length > 0 && (
          <View style={styles.jobsList}>
            <Text style={[styles.jobsTitle, { color: colors.text }]}>
              Recent Jobs ({jobs.length})
            </Text>
            {jobs.slice(-3).reverse().map(job => (
              <TouchableOpacity
                key={job.id}
                style={[styles.jobItem, { backgroundColor: colors.background, borderColor: colors.text }]}
                onPress={() => handleJobSelect(job)}
              >
                <View style={styles.jobHeader}>
                  <Text style={[styles.jobClient, { color: colors.text }]}>
                    {job.customer || 'Unnamed Customer'}
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
                <Text style={[styles.jobType, { color: colors.text }]}>
                  {job.jobType || 'General Work'}
                </Text>
                <Text style={[styles.jobProgress, { color: colors.text }]}>
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
              style={[styles.exportButton, { backgroundColor: '#8B5CF6' }]}
              onPress={handleExportJobs}
            >
              <IconSymbol name="square.and.arrow.up" size={20} color="white" />
              <Text style={styles.exportButtonText}>Export Jobs</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  scrollContent: {
    paddingBottom: 120, // Add space for bottom tabs
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
    padding: 20,
    paddingTop: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  backText: {
    fontSize: 16,
    marginLeft: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
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
});
