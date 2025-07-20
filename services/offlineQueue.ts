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
          const wasProcessed = await this.processItem(item);
          if (wasProcessed) {
            // Remove successfully processed item from queue
            await this.removeFromQueue(item.id);
            console.log(`✅ Successfully processed and removed item ${item.id}`);
          }
          // Note: if wasProcessed is false, the item was already removed (e.g., missing file)
          
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

  private async processItem(item: PendingTranscription): Promise<boolean> {
    if (!this.transcriptionService) {
      throw new Error('Transcription service not initialized');
    }

    console.log(`🎤 Processing transcription for ${item.jobType}:`, item.id);

    // Check if local file still exists
    const fileInfo = await FileSystem.getInfoAsync(item.localAudioPath);
    if (!fileInfo.exists) {
      console.log(`⚠️ Local audio file not found: ${item.localAudioPath} - removing from queue`);
      // Remove this item from queue since the file is missing
      await this.removeFromQueue(item.id);
      return false; // Not processed, just removed
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
    return true; // Successfully processed
  }

  private async processVoiceNote(transcription: string, item: PendingTranscription): Promise<void> {
    // Import the job storage service
    const { JobStorageService } = await import('./jobStorage');
    const storageService = new JobStorageService();

    // Use original timestamp from the recording if available, otherwise use current time
    const now = new Date();
    
    // Try to find an existing pending voice recording job to update
    const allJobs = await storageService.getAllJobs();
    const pendingVoiceJobs = allJobs.filter(job => 
      job.jobType === 'Voice Note' && 
      job.status === 'pending_transcription'
    );
    
    let jobToUpdate = null;
    if (pendingVoiceJobs.length > 0) {
      // Find the most recent pending voice job (likely the one we want to update)
      pendingVoiceJobs.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
      jobToUpdate = pendingVoiceJobs[0];
      console.log(`🔍 Found pending voice job to update: ${jobToUpdate.title}`);
    }
    
    if (jobToUpdate) {
      // Update the existing job
      const updatedJob = {
        ...jobToUpdate,
        additionalNotes: transcription,
        dateCompleted: now.toISOString(),
        status: 'completed' as const,
        completedSteps: 1,
      };
      
      await storageService.saveJob(updatedJob);
      console.log(`✅ Updated existing voice job: ${jobToUpdate.title}`);
    } else {
      // Create new job only if no pending job found
      const completedVoiceRecordings = allJobs.filter(job => 
        job.jobType === 'Voice Note' && job.status === 'completed'
      );
      const nextNumber = completedVoiceRecordings.length + 1;
      
      const originalTimestamp = item.timestamp ? new Date(item.timestamp) : new Date();
      const jobData = {
        id: Date.now().toString(),
        title: `Voice Recording ${nextNumber}`,
        customer: 'Voice Recording',
        jobType: 'Voice Note',
        equipment: '',
        cost: '',
        location: '',
        additionalNotes: transcription,
        dateCreated: originalTimestamp.toISOString(),
        dateCompleted: now.toISOString(),
        status: 'completed' as const,
        totalSteps: 1,
        completedSteps: 1,
      };

      await storageService.saveJob(jobData);
      console.log(`✅ Created new voice job: Voice Recording ${nextNumber}`);
    }
  }

  private async processWorkflowStep(transcription: string, item: PendingTranscription): Promise<void> {
    // Import the job storage service
    const { JobStorageService } = await import('./jobStorage');
    const storageService = new JobStorageService();

    console.log(`🔄 Processing workflow step ${item.stepIndex} transcription:`, transcription);
    console.log(`📋 Queue item details:`, {
      id: item.id,
      jobType: item.jobType,
      stepIndex: item.stepIndex,
      jobId: item.jobId,
      metadataJobId: item.metadata?.jobId,
      timestamp: item.timestamp
    });
    
    try {
      const jobs = await storageService.getAllJobs();
      let jobToUpdate = null;
      
      // First, try to find job by ID from multiple sources
      const targetJobId = item.jobId || item.metadata?.jobId;
      if (targetJobId) {
        jobToUpdate = jobs.find(job => job.id === targetJobId);
        console.log(`🔍 Looking for job with ID: ${targetJobId}`);
        if (jobs.find(job => job.id === targetJobId)) {
          console.log(`✅ Found job by ID: ${targetJobId}`);
        } else {
          console.log(`❌ Job with ID ${targetJobId} not found in ${jobs.length} total jobs`);
          console.log(`📋 Available job IDs:`, jobs.map(j => j.id));
        }
      }
      
      // If not found by ID, find the most recent job with pending_transcription status
      if (!jobToUpdate) {
        const pendingJobs = jobs.filter(job => job.status === 'pending_transcription');
        console.log(`🔍 Found ${pendingJobs.length} pending jobs out of ${jobs.length} total jobs`);
        if (pendingJobs.length > 0) {
          // Sort by creation date and get the most recent
          pendingJobs.sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
          jobToUpdate = pendingJobs[0];
          console.log(`🔍 Selected pending job: ${jobToUpdate.id} (status: ${jobToUpdate.status})`);
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
      
      // Map step index to job fields properly
      switch (item.stepIndex) {
        case 0:
          // Update the customer field directly
          updatedJob.customer = transcription;
          console.log(`📝 Updated customer field to "${transcription}"`);
          break;
        case 1:
          updatedJob.jobType = transcription;
          console.log(`📝 Updated jobType to "${transcription}"`);
          break;
        case 2:
          updatedJob.equipment = transcription;
          console.log(`📝 Updated equipment to "${transcription}"`);
          break;
        case 3:
          updatedJob.cost = transcription;
          console.log(`📝 Updated cost to "${transcription}"`);
          break;
        case 4:
          // Clean up any existing additional notes and add the new ones
          let existingNotes = updatedJob.additionalNotes || '';
          // Remove any offline metadata
          existingNotes = existingNotes.replace(/Job completed offline\. .*?\n\n/, '');
          // Keep customer info if it exists
          const customerMatch = existingNotes.match(/Customer: .*?\n\n?/);
          const customerInfo = customerMatch ? customerMatch[0] : '';
          const finalNotes = customerInfo + transcription;
          updatedJob.additionalNotes = finalNotes;
          console.log(`📝 Updated additionalNotes to "${transcription}"`);
          break;
        default:
          console.log(`⚠️ Unknown step index: ${item.stepIndex}`);
          return;
      }
      
      // Check if this job has any real transcriptions (not just pending placeholders)
      const hasRealTranscriptions = (
        (updatedJob.customer !== 'Pending Transcription' && !updatedJob.customer.includes('[Offline Recording')) ||
        (updatedJob.jobType !== 'Pending Transcription' && !updatedJob.jobType.includes('[Offline Recording')) ||
        (updatedJob.equipment !== 'Pending Transcription' && !updatedJob.equipment.includes('[Offline Recording')) ||
        (updatedJob.cost !== 'Pending Transcription' && !updatedJob.cost.includes('[Offline Recording'))
      );

      console.log(`🔍 Completion check for job ${jobToUpdate.id}:`, {
        currentStatus: jobToUpdate.status,
        hasRealTranscriptions,
        customer: updatedJob.customer,
        jobType: updatedJob.jobType,
        equipment: updatedJob.equipment,
        cost: updatedJob.cost
      });
      
      // If the job was pending_transcription and now has real transcriptions, mark it as completed
      if (jobToUpdate.status === 'pending_transcription' && hasRealTranscriptions) {
        updatedJob.status = 'completed';
        console.log('✅ Job has transcriptions, marking as completed');
      }
      
      // Update completion timestamp if job is now complete
      if (updatedJob.status === 'completed') {
        updatedJob.dateCompleted = new Date().toISOString();
      }
      
      // Save the updated job
      console.log(`💾 About to save job with status: "${updatedJob.status}"`);
      await storageService.saveJob(updatedJob);
      console.log(`✅ Successfully saved job ${jobToUpdate.id} step ${item.stepIndex} with: "${transcription}"`);
      console.log(`📝 Updated job status from "${jobToUpdate.status}" to "${updatedJob.status}"`);
      
      // Verify the job was actually saved with the correct status
      const verifyJob = await storageService.getJobById(updatedJob.id);
      if (verifyJob) {
        console.log(`🔍 Verification: Job ${updatedJob.id} now has status: "${verifyJob.status}"`);
      } else {
        console.log(`❌ Verification failed: Could not find job ${updatedJob.id} after save`);
      }
      
      console.log(`📝 Updated job data:`, {
        customer: updatedJob.customer,
        jobType: updatedJob.jobType,
        equipment: updatedJob.equipment,
        cost: updatedJob.cost,
        status: updatedJob.status,
        hasCustomerInfo: updatedJob.additionalNotes?.includes('Customer:')
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