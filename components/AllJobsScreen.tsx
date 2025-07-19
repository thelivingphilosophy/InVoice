import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { JobStorageService } from '@/services/jobStorage';
import { JobData } from '@/types/job';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface AllJobsScreenProps {
  onClose: () => void;
  onJobSelect: (job: JobData) => void;
}

export default function AllJobsScreen({ onClose, onJobSelect }: AllJobsScreenProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const storageService = new JobStorageService();

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const allJobs = await storageService.getAllJobs();
      // Sort by creation date, newest first
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

  const deleteJob = async (jobId: string) => {
    Alert.alert(
      'Delete Job',
      'Are you sure you want to delete this job? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await storageService.deleteJob(jobId);
              await loadJobs(); // Refresh the list
              Alert.alert('Success', 'Job deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete job');
            }
          }
        }
      ]
    );
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
        <Text style={[styles.title, { color: colors.text }]}>All Jobs</Text>
        <View style={{ width: 60 }} />
      </View>

      {jobs.length === 0 ? (
        <View style={styles.centered}>
          <IconSymbol name="briefcase" size={64} color={colors.text + '40'} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Jobs Yet</Text>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            Start a new job workflow to create your first job entry
          </Text>
        </View>
      ) : (
        <>
          {/* Job Count */}
          <View style={styles.countContainer}>
            <Text style={[styles.countText, { color: colors.text }]}>
              {jobs.length} {jobs.length === 1 ? 'Job' : 'Jobs'} Total
            </Text>
          </View>

          {/* Jobs List */}
          <ScrollView style={styles.jobsList} showsVerticalScrollIndicator={false}>
            {jobs.map(job => (
              <View key={job.id} style={[styles.jobItem, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
                <TouchableOpacity
                  style={styles.jobContent}
                  onPress={() => onJobSelect(job)}
                >
                  <View style={styles.jobHeader}>
                    <Text style={[styles.jobCustomer, { color: colors.text }]}>
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
                  
                  {job.location && (
                    <Text style={[styles.jobLocation, { color: colors.text }]}>
                      📍 {job.location}
                    </Text>
                  )}
                  
                  <View style={styles.jobFooter}>
                    <Text style={[styles.jobDate, { color: colors.text }]}>
                      Created: {new Date(job.dateCreated).toLocaleDateString()}
                    </Text>
                    <Text style={[styles.jobProgress, { color: colors.text }]}>
                      {job.completedSteps}/{job.totalSteps} steps
                    </Text>
                  </View>
                  
                  {job.dateCompleted && (
                    <Text style={[styles.jobCompletedDate, { color: colors.text }]}>
                      Completed: {new Date(job.dateCompleted).toLocaleDateString()}
                    </Text>
                  )}
                </TouchableOpacity>
                
                {/* Delete Button */}
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteJob(job.id)}
                >
                  <IconSymbol name="trash" size={20} color="#ff4444" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
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
    flex: 1,
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
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: 40,
  },
  countContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  countText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  jobsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  jobItem: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  jobContent: {
    flex: 1,
    padding: 15,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobCustomer: {
    fontSize: 18,
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
    fontSize: 16,
    marginBottom: 4,
  },
  jobLocation: {
    fontSize: 14,
    marginBottom: 8,
    opacity: 0.8,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  jobDate: {
    fontSize: 12,
    opacity: 0.7,
  },
  jobProgress: {
    fontSize: 12,
    opacity: 0.7,
  },
  jobCompletedDate: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  deleteButton: {
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
});