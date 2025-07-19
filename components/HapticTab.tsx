import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { DeviceEventEmitter } from 'react-native';

export function HapticTab(props: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
      onPress={(ev) => {
        // Check if this is the home tab and emit event
        if (props.accessibilityLabel === 'Home' || props.href === '/' || props.href === '') {
          DeviceEventEmitter.emit('homeTabPressed');
        }
        props.onPress?.(ev);
      }}
    />
  );
}
