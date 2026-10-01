import React, { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import DiagramTab from '@/components/study-hub/FlowchartTab';
import type { ContentStackParamList } from '@/types/navigation';
import { useSessionTracker } from '@/analytics/useSessionTracker';
import { EVENTS } from '@/analytics/events';
import { useFlowchartGate } from '@/featureFlags/useFeatureGate';
import { useStudyPageDwell } from '@/features/concentration/useStudyPageDwell';

type FlowchartRouteProp = RouteProp<ContentStackParamList, 'Flowchart'>;

const FlowchartScreen: React.FC = () => {
  const route = useRoute<FlowchartRouteProp>();
  const navigation = useNavigation();
  const { contentId } = route.params;
  const themeMode = useAppTheme();
  const theme = useMemo(() => (themeMode === 'dark' ? darkTheme : lightTheme), [themeMode]);
  const flowchartEnabled = useFlowchartGate();

  useEffect(() => {
    if (!flowchartEnabled) {
      navigation.goBack();
    }
  }, [flowchartEnabled, navigation]);

  useSessionTracker(EVENTS.FLOWCHART_VIEW_STARTED, EVENTS.FLOWCHART_VIEW_ENDED, {
    content_id: contentId,
  });
  useStudyPageDwell({ contentId, pageType: 'mindmap' });

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Mind map',
      headerTitleAlign: 'center',
      headerLeft: () => (
        <TouchableOpacity
          onPress={handleGoBack}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurface} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, handleGoBack, theme.colors.onSurface]);

  if (!flowchartEnabled) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <DiagramTab contentId={contentId} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});

export default FlowchartScreen;
