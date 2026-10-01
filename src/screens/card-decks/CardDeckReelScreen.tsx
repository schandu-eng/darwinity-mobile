import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useReelFeed } from '@/api/queries/cardDecksV2';
import CardDeckReelEditor from '@/components/study-hub/card-decks/CardDeckReelEditor';
import CardDeckScopedReel from '@/components/study-hub/card-decks/CardDeckScopedReel';
import {
  OnboardingTourProvider,
  TourAnchor,
  CARD_DECK_REEL_TOUR_ID,
  CARD_DECK_REEL_TOUR_STEPS,
  type TourStep,
} from '@/components/ui/feature-tour';
import type { AppStackParamList } from '@/types/navigation';

import { Fonts } from '@/config/fonts';

const REEL_TOUR_STEPS = CARD_DECK_REEL_TOUR_STEPS as TourStep[];

type NavigationProp = NativeStackNavigationProp<AppStackParamList, 'CardReel'>;

type ViewMode = 'hub' | 'configuring' | 'session';

const CloseButton = React.memo<{ onPress: () => void; backgroundColor: string; iconColor: string }>(
  ({ onPress, backgroundColor, iconColor }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[headerStyles.closeButton, { backgroundColor }]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name="close" size={20} color={iconColor} />
    </TouchableOpacity>
  )
);
CloseButton.displayName = 'CloseButton';

const CardReelScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? null;
  const themeMode = useAppTheme();
  const theme = useMemo(() => (themeMode === 'dark' ? darkTheme : lightTheme), [themeMode]);

  const [viewMode, setViewMode] = useState<ViewMode>('hub');
  const [, setActionError] = useState('');

  const { data: feed, isLoading, refetch } = useReelFeed(userId);

  useFocusEffect(
    useCallback(() => {
      if (viewMode === 'hub') {
        refetch();
      }
    }, [refetch, viewMode])
  );

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: '',
      headerLeft: () => (
        <CloseButton
          onPress={handleGoBack}
          backgroundColor={theme.colors.surfaceVariant}
          iconColor={theme.colors.onSurface}
        />
      ),
      headerStyle: {
        backgroundColor: theme.colors.surface,
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 0,
      },
      headerShadowVisible: false,
    });
  }, [navigation, theme.colors.surface, theme.colors.surfaceVariant, theme.colors.onSurface, handleGoBack]);

  const handleStudyNow = useCallback(() => {
    const count = feed?.study_queue_count || 0;
    const setsCount = feed?.feed_count || 0;
    if (count === 0) {
      if (setsCount === 0) {
        setActionError('');
        setViewMode('configuring');
        return;
      }
      setActionError('Nothing due right now. Check back later');
      return;
    }
    setActionError('');
    setViewMode('session');
  }, [feed?.study_queue_count, feed?.feed_count]);

  const handleSessionBack = useCallback(() => {
    setViewMode('hub');
    refetch();
  }, [refetch]);

  const handleEditorSaved = useCallback(() => {
    setViewMode('hub');
    refetch();
  }, [refetch]);

  if (!userId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.centered}>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>Please sign in to continue.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (viewMode === 'session') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <CardDeckScopedReel userId={userId} onBack={handleSessionBack} />
      </SafeAreaView>
    );
  }

  if (viewMode === 'configuring') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setViewMode('hub')} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.onSurface} />
          </TouchableOpacity>
        </View>
        <View style={styles.editorWrap}>
          <CardDeckReelEditor
            userId={userId}
            onBack={() => setViewMode('hub')}
            onSaved={handleEditorSaved}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <OnboardingTourProvider
      tourId={CARD_DECK_REEL_TOUR_ID}
      steps={REEL_TOUR_STEPS}
      autoStart={!isLoading}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.onSurface} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.hubContent} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: themeMode === 'dark' ? 'rgba(59,130,246,0.2)' : '#DBEAFE' }]}>
              <MaterialCommunityIcons name="layers" size={28} color={theme.colors.primary} />
            </View>
            <Text variant="headlineSmall" style={[styles.heroTitle, { color: theme.colors.onSurface }]}>
              Study feed
            </Text>
            <Text style={[styles.heroSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              Due cards from your decks, in one study queue.
            </Text>
          </View>

          {isLoading ? (
            <View style={[styles.statsCard, { backgroundColor: theme.colors.surface }]}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            <View style={[styles.statsCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
              <TourAnchor stepId="stats">
                <View style={styles.statsGrid}>
                  <View style={[styles.statBox, { backgroundColor: themeMode === 'dark' ? 'rgba(59,130,246,0.15)' : '#EFF6FF' }]}>
                    <Text style={[styles.statValue, { color: theme.colors.primary }]}>
                      {feed?.study_queue_count || 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.primary }]}>To review</Text>
                    {(feed?.study_queue_count || 0) > 0 ? (
                      <Text style={[styles.statDetail, { color: theme.colors.primary }]}>
                        {feed?.due_count || 0} due
                        {(feed?.new_count || 0) > 0 ? ` · ${feed?.new_count} new` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Text style={[styles.statValue, { color: theme.colors.onSurface }]}>
                      {feed?.feed_count || 0}
                    </Text>
                    <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>Sets included</Text>
                  </View>
                </View>
              </TourAnchor>

              <TourAnchor stepId="study">
                <TouchableOpacity
                  onPress={handleStudyNow}
                  style={[
                    styles.studyButton,
                    {
                      backgroundColor: theme.colors.primary,
                      opacity: 1,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name="play" size={18} color="#FFFFFF" />
                  <Text style={styles.studyButtonText}>
                    {(feed?.study_queue_count || 0) === 0
                      ? (feed?.feed_count || 0) === 0
                        ? 'Nothing to review. Choose sets to add'
                        : 'Nothing to review right now'
                      : `Study now (${feed?.study_queue_count} card${feed?.study_queue_count === 1 ? '' : 's'})`}
                  </Text>
                </TouchableOpacity>
              </TourAnchor>

              <TourAnchor stepId="manage">
                <TouchableOpacity
                  onPress={() => setViewMode('configuring')}
                  style={[styles.manageButton, { borderColor: theme.colors.outlineVariant }]}
                >
                  <MaterialCommunityIcons name="tune-variant" size={18} color={theme.colors.onSurface} />
                  <Text style={[styles.manageButtonText, { color: theme.colors.onSurface }]}>Choose sets</Text>
                </TouchableOpacity>
              </TourAnchor>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </OnboardingTourProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorWrap: { flex: 1, paddingHorizontal: 20, paddingBottom: 20 },
  hubContent: { paddingHorizontal: 20, paddingBottom: 32 },
  hero: { alignItems: 'center', marginBottom: 28, marginTop: 8 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: { fontFamily: Fonts.ui.bold, marginBottom: 6 },
  heroSubtitle: { textAlign: 'center', fontSize: 14, lineHeight: 20, paddingHorizontal: 16 },
  statsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'stretch',
    minHeight: 120,
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  statValue: { fontSize: 28, fontFamily: Fonts.ui.bold },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDetail: { fontSize: 11, marginTop: 4, opacity: 0.8 },
  studyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 8,
  },
  studyButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
  },
  manageButtonText: { fontWeight: '600', fontSize: 14 },
});

const headerStyles = StyleSheet.create({
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default CardReelScreen;
