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
      case 'pending_transcription':
        return '#0a7ea4';
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
      case 'pending_transcription':
        return 'arrow.clockwise.circle.fill';
      default:
        return 'circle.fill';
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 60 }]}>
        <TouchableOpacity 
          style={[styles.closeButton, { backgroundColor: '#f89448', borderColor: '#f89448' }]} 
          onPress={onClose}
        >
          <IconSymbol name="house" size={16} color="white" />
          <Text style={[styles.backText, { color: 'white' }]}>Home</Text>
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]}>
            {job.jobType === 'Voice Note' ? 'Recording Summary' : 'Job Summary'}
          </Text>
          <View style={styles.titleUnderline} />
        </View>
        <View style={styles.rightSection}>
          <TouchableOpacity 
            style={[styles.editButton, { backgroundColor: '#f89448', borderColor: '#f89448' }]} 
            onPress={onEdit}
          >
            <IconSymbol name="pencil" size={16} color="white" />
          </TouchableOpacity>
        </View>
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
        {job.jobType === 'Voice Note' ? (
          // Simplified view for voice recordings
          <>
            <View style={[styles.detailSection, { backgroundColor: '#12273a', borderColor: colors.text + '20' }]}>
              <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>
                Type
              </Text>
              <Text style={[styles.detailText, { color: '#ffffff' }]}>
                Voice Recording
              </Text>
            </View>

            {job.additionalNotes && (
              <View style={[styles.detailSection, { backgroundColor: '#12273a', borderColor: colors.text + '20' }]}>
                <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>
                  Transcription
                </Text>
                <Text style={[styles.detailText, { color: '#ffffff' }]}>
                  {job.additionalNotes}
                </Text>
              </View>
            )}
          </>
        ) : (
          // Full view for workflow jobs
          <>
            <View style={[styles.detailSection, { backgroundColor: '#12273a', borderColor: colors.text + '20' }]}>
              <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>
                Customer Information
              </Text>
              <Text style={[styles.detailText, { color: '#ffffff' }]}>
                {job.customer || 'Not specified'}
              </Text>
            </View>

            <View style={[styles.detailSection, { backgroundColor: '#12273a', borderColor: colors.text + '20' }]}>
              <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>
                Job Type
              </Text>
              <Text style={[styles.detailText, { color: '#ffffff' }]}>
                {job.jobType || 'Not specified'}
              </Text>
            </View>

            <View style={[styles.detailSection, { backgroundColor: '#12273a', borderColor: colors.text + '20' }]}>
              <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>
                Equipment & Materials
              </Text>
              <Text style={[styles.detailText, { color: '#ffffff' }]}>
                {job.equipment || 'Not specified'}
              </Text>
            </View>

            <View style={[styles.detailSection, { backgroundColor: '#12273a', borderColor: colors.text + '20' }]}>
              <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>
                Cost
              </Text>
              <Text style={[styles.detailText, { color: '#ffffff' }]}>
                {job.cost || 'Not specified'}
              </Text>
            </View>

            {job.location && (
              <View style={[styles.detailSection, { backgroundColor: '#12273a', borderColor: colors.text + '20' }]}>
                <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>
                  Location
                </Text>
                <Text style={[styles.detailText, { color: '#ffffff' }]}>
                  {job.location}
                </Text>
              </View>
            )}

            {job.additionalNotes && (
              <View style={[styles.detailSection, { backgroundColor: '#12273a', borderColor: colors.text + '20' }]}>
                <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>
                  Additional Notes
                </Text>
                <Text style={[styles.detailText, { color: '#ffffff' }]}>
                  {job.additionalNotes}
                </Text>
              </View>
            )}
          </>
        )}

        {/* Dates */}
        <View style={[styles.detailSection, { backgroundColor: '#12273a', borderColor: colors.text + '20' }]}>
          <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>
            Date Created
          </Text>
          <Text style={[styles.detailText, { color: '#ffffff' }]}>
            {formatDate(job.dateCreated)}
          </Text>
        </View>

        {job.dateCompleted && (
          <View style={[styles.detailSection, { backgroundColor: '#12273a', borderColor: colors.text + '20' }]}>
            <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>
              Date Completed
            </Text>
            <Text style={[styles.detailText, { color: '#ffffff' }]}>
              {formatDate(job.dateCompleted)}
            </Text>
          </View>
        )}

        {/* Progress */}
        <View style={[styles.detailSection, { backgroundColor: '#12273a', borderColor: colors.text + '20' }]}>
          <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>
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
            <Text style={[styles.progressText, { color: '#ffffff' }]}>
              {job.completedSteps} of {job.totalSteps} steps completed
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {onStartNewJob && (
          <TouchableOpacity
            style={[styles.actionButton, styles.newJobButton, { backgroundColor: '#f89448' }]}
            onPress={onStartNewJob}
          >
            <IconSymbol name="plus.circle" size={20} color="white" />
            <Text style={styles.actionButtonText}>Start New Job</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.emailButton, { backgroundColor: '#f89448' }]}
          onPress={handleEmailSummary}
        >
          <IconSymbol name="envelope" size={20} color="white" />
          <Text style={styles.actionButtonText}>
            {isEmailAvailable ? 'Email Summary' : 'Email Not Available'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.shareButton, { backgroundColor: '#f89448' }]}
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
  titleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  rightSection: {
    width: 70, // Match the minWidth of closeButton
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  titleUnderline: {
    width: 60,
    height: 3,
    backgroundColor: '#f89448',
    marginTop: 8,
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