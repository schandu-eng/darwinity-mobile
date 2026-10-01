import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useAuthStore } from '@/store';
import { useProcessYouTube } from '@/api/queries/upload';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { showUpgradePaywall, tryShowLimitPaywall } from '@/utils/subscriptionErrorHandler';
import {
  useYoutubePasteAccess,
  YOUTUBE_LIMIT_TYPE,
  YOUTUBE_UPGRADE_MESSAGE,
} from '@/hooks/useProFeatureAccess';
import { validateYouTubeUrl } from '@/utils/youtubeUrl';
import type { ContentStackParamList } from '@/types/navigation';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import { notifyIntakeFailureSupportHint } from '@/store/intakeFailureSupportHintStore';

import { Fonts } from '@/config/fonts';

type YouTubeLinkNavigationProp = NativeStackNavigationProp<ContentStackParamList, 'YouTubeLink'>;
type YouTubeLinkRouteProp = RouteProp<ContentStackParamList, 'YouTubeLink'>;

const YouTubeLinkScreen: React.FC = () => {
  const navigation = useNavigation<YouTubeLinkNavigationProp>();
  const route = useRoute<YouTubeLinkRouteProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((state) => state.user);
  const folderId = route.params?.folderId;
  const processYouTubeMutation = useProcessYouTube();
  const { locked: youtubeLocked } = useYoutubePasteAccess();

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!youtubeLocked) return;
    showUpgradePaywall(YOUTUBE_UPGRADE_MESSAGE, YOUTUBE_LIMIT_TYPE);
    navigation.goBack();
  }, [youtubeLocked, navigation]);

  useEffect(() => {
    const routeError = route.params?.error;
    if (!routeError) return;
    navigation.setParams({ error: undefined });
    if (tryShowLimitPaywall(routeError)) {
      return;
    }
    setError(routeError);
  }, [route.params?.error, navigation]);

  const isValidUrl = useMemo(() => validateYouTubeUrl(youtubeUrl).valid, [youtubeUrl]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleOpenYouTubeApp = useCallback(async () => {
    try {
      const youtubeAppUrl = Platform.select({
        ios: 'youtube://',
        android: 'vnd.youtube:',
      });

      if (youtubeAppUrl) {
        const canOpen = await Linking.canOpenURL(youtubeAppUrl);
        if (canOpen) {
          await Linking.openURL(youtubeAppUrl);
        } else {
          await Linking.openURL('https://www.youtube.com');
        }
      } else {
        await Linking.openURL('https://www.youtube.com');
      }
    } catch {
      Alert.alert('Error', 'Unable to open YouTube');
    }
  }, []);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync();
      if (clipboardText && clipboardText.trim()) {
        setYoutubeUrl(clipboardText.trim());
        setError('');
      } else {
        Alert.alert('Clipboard Empty', 'No text found in clipboard');
      }
    } catch {
      Alert.alert('Error', 'Unable to access clipboard');
    }
  }, []);

  const handleGenerateNotes = useCallback(async () => {
    if (youtubeLocked) {
      showUpgradePaywall(YOUTUBE_UPGRADE_MESSAGE, YOUTUBE_LIMIT_TYPE);
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    setError('');

    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    const youtubeValidation = validateYouTubeUrl(youtubeUrl);
    if (!youtubeValidation.valid) {
      setError(youtubeValidation.message);
      return;
    }

    try {
      analytics.track(EVENTS.CONTENT_UPLOAD_STARTED, { content_type: 'youtube' });
      const result = await processYouTubeMutation.mutateAsync({
        url: youtubeUrl.trim(),
        userId: user.id,
        folderId,
      });

      if (result.success && result.data) {
        analytics.track(EVENTS.CONTENT_UPLOAD_SUCCEEDED, { content_type: 'youtube' });
        navigation.navigate('UploadProgress', {
          jobId: result.data.job_id,
          contentTitle: 'YouTube Video',
          sourceScreen: 'YouTubeLink',
          folderId,
        });
      } else if (result.limitReached) {
        analytics.track(EVENTS.CONTENT_UPLOAD_FAILED, { content_type: 'youtube', reason: 'limit_reached' });
        return;
      } else {
        analytics.track(EVENTS.CONTENT_UPLOAD_FAILED, { content_type: 'youtube', reason: 'request_error' });
        setError(result.message || 'Failed to process YouTube video');
        notifyIntakeFailureSupportHint();
      }
    } catch (err: any) {
      analytics.track(EVENTS.CONTENT_UPLOAD_FAILED, { content_type: 'youtube', reason: 'request_error' });
      setError(err.message || 'Failed to process YouTube video');
      notifyIntakeFailureSupportHint();
    }
  }, [youtubeUrl, user, processYouTubeMutation, navigation, folderId, youtubeLocked]);

  const isLoading = processYouTubeMutation.isPending;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Paste YouTube Link</Text>
          <TouchableOpacity onPress={handleOpenYouTubeApp} activeOpacity={0.7}>
            <Text style={[styles.openYouTubeText, { color: theme.colors.primary }]}>Open YouTube App</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight} />
      </View>

      {error ? (
        <View style={styles.errorBannerContainer}>
          <ErrorBanner message={error} onDismiss={() => setError('')} />
        </View>
      ) : null}

      <View style={styles.content}>
        <View style={styles.inputSection}>
          <View style={styles.lightningContainer}>
            <Text style={styles.lightningEmoji}>⚡</Text>
            <Text style={[styles.lightningText, { color: theme.colors.onSurfaceVariant }]}>enter link here</Text>
            <Text style={styles.lightningEmoji}>⚡</Text>
          </View>

          <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
            <TextInput
              style={[styles.input, { color: theme.colors.onSurface }]}
              value={youtubeUrl}
              onChangeText={(text) => {
                setYoutubeUrl(text);
                setError('');
              }}
              placeholder="www.youtube.com/watch?v=ArcI4A5nvBo"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity onPress={handlePasteFromClipboard} activeOpacity={0.7}>
            <Text style={[styles.pasteText, { color: theme.colors.primary }]}>Paste From Clipboard</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.generateButton,
            {
              backgroundColor: isValidUrl && !isLoading ? theme.colors.primary : theme.colors.surfaceVariant,
            },
          ]}
          onPress={handleGenerateNotes}
          disabled={!isValidUrl || isLoading}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.generateButtonText,
              {
                color: isValidUrl && !isLoading ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
              },
            ]}
          >
            {isLoading ? 'Processing...' : 'Generate Notes'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginTop: -2,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 2,
  },
  headerTitle: {
    fontFamily: Fonts.ui.bold,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  openYouTubeText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  headerRight: {
    width: 44,
  },
  errorBannerContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  inputSection: {
    alignItems: 'center',
    gap: 16,
  },
  lightningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  lightningEmoji: {
    fontSize: 20,
  },
  lightningText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  inputContainer: {
    width: '100%',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 56,
    justifyContent: 'center',
  },
  input: {
    fontFamily: Fonts.ui.regular,
    fontSize: 16,
    padding: 0,
  },
  pasteText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 56,
    paddingTop: 24,
  },
  generateButton: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  generateButtonText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 16,
    
  },
});

export default YouTubeLinkScreen;
