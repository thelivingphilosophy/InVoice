import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export interface JobDetails {
  id: string;
  clientName: string;
  address: string;
  jobType: string;
  description: string;
  materials: string;
  laborHours: string;
  notes: string;
  dateCreated: string;
  dateCompleted?: string;
}

interface JobDetailsFormProps {
  initialJob?: JobDetails;
  onSave: (job: JobDetails) => void;
  onCancel: () => void;
}

export default function JobDetailsForm({ initialJob, onSave, onCancel }: JobDetailsFormProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  const [formData, setFormData] = useState<JobDetails>(
    initialJob || {
      id: '',
      clientName: '',
      address: '',
      jobType: '',
      description: '',
      materials: '',
      laborHours: '',
      notes: '',
      dateCreated: new Date().toISOString(),
    }
  );
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSave = () => {
    onSave(formData);
  };

  const updateField = (field: keyof JobDetails, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.text }]}>Job Details</Text>
        <View style={styles.titleUnderline} />
        
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>Client Name</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.background, 
              borderColor: focusedField === 'clientName' ? '#f89448' : colors.text, 
              color: colors.text 
            }]}
            value={formData.clientName}
            onChangeText={(value) => updateField('clientName', value)}
            onFocus={() => setFocusedField('clientName')}
            onBlur={() => setFocusedField(null)}
            placeholder="Enter client name"
            placeholderTextColor={colors.text + '80'}
          />

          <Text style={[styles.label, { color: colors.text }]}>Address</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.background, 
              borderColor: focusedField === 'address' ? '#f89448' : colors.text, 
              color: colors.text 
            }]}
            value={formData.address}
            onChangeText={(value) => updateField('address', value)}
            onFocus={() => setFocusedField('address')}
            onBlur={() => setFocusedField(null)}
            placeholder="Enter job address"
            placeholderTextColor={colors.text + '80'}
          />

          <Text style={[styles.label, { color: colors.text }]}>Job Type</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.background, 
              borderColor: focusedField === 'jobType' ? '#f89448' : colors.text, 
              color: colors.text 
            }]}
            value={formData.jobType}
            onChangeText={(value) => updateField('jobType', value)}
            onFocus={() => setFocusedField('jobType')}
            onBlur={() => setFocusedField(null)}
            placeholder="Enter job type"
            placeholderTextColor={colors.text + '80'}
          />

          <Text style={[styles.label, { color: colors.text }]}>Description</Text>
          <TextInput
            style={[styles.textArea, { 
              backgroundColor: colors.background, 
              borderColor: focusedField === 'description' ? '#f89448' : colors.text, 
              color: colors.text 
            }]}
            value={formData.description}
            onChangeText={(value) => updateField('description', value)}
            onFocus={() => setFocusedField('description')}
            onBlur={() => setFocusedField(null)}
            placeholder="Enter job description"
            placeholderTextColor={colors.text + '80'}
            multiline
            numberOfLines={4}
          />

          <Text style={[styles.label, { color: colors.text }]}>Materials</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.background, 
              borderColor: focusedField === 'materials' ? '#f89448' : colors.text, 
              color: colors.text 
            }]}
            value={formData.materials}
            onChangeText={(value) => updateField('materials', value)}
            onFocus={() => setFocusedField('materials')}
            onBlur={() => setFocusedField(null)}
            placeholder="Enter materials used"
            placeholderTextColor={colors.text + '80'}
          />

          <Text style={[styles.label, { color: colors.text }]}>Labor Hours/Cost</Text>
          <TextInput
            style={[styles.input, { 
              backgroundColor: colors.background, 
              borderColor: focusedField === 'laborHours' ? '#f89448' : colors.text, 
              color: colors.text 
            }]}
            value={formData.laborHours}
            onChangeText={(value) => updateField('laborHours', value)}
            onFocus={() => setFocusedField('laborHours')}
            onBlur={() => setFocusedField(null)}
            placeholder="Enter labor hours or cost"
            placeholderTextColor={colors.text + '80'}
          />

          <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
          <TextInput
            style={[styles.textArea, { 
              backgroundColor: colors.background, 
              borderColor: focusedField === 'notes' ? '#f89448' : colors.text, 
              color: colors.text 
            }]}
            value={formData.notes}
            onChangeText={(value) => updateField('notes', value)}
            onFocus={() => setFocusedField('notes')}
            onBlur={() => setFocusedField(null)}
            placeholder="Additional notes"
            placeholderTextColor={colors.text + '80'}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#f89448' }]}
            onPress={handleSave}
          >
            <Text style={styles.buttonText}>Save Job</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#666' }]}
            onPress={onCancel}
          >
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  titleUnderline: {
    width: 60,
    height: 3,
    backgroundColor: '#f89448',
    alignSelf: 'center',
    marginBottom: 30,
  },
  form: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  buttons: {
    gap: 15,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});