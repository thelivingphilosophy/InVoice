import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';

interface CustomAlertButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel';
}

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: CustomAlertButton[];
  onRequestClose?: () => void;
}

export default function CustomAlert({
  visible,
  title,
  message,
  buttons,
  onRequestClose,
}: CustomAlertProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.overlay}>
        <View style={styles.alertContainer}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  button.style === 'cancel' ? styles.cancelButton : styles.defaultButton
                ]}
                onPress={button.onPress}
              >
                <Text style={[
                  styles.buttonText,
                  button.style === 'cancel' ? styles.cancelButtonText : styles.defaultButtonText
                ]}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertContainer: {
    backgroundColor: '#12273a', // Dark blue theme color
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    opacity: 0.9,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultButton: {
    backgroundColor: '#f89448', // Orange color
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#f89448',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  defaultButtonText: {
    color: 'white',
  },
  cancelButtonText: {
    color: '#f89448',
  },
});