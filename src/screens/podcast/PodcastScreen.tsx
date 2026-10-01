import React, { useLayoutEffect, useMemo, useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import AudioLessonTab from '@/components/study-hub/PodcastTab';
import PodcastProGate from '@/components/study-hub/PodcastProGate';
import type { ContentStackParamList } from '@/types/navigation';
import { useSessionTracker } from '@/analytics/useSessionTracker';
import { EVENTS } from '@/analytics/events';
import { useStudyPageDwell } from '@/features/concentration/useStudyPageDwell';
import { BRAND_COLORS } from '@/config/brand';

const PodcastSessionTracker: React.FC<{ contentId: number }> = ({ contentId }) => {
  useSessionTracker(EVENTS.PODCAST_PLAY_STARTED, EVENTS.PODCAST_PLAY_ENDED, { content_id: contentId });
  return null;
};

type PodcastRouteProp = RouteProp<ContentStackParamList, 'Podcast'>;

const PLAYER_HEADER_VERTICAL_PADDING = 8;
const PLAYER_HEADER_CONTENT_PADDING = 32 + PLAYER_HEADER_VERTICAL_PADDING * 2;

const CloseButton = React.memo<{ onPress: () => void; backgroundColor: string; iconColor: string }>(
  ({ onPress, backgroundColor, iconColor }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.closeButton, { backgroundColor }]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name="close" size={20} color={iconColor} />
    </TouchableOpacity>
  )
);
CloseButton.displayName = 'CloseButton';

const PodcastScreen: React.FC = () => {
  const route = useRoute<PodcastRouteProp>();
  const navigation = useNavigation();
  const { contentId } = route.params;
  useStudyPageDwell({ contentId, pageType: 'podcast' });
  const themeMode = useAppTheme();
  const theme = useMemo(() => (themeMode === 'dark' ? darkTheme : lightTheme), [themeMode]);
  const [arePodcastsDisplayed, setArePodcastsDisplayed] = useState(false);
  const [holdProcessing, setHoldProcessing] = useState(false);
  const insets = useSafeAreaInsets();
  const playerGradient = useMemo<readonly [string, string]>(
    () => [BRAND_COLORS.paper, BRAND_COLORS.paper],
    []
  );
  const generationGradient = useMemo<readonly [string, string]>(
    () => [theme.colors.background, theme.colors.background],
    [theme.colors.background]
  );

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handlePodcastDisplayedChange = useCallback((displayed: boolean) => {
    setArePodcastsDisplayed(displayed);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: !arePodcastsDisplayed,
      headerTitle: '',
      headerLeft: () => (
        !arePodcastsDisplayed ? (
          <CloseButton
            onPress={handleGoBack}
            backgroundColor={theme.colors.surfaceVariant}
            iconColor={theme.colors.onSurface}
          />
        ) : null
      ),
      headerRight: () => null,
      headerStyle: {
        backgroundColor: theme.colors.surface,
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 0,
      },
      statusBarTranslucent: arePodcastsDisplayed,
      statusBarColor: arePodcastsDisplayed ? 'transparent' : theme.colors.surface,
      headerShadowVisible: false,
    });
  }, [navigation, theme.colors.surface, theme.colors.surfaceVariant, theme.colors.onSurface, handleGoBack, arePodcastsDisplayed]);

  const isGenerationScreen = !arePodcastsDisplayed;

  return (
    <LinearGradient
      colors={isGenerationScreen ? generationGradient : playerGradient}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      {!isGenerationScreen ? (
        <StatusBar
          style={themeMode === 'dark' ? 'light' : 'dark'}
          translucent
          backgroundColor="transparent"
        />
      ) : null}
      {arePodcastsDisplayed ? <PodcastSessionTracker contentId={contentId} /> : null}
      <View style={styles.safeArea}>
        <PodcastProGate>
          <AudioLessonTab
            contentId={contentId}
            onPodcastDisplayedChange={handlePodcastDisplayedChange}
            holdProcessing={holdProcessing}
            onHoldProcessingChange={setHoldProcessing}
            playerTopPadding={isGenerationScreen ? 24 : PLAYER_HEADER_CONTENT_PADDING}
          />
        </PodcastProGate>
      </View>
      {!isGenerationScreen ? (
        <View
          pointerEvents="box-none"
          style={[styles.playerHeader, { paddingTop: insets.top + PLAYER_HEADER_VERTICAL_PADDING }]}
        >
          <CloseButton
            onPress={handleGoBack}
            backgroundColor={theme.colors.surfaceVariant}
            iconColor={theme.colors.onSurface}
          />
        </View>
      ) : null}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  playerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 12,
    paddingBottom: PLAYER_HEADER_VERTICAL_PADDING,
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default PodcastScreen;
