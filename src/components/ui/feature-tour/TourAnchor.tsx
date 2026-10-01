import React, { useContext, useEffect, useRef } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { FeatureTourContext } from './FeatureTourContext';
import type { AnchorView } from './types';

type Props = {
  stepId: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function TourAnchor({ stepId, children, style }: Props) {
  const tour = useContext(FeatureTourContext);
  const localRef = useRef<View>(null);

  useEffect(() => {
    if (!tour) return undefined;
    tour.registerAnchor(stepId, localRef as React.RefObject<AnchorView | null>);
    return () => tour.unregisterAnchor(stepId);
  }, [stepId, tour]);

  return (
    <View ref={localRef} collapsable={false} style={style}>
      {children}
    </View>
  );
}
