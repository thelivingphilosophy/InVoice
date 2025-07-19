import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { TranscriptionService } from './transcription';

export interface PendingTranscription {
  id: string;
  audioUri: string;
  localAudioPath: string;
  timestamp: string;
  jobType: 'voice_note' | 'workflow_step';
  stepIndex?: number; // For workflow steps
  retryCount: number;
  maxRetries: number;
  metadata?: any; // Additional data needed for processing
  jobId?: string; // ID of the job to update (for workflow steps)
}

export interface QueueStatus {
  total: number;
  pending: number;
  failed: number;
  completed: number;
}

const QUEUE_STORAGE_KEY = 'offline_transcription_queue';
const OFFLINE_AUDIO_DIR = FileSystem.documentDirectory + 'offline_audio/';

export class OfflineQueueService {
  private transcriptionService: TranscriptionService | null = null;
  private isProcessing = false;

  constructor() {
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(OFFLINE_AUDIO_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(OFFLINE_AUDIO_DIR, { intermediates: true });
        console.log('📁 Created offline audio directory');
      }
    } catch (error) {
      console.error('❌ Failed to create offline audio directory:', error);
    }
  }

  async addToQueue(
    audioUri: string, 
    jobType: 'voice_note' | 'workflow_step',
    metadata?: any,
    stepIndex?: number,
    jobId?: string
  ): Promise<string> {
    try {
      const id = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
      const fileName = `audio_${id}.mp3`;
      const localPath = OFFLINE_AUDIO_DIR + fileName;

      // Copy audio file to local storage
      await FileSystem.copyAsync({
        from: audioUri,
        to: localPath,
      });

      const pendingItem: PendingTranscription = {
        id,
        audioUri,
        localAudioPath: localPath,
        timestamp: new Date().toISOString(),
        jobType,
        stepIndex,
        retryCount: 0,
        maxRetries: 3,
        metadata,
        jobId, // Store jobId directly as well as in metadata
      };

      // Add to queue
      const queue = await this.getQueue();
      queue.push(pendingItem);
      await this.saveQueue(queue);

      console.log(`📝 Added ${jobType} to offline queue:`, id);
      return id;
    } catch (error) {
      console.error('❌ Failed to add item to offline queue:', error);
      throw error;
    }
  }

  async getQueue(): Promise<PendingTranscription[]> {
    try {
      const queueData = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      return queueData ? JSON.parse(queueData) : [];
    } catch (error) {
      console.error('❌ Failed to get offline queue:', error);
      return [];
    }
  }

  private async saveQueue(queue: PendingTranscription[]): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('❌ Failed to save offline queue:', error);
    }
  }

  async getQueueStatus(): Promise<QueueStatus> {
    const queue = await this.getQueue();
    return {
      total: queue.length,
      pending: queue.filter(item => item.retryCount < item.maxRetries).length,
      failed: queue.filter(item => item.retryCount >= item.maxRetries).length,
      completed: 0, // Completed items are removed from queue
    };
  }

  async processQueue(apiKey: string, onProgress?: (status: QueueStatus) => void): Promise<void> {
    if (this.isProcessing) {
      console.log('⏳ Queue processing already in progress');
      return;
    }

    this.isProcessing = true;
    this.transcriptionService = new TranscriptionService(apiKey);

    try {
      console.log('🔄 Starting offline queue processing...');
      const queue = await this.getQueue();
      const pendingItems = queue.filter(item => item.retryCount < item.maxRetries);

      if (pendingItems.length === 0) {
        console.log('✅ No pending items in offline queue');
        return;
      }

      console.log(`📋 Processing ${pendingItems.length} pending transcriptions`);

      for (const item of pendingItems) {
        try {
          await this.processItem(item);
          // Remove successfully processed item from queue
          await this.removeFromQueue(item.id);
          
          if (onProgress) {
            const status = await this.getQueueStatus();
            onProgress(status);
          }
        } catch (error) {
          console.error(`❌ Failed to process item ${item.id}:`, error);
          // Increment retry count
          await this.incrementRetryCount(item.id);
        }
      }

      console.log('✅ Offline queue processing completed');
    } catch (error) {
      console.error('❌ Queue processing failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processItem(item: PendingTranscription): Promise<void> {
    if (!this.transcriptionService) {
      throw new Error('Transcription service not initialized');
    }

    console.log(`🎤 Processing transcription for ${item.jobType}:`, item.id);

    // Check if local file still exists
    const fileInfo = await FileSystem.getInfoAsync(item.localAudioPath);
    if (!fileInfo.exists) {
      throw new Error(`Local audio file not found: ${item.localAudioPath}`);
    }

    // Transcribe the audio
    const result = await this.transcriptionService.transcribeAudio(item.localAudioPath);
    
    if (!result.success || !result.text?.trim()) {
      throw new Error(`Transcription failed: ${result.error || 'No text returned'}`);
    }

    // Process based on job type
    if (item.jobType === 'voice_note') {
      await this.processVoiceNote(result.text, item);
    } else if (item.jobType === 'workflow_step') {
      await this.processWorkflowStep(result.text, item);
    }

    // Clean up local audio file
    await FileSystem.deleteAsync(item.localAudioPath, { idempotent: true });
  }

  private async processVoiceNote(transcription: string, item: PendingTranscription): Promise<void> {
    // Import the job storage service
    const { JobStorageService } = await import('./jobStorage');
    const storageService = new JobStorageService();

    // Get existing jobs to determine next voice recording number
    const existingJobs = await storageService.getAllJobs();
    const voiceRecordingCount = existingJobs.filter(job => 
      job.customer?.startsWith('Voice Recording ')
    ).length;
    const nextNumber = voiceRecordingCount + 1;

    // Use original timestamp from the recording if available, otherwise use current time
    const originalTimestamp = item.timestamp ? new Date(item.timestamp) : new Date();
    const now = new Date();
    
    const jobData = {
      id: Date.now().toString(),
      customer: `Voice Recording ${nextNumber}`,
      jobType: 'Voice Note',
      equipment: '',
      cost: '',
      location: '',
      additionalNotes: transcription,
      dateCreated: originalTimestamp.toISOString(), // Use original recording time
      dateCompleted: now.toISOString(), // Use current time as completion time
      status: 'completed' as const,
      totalSteps: 1,
      completedSteps: 1,
    };

    await storageService.saveJob(jobData);
    console.log(`✅ Saved offline voice note as job: Voice Recording ${nextNumber}`);
  }

  private async processWorkflowStep(transcription: string, item: PendingTranscription): Promise<void> {
    // Import the job storage service
    const { JobStorageService } = await import('./jobStorage');
    const storageService = new JobStorageService();

    console.log(`🔄 Processing workflow step ${item.stepIndex} transcription:`, transcription);
    
    try {
      const jobs = await storageService.getAllJobs();
      let jobToUpdate = null;
      
      // First, try to find job by ID from multiple sources
      const targetJobId = item.jobId || item.metadata?.jobId;
      if (targetJobId) {
        jobToUpdate = jobs.find(job => job.id === targetJobId);
        console.log(`🔍 Looking for job with ID: ${targetJobId}`);
      }
      
      // If not found by ID, find the most recent job with pending_transcription status
      if (!jobToUpdate) {
        const pendingJobs = jobs.filter(job => job.status === 'pending_transcription');
        if (pendingJobs.length > 0) {
          // Sort by creation date and get the most recent
          pendingJobs.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
          jobToUpdate = pendingJobs[0];
          console.log(`🔍 Found pending job: ${jobToUpdate.id} (status: ${jobToUpdate.status})`);
        }
      }
      
      if (!jobToUpdate) {
        console.log(`⚠️ No job found to update for step ${item.stepIndex}`);
        console.log(`📋 Available jobs:`, jobs.map(j => ({ id: j.id, status: j.status, customer: j.customer })));
        return;
      }
      
      console.log(`✅ Found job to update: ${jobToUpdate.id} (current status: ${jobToUpdate.status})`);
      console.log(`📝 Current job data:`, {
        customer: jobToUpdate.customer,
        jobType: jobToUpdate.jobType,
        equipment: jobToUpdate.equipment,
        cost: jobToUpdate.cost
      });
      
      // Create updated job with transcription
      const updatedJob = { ...jobToUpdate };
      
      // Map step index to job fields
      switch (item.stepIndex) {
        case 0:
          updatedJob.customer = transcription;
          break;
        case 1:
          updatedJob.jobType = transcription;
          break;
        case 2:
          updatedJob.equipment = transcription;
          break;
        case 3:
          updatedJob.cost = transcription;
          break;
        case 4:
          updatedJob.additionalNotes = transcription;
          break;
        default:
          console.log(`⚠️ Unknown step index: ${item.stepIndex}`);
          return;
      }
      
      // Check if all workflow steps are now processed (no more pending transcriptions)
      const allStepsProcessed = updatedJob.customer !== 'Pending Transcription' &&
                               updatedJob.jobType !== 'Pending Transcription' &&
                               updatedJob.equipment !== 'Pending Transcription' &&
                               updatedJob.cost !== 'Pending Transcription' &&
                               !updatedJob.customer.includes('[Offline Recording') &&
                               !updatedJob.jobType.includes('[Offline Recording') &&
                               !updatedJob.equipment.includes('[Offline Recording') &&
                               !updatedJob.cost.includes('[Offline Recording');
      
      if (allStepsProcessed) {
        updatedJob.status = 'completed';
        console.log('✅ All workflow steps completed, marking job as completed');
      }
      
      // Update completion timestamp if job is now complete
      if (allStepsProcessed) {
        updatedJob.dateCompleted = new Date().toISOString();
      }
      
      // Save the updated job
      await storageService.saveJob(updatedJob);
      console.log(`✅ Successfully updated job ${jobToUpdate.id} step ${item.stepIndex} with: "${transcription}"`);
      console.log(`📝 Updated job data:`, {
        customer: updatedJob.customer,
        jobType: updatedJob.jobType,
        equipment: updatedJob.equipment,
        cost: updatedJob.cost,
        status: updatedJob.status
      });
      
    } catch (error) {
      console.error('❌ Failed to update workflow job:', error);
      throw error; // Re-throw to trigger retry mechanism
    }
  }

  private async removeFromQueue(id: string): Promise<void> {
    const queue = await this.getQueue();
    const updatedQueue = queue.filter(item => item.id !== id);
    await this.saveQueue(updatedQueue);
  }

  private async incrementRetryCount(id: string): Promise<void> {
    const queue = await this.getQueue();
    const updatedQueue = queue.map(item => 
      item.id === id 
        ? { ...item, retryCount: item.retryCount + 1 }
        : item
    );
    await this.saveQueue(updatedQueue);
  }

  async clearCompletedItems(): Promise<void> {
    // Remove items that have exceeded max retries
    const queue = await this.getQueue();
    const activeQueue = queue.filter(item => item.retryCount < item.maxRetries);
    await this.saveQueue(activeQueue);
    
    console.log(`🧹 Cleared ${queue.length - activeQueue.length} failed items from queue`);
  }

  async clearAllItems(): Promise<void> {
    await this.saveQueue([]);
    
    // Clean up all local audio files
    try {
      const dirInfo = await FileSystem.getInfoAsync(OFFLINE_AUDIO_DIR);
      if (dirInfo.exists) {
        await FileSystem.deleteAsync(OFFLINE_AUDIO_DIR);
        await this.ensureDirectoryExists();
      }
    } catch (error) {
      console.error('❌ Failed to clean up offline audio directory:', error);
    }
    
    console.log('🧹 Cleared all items from offline queue');
  }
}