import React, { useLayoutEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import StudyGamesPanel from '@/components/study-hub/StudyGamesPanel';
import StudyGamesProGate from '@/components/study-hub/StudyGamesProGate';
import type { ContentStackParamList } from '@/types/navigation';
import { useStudyPageDwell } from '@/features/concentration/useStudyPageDwell';

type GamesRoute = RouteProp<ContentStackParamList, 'Games'>;

const StudyGamesScreen: React.FC = () => {
  const route = useRoute<GamesRoute>();
  const navigation = useNavigation();
  const { contentId } = route.params;
  useStudyPageDwell({ contentId, pageType: 'games' });
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Games',
      headerTitleAlign: 'center',
    });
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StudyGamesProGate>
        <StudyGamesPanel contentId={contentId} />
      </StudyGamesProGate>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default StudyGamesScreen;
