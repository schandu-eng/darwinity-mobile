import React, { useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAppTheme } from '@/store/appThemeStore';
import { darkTheme, lightTheme } from '@/theme';
import AssessmentsTab from '@/components/study-hub/QuizzesTab';
import type { ContentStackParamList } from '@/types/navigation';
import { useSessionTracker } from '@/analytics/useSessionTracker';
import { EVENTS } from '@/analytics/events';
import { useStudyPageDwell } from '@/features/concentration/useStudyPageDwell';

type QuizRouteProp = RouteProp<ContentStackParamList, 'Quiz'>;

const QuizScreen: React.FC = () => {
  const route = useRoute<QuizRouteProp>();
  const navigation = useNavigation();
  const { contentId } = route.params;
  const themeMode = useAppTheme();
  const theme = useMemo(() => (themeMode === 'dark' ? darkTheme : lightTheme), [themeMode]);

  useSessionTracker(EVENTS.QUIZ_STARTED, EVENTS.QUIZ_ENDED, { content_id: contentId });
  useStudyPageDwell({ contentId, pageType: 'quiz' });

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const handleAskInChat = useCallback(
    (context: string | null) => {
      navigation.navigate('Chat', {
        contentId,
        selectedText: context || undefined,
      });
    },
    [navigation, contentId]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <AssessmentsTab contentId={contentId} onClose={handleGoBack} onAskInChat={handleAskInChat} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default QuizScreen;

