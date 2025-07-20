import { useEffect, useRef, useState } from 'react';
import { useNetwork } from '@/contexts/NetworkContext';
import { OfflineQueueService, QueueStatus } from '@/services/offlineQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UseOfflineSyncProps {
  apiKey?: string;
  onSyncComplete?: (processedCount: number) => void;
  onSyncError?: (error: string) => void;
}

export function useOfflineSync({ 
  apiKey, 
  onSyncComplete,
  onSyncError 
}: UseOfflineSyncProps = {}) {
  const { isConnected, isOffline } = useNetwork();
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({ 
    total: 0, 
    pending: 0, 
    failed: 0, 
    completed: 0 
  });
  
  const offlineQueueService = useRef(new OfflineQueueService());
  const lastConnectionState = useRef(isConnected);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update queue status periodically
  useEffect(() => {
    updateQueueStatus();
    const interval = setInterval(updateQueueStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Monitor connection state changes
  useEffect(() => {
    // If we just came back online and have an API key
    if (isConnected && !lastConnectionState.current && apiKey) {
      console.log('🌐 Connection restored - starting sync process');
      startSyncProcess();
    }
    
    lastConnectionState.current = isConnected;
  }, [isConnected, apiKey]);

  const updateQueueStatus = async () => {
    try {
      const status = await offlineQueueService.current.getQueueStatus();
      setQueueStatus(status);
    } catch (error) {
      console.error('Failed to update queue status:', error);
    }
  };

  const startSyncProcess = async () => {
    if (isSyncing || !apiKey || isOffline) {
      return;
    }

    try {
      setIsSyncing(true);
      console.log('🔄 Starting offline queue sync...');

      const initialStatus = await offlineQueueService.current.getQueueStatus();
      if (initialStatus.pending === 0) {
        console.log('✅ No pending items to sync');
        setIsSyncing(false);
        return;
      }

      console.log(`📋 Syncing ${initialStatus.pending} pending items`);

      await offlineQueueService.current.processQueue(
        apiKey,
        (status) => {
          setQueueStatus(status);
          console.log(`🔄 Sync progress: ${status.pending} remaining`);
        }
      );

      const finalStatus = await offlineQueueService.current.getQueueStatus();
      const processedCount = initialStatus.pending - finalStatus.pending;

      console.log(`✅ Sync completed - processed ${processedCount} items`);
      
      if (onSyncComplete) {
        onSyncComplete(processedCount);
      }

    } catch (error) {
      console.error('❌ Sync failed:', error);
      if (onSyncError) {
        onSyncError(error instanceof Error ? error.message : 'Sync failed');
      }
    } finally {
      setIsSyncing(false);
      await updateQueueStatus();
    }
  };

  const manualSync = async (): Promise<boolean> => {
    if (!apiKey) {
      if (onSyncError) {
        onSyncError('API key required for sync');
      }
      return false;
    }

    if (isOffline) {
      if (onSyncError) {
        onSyncError('Cannot sync while offline');
      }
      return false;
    }

    await startSyncProcess();
    return true;
  };

  const clearFailedItems = async () => {
    try {
      await offlineQueueService.current.clearCompletedItems();
      await updateQueueStatus();
      console.log('🧹 Cleared failed items from queue');
    } catch (error) {
      console.error('Failed to clear failed items:', error);
    }
  };

  const clearAllItems = async () => {
    try {
      await offlineQueueService.current.clearAllItems();
      await updateQueueStatus();
      console.log('🧹 Cleared all items from queue');
    } catch (error) {
      console.error('Failed to clear all items:', error);
    }
  };

  return {
    isSyncing,
    queueStatus,
    manualSync,
    clearFailedItems,
    clearAllItems,
    updateQueueStatus,
  };
}