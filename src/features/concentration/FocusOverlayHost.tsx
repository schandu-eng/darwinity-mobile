import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { ConcentrationChip } from './FocusChip';
import { CheckpointModalHost } from './CheckpointModalHost';
import { useConcentrationSessionOptional } from './ConcentrationSessionProvider';
import { markStudyDwellActivity } from './dwellQueue';
import type { RootStackParamList } from '@/types/navigation';

function getActiveRouteName(state: any): string | null {
  if (!state) return null;
  const route = state.routes?.[state.index ?? 0];
  if (!route) return null;
  if (route.state) return getActiveRouteName(route.state);
  return route.name ?? null;
}

export const ConcentrationOverlayHost: React.FC<{
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>;
}> = ({ navigationRef }) => {
  const focus = useConcentrationSessionOptional();

  const returnToStudyScreen = useCallback(
    (screen: string) => {
      if (!navigationRef.isReady()) return;
      navigationRef.dispatch(
        CommonActions.navigate({
          name: screen as keyof RootStackParamList,
        } as any)
      );
    },
    [navigationRef]
  );

  useEffect(() => {
    if (!focus) return undefined;
    focus.registerReturnToStudy(returnToStudyScreen);
    return () => focus.registerReturnToStudy(null);
  }, [focus, returnToStudyScreen]);

  const syncRoute = useCallback(() => {
    if (!focus || !navigationRef.isReady()) return;
    const name = getActiveRouteName(navigationRef.getRootState());
    focus.setCurrentScreen(name);
  }, [focus, navigationRef]);

  useEffect(() => {
    syncRoute();
    const unsub = navigationRef.addListener('state', syncRoute);
    return unsub;
  }, [navigationRef, syncRoute]);

  return (
    <View
      style={styles.host}
      pointerEvents="box-none"
      onStartShouldSetResponderCapture={() => {
        markStudyDwellActivity();
        return false;
      }}
      onMoveShouldSetResponderCapture={() => {
        markStudyDwellActivity();
        return false;
      }}
    >
      <ConcentrationChip variant="modals" />
      <CheckpointModalHost />
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
});
