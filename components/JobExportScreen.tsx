import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { JobStorageService } from '@/services/jobStorage';
import { JobData } from '@/types/job';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system';

interface JobExportScreenProps {
  onClose: () => void;
}

export default function JobExportScreen({ onClose }: JobExportScreenProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  
  const storageService = new JobStorageService();

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const allJobs = await storageService.getAllJobs();
      // Sort by creation date, newest first (descending order)
      const sortedJobs = allJobs.sort((a, b) => 
        new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
      );
      setJobs(sortedJobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
      Alert.alert('Error', 'Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleJobSelection = (jobId: string) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected.has(jobId)) {
      newSelected.delete(jobId);
    } else {
      newSelected.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const selectAllJobs = () => {
    if (selectedJobs.size === jobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(jobs.map(job => job.id)));
    }
  };

  const exportAsEmail = async () => {
    if (selectedJobs.size === 0) {
      Alert.alert('No Jobs Selected', 'Please select at least one job to export');
      return;
    }

    setIsExporting(true);
    try {
      const selectedJobData = jobs.filter(job => selectedJobs.has(job.id));
      
      let emailBody = `Tradesman Job Report\n`;
      emailBody += `Generated on: ${new Date().toLocaleString()}\n`;
      emailBody += `Total Jobs: ${selectedJobData.length}\n\n`;
      emailBody += `${'='.repeat(50)}\n\n`;

      selectedJobData.forEach((job, index) => {
        emailBody += storageService.formatJobForEmail(job);
        if (index < selectedJobData.length - 1) {
          emailBody += `\n${'='.repeat(50)}\n\n`;
        }
      });

      const isAvailable = await MailComposer.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Email Not Available', 'Email is not available on this device');
        return;
      }

      await MailComposer.composeAsync({
        subject: `Job Report - ${selectedJobData.length} Jobs`,
        body: emailBody,
      });

    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'Failed to export jobs via email');
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsTextFile = async () => {
    if (selectedJobs.size === 0) {
      Alert.alert('No Jobs Selected', 'Please select at least one job to export');
      return;
    }

    setIsExporting(true);
    try {
      const selectedJobData = jobs.filter(job => selectedJobs.has(job.id));
      
      let fileContent = `Tradesman Job Report\n`;
      fileContent += `Generated on: ${new Date().toLocaleString()}\n`;
      fileContent += `Total Jobs: ${selectedJobData.length}\n\n`;
      fileContent += `${'='.repeat(50)}\n\n`;

      selectedJobData.forEach((job, index) => {
        fileContent += storageService.formatJobForEmail(job);
        if (index < selectedJobData.length - 1) {
          fileContent += `\n${'='.repeat(50)}\n\n`;
        }
      });

      const fileName = `job-report-${new Date().toISOString().split('T')[0]}.txt`;
      const fileUri = FileSystem.documentDirectory + fileName;
      
      await FileSystem.writeAsStringAsync(fileUri, fileContent);
      
      Alert.alert(
        'Export Complete',
        `Jobs exported to ${fileName}`,
        [
          { text: 'OK' }
        ]
      );

    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'Failed to export jobs to file');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading jobs...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Export Jobs</Text>
        <View style={{ width: 60 }} />
      </View>

      {jobs.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            No jobs available to export
          </Text>
        </View>
      ) : (
        <>
          {/* Selection Controls */}
          <View style={styles.selectionControls}>
            <TouchableOpacity
              style={[styles.selectAllButton, { backgroundColor: colors.background, borderColor: colors.text }]}
              onPress={selectAllJobs}
            >
              <IconSymbol 
                name={selectedJobs.size === jobs.length ? "checkmark.square" : "square"} 
                size={20} 
                color={colors.text} 
              />
              <Text style={[styles.selectAllText, { color: colors.text }]}>
                {selectedJobs.size === jobs.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.selectionCount, { color: colors.text }]}>
              {selectedJobs.size} of {jobs.length} selected
            </Text>
          </View>

          {/* Jobs List */}
          <ScrollView style={styles.jobsList} showsVerticalScrollIndicator={false}>
            {jobs.map(job => (
              <TouchableOpacity
                key={job.id}
                style={[
                  styles.jobItem,
                  { 
                    backgroundColor: colors.background,
                    borderColor: selectedJobs.has(job.id) ? colors.tint : colors.text + '30',
                    borderWidth: selectedJobs.has(job.id) ? 2 : 1,
                  }
                ]}
                onPress={() => toggleJobSelection(job.id)}
              >
                <View style={styles.jobItemContent}>
                  <IconSymbol 
                    name={selectedJobs.has(job.id) ? "checkmark.square.fill" : "square"} 
                    size={24} 
                    color={selectedJobs.has(job.id) ? colors.tint : colors.text} 
                  />
                  <View style={styles.jobInfo}>
                    <Text style={[styles.jobCustomer, { color: colors.text }]}>
                      {new Date(job.dateCreated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={[styles.jobType, { color: colors.text }]}>
                      {job.customer || 'Unnamed Customer'} - {job.jobType || 'General Work'}
                    </Text>
                    <Text style={[styles.jobDate, { color: colors.text }]}>
                      {new Date(job.dateCreated).toLocaleDateString()}
                    </Text>
                  </View>
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
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Export Buttons */}
          <View style={styles.exportButtons}>
            <TouchableOpacity
              style={[
                styles.exportButton,
                { backgroundColor: '#0a7ea4', opacity: selectedJobs.size > 0 ? 1 : 0.5 }
              ]}
              onPress={exportAsEmail}
              disabled={isExporting || selectedJobs.size === 0}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <IconSymbol name="envelope" size={20} color="white" />
              )}
              <Text style={styles.exportButtonText}>Export via Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.exportButton,
                { backgroundColor: '#8B5CF6', opacity: selectedJobs.size > 0 ? 1 : 0.5 }
              ]}
              onPress={exportAsTextFile}
              disabled={isExporting || selectedJobs.size === 0}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <IconSymbol name="doc.text" size={20} color="white" />
              )}
              <Text style={styles.exportButtonText}>Export as Text File</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    marginLeft: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 10,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  selectionControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectAllText: {
    fontSize: 16,
    marginLeft: 8,
  },
  selectionCount: {
    fontSize: 14,
  },
  jobsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  jobItem: {
    borderRadius: 8,
    marginBottom: 10,
    padding: 15,
  },
  jobItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jobInfo: {
    flex: 1,
    marginLeft: 15,
  },
  jobCustomer: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  jobType: {
    fontSize: 14,
    marginBottom: 2,
  },
  jobDate: {
    fontSize: 12,
    opacity: 0.7,
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
  exportButtons: {
    padding: 20,
    gap: 15,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    gap: 10,
  },
  exportButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});