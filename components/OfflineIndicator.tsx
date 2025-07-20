import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useNetwork } from '@/contexts/NetworkContext';
import { OfflineQueueService, QueueStatus } from '@/services/offlineQueue';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function OfflineIndicator() {
  const { isOffline, isConnected } = useNetwork();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({ total: 0, pending: 0, failed: 0, completed: 0 });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const offlineQueueService = new OfflineQueueService();

  useEffect(() => {
    updateQueueStatus();
    
    // Update queue status every 10 seconds
    const interval = setInterval(updateQueueStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const updateQueueStatus = async () => {
    try {
      const status = await offlineQueueService.getQueueStatus();
      setQueueStatus(status);
    } catch (error) {
      console.error('Failed to get queue status:', error);
    }
  };

  const getStatusColor = () => {
    if (isOffline) return colors.warning; // Amber for offline
    if (queueStatus.pending > 0) return colors.success; // Green when back online with pending items
    return null; // No indicator when online with no pending items
  };

  // Don't show indicator if online and no pending items
  const statusColor = getStatusColor();
  if (!statusColor) {
    return null;
  }

  const handlePress = () => {
    setIsExpanded(!isExpanded);
  };

  const getStatusText = () => {
    if (isOffline) {
      return queueStatus.total > 0 
        ? `Offline - ${queueStatus.total} recordings saved`
        : 'Offline Mode';
    }
    if (isSyncing) {
      return 'Syncing recordings...';
    }
    if (queueStatus.pending > 0) {
      return `${queueStatus.pending} recordings ready to sync`;
    }
    return 'All recordings synced';
  };

  const manualSync = async () => {
    if (isOffline) {
      Alert.alert('Cannot Sync', 'You are currently offline. Please connect to the internet to sync recordings.');
      return;
    }

    if (queueStatus.pending === 0) {
      Alert.alert('Nothing to Sync', 'All recordings are already synced.');
      return;
    }

    try {
      setIsSyncing(true);
      console.log('🔄 Starting manual sync...');

      // Get API key from storage
      const apiKey = await AsyncStorage.getItem('openai_api_key');
      if (!apiKey) {
        Alert.alert('API Key Required', 'Please enter your OpenAI API key in the settings to sync recordings.');
        setIsSyncing(false);
        return;
      }

      const initialCount = queueStatus.pending;
      
      await offlineQueueService.processQueue(
        apiKey,
        (status) => {
          setQueueStatus(status);
          console.log(`🔄 Sync progress: ${status.pending} remaining`);
        }
      );

      await updateQueueStatus();
      const finalStatus = await offlineQueueService.getQueueStatus();
      const processedCount = initialCount - finalStatus.pending;

      if (processedCount > 0) {
        Alert.alert(
          'Sync Complete!',
          `Successfully processed ${processedCount} recordings. Check your jobs list for updated transcriptions.`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Sync Complete', 'All recordings were already processed.');
      }

    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      Alert.alert('Sync Failed', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = () => {
    if (isOffline) return 'wifi.slash';
    if (isSyncing) return 'arrow.clockwise';
    if (queueStatus.pending > 0) return 'arrow.clockwise';
    return 'checkmark.circle';
  };

  return (
    <TouchableOpacity 
      style={[styles.container, { backgroundColor: statusColor }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        {isSyncing ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <IconSymbol name={getStatusIcon()} size={16} color="white" />
        )}
        <Text style={styles.statusText}>{getStatusText()}</Text>
        
        {/* Manual Sync Button */}
        {!isOffline && queueStatus.pending > 0 && !isSyncing && (
          <TouchableOpacity 
            style={styles.syncButton}
            onPress={manualSync}
          >
            <IconSymbol name="arrow.clockwise" size={16} color="white" />
            <Text style={styles.syncButtonText}>Sync</Text>
          </TouchableOpacity>
        )}
        
        {queueStatus.total > 0 && (
          <IconSymbol 
            name={isExpanded ? 'chevron.up' : 'chevron.down'} 
            size={16} 
            color="white" 
          />
        )}
      </View>
      
      {isExpanded && queueStatus.total > 0 && (
        <View style={styles.details}>
          <Text style={styles.detailText}>
            📁 Total recordings: {queueStatus.total}
          </Text>
          {queueStatus.pending > 0 && (
            <Text style={styles.detailText}>
              ⏳ Pending: {queueStatus.pending}
            </Text>
          )}
          {queueStatus.failed > 0 && (
            <Text style={styles.detailText}>
              ❌ Failed: {queueStatus.failed}
            </Text>
          )}
          <Text style={styles.detailSubtext}>
            {isOffline 
              ? 'Recordings will be processed when back online'
              : 'Processing recordings automatically...'
            }
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    borderRadius: 15,
    overflow: 'hidden',
    marginTop: 15,
    marginBottom: 20,
    maxWidth: 200, // Prevent it from getting too wide
    minWidth: 150, // Prevent it from getting too small
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  details: {
    padding: 12,
    paddingTop: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  detailText: {
    color: 'white',
    fontSize: 12,
    marginBottom: 2,
  },
  detailSubtext: {
    color: 'white',
    fontSize: 11,
    opacity: 0.8,
    fontStyle: 'italic',
    marginTop: 4,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  syncButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});