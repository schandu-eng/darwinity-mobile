import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Lock } from '@/icons';
import { pointerEventsProp, pointerEventsStyle } from '@/theme/webCompat';

type Props = {
  variant?: 'inline' | 'icon';
  style?: StyleProp<ViewStyle>;
};

/** Compact Pro corner badge for tab icons that require a paid plan. */
export default function FeatureProTag({ variant = 'icon', style }: Props) {
  return (
    <View
      pointerEvents={pointerEventsProp('none')}
      style={[
        styles.base,
        variant === 'icon' ? styles.icon : styles.inline,
        style,
        pointerEventsStyle('none'),
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Lock size={8} strokeWidth={2.6} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3F6B4F',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#7A9E86',
  },
  inline: {
    width: 16,
    height: 16,
  },
  icon: {
    position: 'absolute',
    top: -5,
    right: -8,
    width: 15,
    height: 15,
    zIndex: 2,
  },
});
