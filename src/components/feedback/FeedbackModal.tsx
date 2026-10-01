import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, TextInput, Platform, Animated, Linking } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as StoreReview from 'expo-store-review';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useAuthStore } from '@/store';
import { useNotificationStore } from '@/store/notificationStore';
import apiClient from '@/api/client';
import ErrorBanner from '@/components/ui/ErrorBanner';

import { Fonts } from '@/config/fonts';
import { USE_NATIVE_DRIVER } from '@/theme/webCompat';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  source?: string;
}

type Phase = 'rating' | 'text';

const STARS = [1, 2, 3, 4, 5] as const;
const MAX_MESSAGE_LENGTH = 2000;
const DEFAULT_SOURCE = 'mobile_settings';
const HAPPY_THRESHOLD = 4;

const FeedbackModal: React.FC<FeedbackModalProps> = ({ visible, onClose, source = DEFAULT_SOURCE }) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((state) => state.user);
  const showSuccess = useNotificationStore((s) => s.showSuccess);

  const [phase, setPhase] = useState<Phase>('rating');
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textInputOpacity] = useState(new Animated.Value(0));

  const showTextPhase = phase === 'text';

  useEffect(() => {
    if (visible) {
      setPhase('rating');
      setRating(0);
      setMessage('');
      setIsSubmitting(false);
      setError(null);
      textInputOpacity.setValue(0);
    }
  }, [visible, textInputOpacity]);

  const animateTextIn = useCallback(() => {
    Animated.timing(textInputOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [textInputOpacity]);

  const submitToApi = useCallback(
    async (feedbackMessage: string, feedbackRating: number) => {
      await apiClient.post('/api/feedback', {
        message: feedbackMessage,
        rating: feedbackRating,
        user_id: user?.id ?? null,
        email: user?.email ?? null,
        source,
      });
    },
    [user, source]
  );

  const triggerStoreReview = useCallback(async () => {
    try {
      const available = await StoreReview.isAvailableAsync();
      if (available) {
        await StoreReview.requestReview();
      }
    } catch {}
  }, []);

  const handleStarPress = useCallback(
    async (value: number) => {
      if (isSubmitting) return;
      setRating(value);

      if (value >= HAPPY_THRESHOLD) {
        setIsSubmitting(true);
        setError(null);
        try {
          await submitToApi(`Rated ${value} stars`, value);
          onClose();
          triggerStoreReview();
        } catch (err: any) {
          setError(err?.response?.data?.detail || err?.message || 'Failed to submit. Please try again.');
          setIsSubmitting(false);
        }
        return;
      }

      setPhase('text');
      animateTextIn();
    },
    [isSubmitting, submitToApi, onClose, triggerStoreReview, animateTextIn]
  );

  const handleSubmitText = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await submitToApi(trimmed, rating);
      showSuccess('Thanks for your feedback!');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [message, rating, submitToApi, onClose, showSuccess]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) onClose();
  }, [isSubmitting, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>
              {showTextPhase ? 'What can we do better?' : "How's your experience?"}
            </Text>
            <TouchableOpacity onPress={handleClose} disabled={isSubmitting} style={styles.closeButton} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} variant="compact" /> : null}

            <View style={styles.starsRow}>
              {STARS.map((value) => (
                <TouchableOpacity
                  key={value}
                  onPress={() => handleStarPress(value)}
                  disabled={isSubmitting || showTextPhase}
                  activeOpacity={0.7}
                  style={styles.starButton}
                >
                  <MaterialCommunityIcons
                    name={value <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color={value <= rating ? '#F59E0B' : theme.colors.outlineVariant}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {showTextPhase && (
              <Animated.View style={[styles.textSection, { opacity: textInputOpacity }]}>
                <TextInput
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: theme.colors.surfaceVariant,
                      color: theme.colors.onSurface,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                  placeholder="Share anything that would make Darwinity better for you..."
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={5}
                  maxLength={MAX_MESSAGE_LENGTH}
                  editable={!isSubmitting}
                  autoFocus
                />
                <Text style={[styles.charCount, { color: theme.colors.onSurfaceVariant }]}>
                  {message.trim().length}/{MAX_MESSAGE_LENGTH}
                </Text>
                <TouchableOpacity
                  onPress={handleSubmitText}
                  disabled={isSubmitting || !message.trim()}
                  style={[
                    styles.submitButton,
                    {
                      backgroundColor: theme.colors.primary,
                      opacity: isSubmitting || !message.trim() ? 0.5 : 1,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.submitButtonText, { color: theme.colors.onPrimary }]}>
                    {isSubmitting ? 'Submitting...' : 'Submit'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            )}

            {!showTextPhase && !isSubmitting && (
              <TouchableOpacity onPress={handleClose} style={styles.skipButton} activeOpacity={0.7}>
                <Text style={[styles.skipText, { color: theme.colors.onSurfaceVariant }]}>
                  Not now
                </Text>
              </TouchableOpacity>
            )}

            {isSubmitting && !showTextPhase && (
              <Text style={[styles.submittingText, { color: theme.colors.onSurfaceVariant }]}>
                Submitting...
              </Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.ui.bold,
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  textSection: {
    gap: 10,
  },
  textArea: {
    minHeight: 100,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    textAlignVertical: 'top',
    fontSize: 14,
    lineHeight: 20,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: Fonts.ui.semiBold,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    fontFamily: Fonts.ui.medium,
  },
  submittingText: {
    textAlign: 'center',
    fontSize: 14,
  },
});

export default FeedbackModal;
