// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'house': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'gearshape': 'settings',
  'pencil': 'edit',
  'speaker.wave.2': 'volume-up',
  'mic': 'mic',
  'mic.circle': 'mic',
  'stop.circle': 'stop',
  'play.circle': 'play-arrow',
  'arrow.left': 'arrow-back',
  'envelope': 'email',
  'square.and.arrow.up': 'share',
  'trash': 'delete',
  'plus.circle': 'add-circle',
  'checkmark.circle.fill': 'check-circle',
  'clock.fill': 'schedule',
  'circle.fill': 'fiber-manual-record',
  'checkmark': 'check',
  'doc.text': 'description',
  'list.bullet': 'list',
  'waveform': 'graphic-eq',
  'mic.slash': 'mic-off',
  'square': 'check-box-outline-blank',
  'checkmark.square': 'check-box',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
