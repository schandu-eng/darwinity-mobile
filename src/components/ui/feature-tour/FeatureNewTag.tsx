import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Sparkles } from '@/icons';
import { subscribeFeatureNewDismiss, subscribeTourCompleted } from './featureNewEvents';
import { isFeatureNewVisible } from './featureNewStorage';
import { pointerEventsProp, pointerEventsStyle } from '@/theme/webCompat';

import { Fonts } from '@/config/fonts';

type Props = {
  featureId: string;
  tourId?: string;
  variant?: 'inline' | 'icon';
  style?: StyleProp<ViewStyle>;
};

export default function FeatureNewTag({
  featureId,
  tourId,
  variant = 'inline',
  style,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const next = await isFeatureNewVisible(featureId, { tourId });
      if (!cancelled) setVisible(next);
    };

    void refresh();

    const unsubscribeDismiss = subscribeFeatureNewDismiss((dismissedId) => {
      if (dismissedId === featureId) {
        setVisible(false);
      }
    });

    const unsubscribeTour = subscribeTourCompleted((completedTourId) => {
      if (tourId && completedTourId === tourId) {
        setVisible(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribeDismiss();
      unsubscribeTour();
    };
  }, [featureId, tourId]);

  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents={pointerEventsProp('none')}
      style={[
        styles.base,
        variant === 'icon' ? styles.icon : styles.inline,
        style,
        pointerEventsStyle('none'),
      ]}
    >
      <Sparkles size={9} strokeWidth={2.5} color="#F59E0B" />
      <Text style={styles.label}>New</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FCD34D',
  },
  inline: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  icon: {
    position: 'absolute',
    top: -6,
    right: -10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    zIndex: 2,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.ui.bold,
    color: '#B45309',
  },
});
