import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Share,
} from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { JobData } from '@/types/job';
import { JobStorageService } from '@/services/jobStorage';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface JobSummaryScreenProps {
  job: JobData;
  onClose: () => void;
  onEdit: () => void;
  onStartNewJob?: () => void;
}

export default function JobSummaryScreen({ job, onClose, onEdit, onStartNewJob }: JobSummaryScreenProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isEmailAvailable, setIsEmailAvailable] = useState<boolean | null>(null);
  
  const storageService = new JobStorageService();

  React.useEffect(() => {
    checkEmailAvailability();
  }, []);

  const checkEmailAvailability = async () => {
    try {
      const available = await MailComposer.isAvailableAsync();
      setIsEmailAvailable(available);
    } catch (error) {
      console.error('Error checking email availability:', error);
      setIsEmailAvailable(false);
    }
  };

  const handleEmailSummary = async () => {
    try {
      if (!isEmailAvailable) {
        Alert.alert(
          'Email Not Available',
          'Email is not configured on this device. You can still share the summary using other methods.',
          [
            { text: 'OK' },
            { text: 'Share Instead', onPress: handleShareSummary },
          ]
        );
        return;
      }

      const emailBody = storageService.formatJobForEmail(job);
      const subject = `Job Summary - ${job.customer} (${new Date(job.dateCreated).toLocaleDateString()})`;

      const result = await MailComposer.composeAsync({
        subject,
        body: emailBody,
        isHtml: false,
      });

      if (result.status === MailComposer.MailComposerStatus.SENT) {
        Alert.alert('Success', 'Email sent successfully!');
      } else if (result.status === MailComposer.MailComposerStatus.CANCELLED) {
        // User cancelled, no action needed
      } else {
        Alert.alert('Error', 'Failed to send email');
      }
    } catch (error) {
      console.error('Email composition error:', error);
      Alert.alert('Error', 'Failed to compose email');
    }
  };

  const handleShareSummary = async () => {
    try {
      const summaryText = storageService.formatJobForEmail(job);
      const title = `Job Summary - ${job.customer}`;

      const result = await Share.share({
        message: summaryText,
        title,
      });

      if (result.action === Share.sharedAction) {
        console.log('Summary shared successfully');
      }
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', 'Failed to share summary');
    }
  };

  const handleDeleteJob = () => {
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
              await storageService.deleteJob(job.id);
              Alert.alert('Job Deleted', 'The job has been deleted successfully.', [
                { text: 'OK', onPress: onClose },
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete job');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#22c55e';
      case 'in-progress':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'checkmark.circle.fill';
      case 'in-progress':
        return 'clock.fill';
      default:
        return 'circle.fill';
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 60 }]}>
        <TouchableOpacity 
          style={[styles.closeButton, { backgroundColor: '#ffffff', borderColor: '#000000' }]} 
          onPress={onClose}
        >
          <IconSymbol name="house" size={16} color="#000000" />
          <Text style={[styles.backText, { color: '#000000' }]}>Home</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Job Summary</Text>
        <TouchableOpacity 
          style={[styles.editButton, { backgroundColor: '#000000', borderColor: '#000000' }]} 
          onPress={onEdit}
        >
          <IconSymbol name="pencil" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Status Badge */}
      <View style={styles.statusContainer}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(job.status) + '20' },
          ]}
        >
          <IconSymbol
            name={getStatusIcon(job.status)}
            size={20}
            color={getStatusColor(job.status)}
          />
          <Text
            style={[styles.statusText, { color: getStatusColor(job.status) }]}
          >
            {job.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Job Details */}
      <View style={styles.detailsContainer}>
        <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Customer Information
          </Text>
          <Text style={[styles.detailText, { color: colors.text }]}>
            {job.customer || 'Not specified'}
          </Text>
        </View>

        <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Job Type
          </Text>
          <Text style={[styles.detailText, { color: colors.text }]}>
            {job.jobType || 'Not specified'}
          </Text>
        </View>

        <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Equipment & Materials
          </Text>
          <Text style={[styles.detailText, { color: colors.text }]}>
            {job.equipment || 'Not specified'}
          </Text>
        </View>

        <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Cost
          </Text>
          <Text style={[styles.detailText, { color: colors.text }]}>
            {job.cost || 'Not specified'}
          </Text>
        </View>

        {job.location && (
          <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Location
            </Text>
            <Text style={[styles.detailText, { color: colors.text }]}>
              {job.location}
            </Text>
          </View>
        )}

        {job.additionalNotes && (
          <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Additional Notes
            </Text>
            <Text style={[styles.detailText, { color: colors.text }]}>
              {job.additionalNotes}
            </Text>
          </View>
        )}

        {/* Dates */}
        <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Date Created
          </Text>
          <Text style={[styles.detailText, { color: colors.text }]}>
            {formatDate(job.dateCreated)}
          </Text>
        </View>

        {job.dateCompleted && (
          <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Date Completed
            </Text>
            <Text style={[styles.detailText, { color: colors.text }]}>
              {formatDate(job.dateCompleted)}
            </Text>
          </View>
        )}

        {/* Progress */}
        <View style={[styles.detailSection, { backgroundColor: colors.background, borderColor: colors.text + '20' }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Progress
          </Text>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.text + '20' }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: '#0a7ea4',
                    width: `${(job.completedSteps / job.totalSteps) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.text }]}>
              {job.completedSteps} of {job.totalSteps} steps completed
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {onStartNewJob && (
          <TouchableOpacity
            style={[styles.actionButton, styles.newJobButton, { backgroundColor: '#10b981' }]}
            onPress={onStartNewJob}
          >
            <IconSymbol name="plus.circle" size={20} color="white" />
            <Text style={styles.actionButtonText}>Start New Job</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.emailButton, { backgroundColor: '#0a7ea4' }]}
          onPress={handleEmailSummary}
        >
          <IconSymbol name="envelope" size={20} color="white" />
          <Text style={styles.actionButtonText}>
            {isEmailAvailable ? 'Email Summary' : 'Email Not Available'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.shareButton, { backgroundColor: '#34d399' }]}
          onPress={handleShareSummary}
        >
          <IconSymbol name="square.and.arrow.up" size={20} color="white" />
          <Text style={styles.actionButtonText}>Share Summary</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton, { backgroundColor: '#ef4444' }]}
          onPress={handleDeleteJob}
        >
          <IconSymbol name="trash" size={20} color="white" />
          <Text style={styles.actionButtonText}>Delete Job</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  closeButton: {
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
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  detailsContainer: {
    marginBottom: 30,
  },
  detailSection: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    opacity: 0.7,
  },
  detailText: {
    fontSize: 16,
    lineHeight: 24,
  },
  progressContainer: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    opacity: 0.7,
  },
  actionButtons: {
    gap: 15,
    marginBottom: 40,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  newJobButton: {},
  emailButton: {},
  shareButton: {},
  deleteButton: {},
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});