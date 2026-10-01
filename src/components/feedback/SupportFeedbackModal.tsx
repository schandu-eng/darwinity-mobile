import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Platform,
  ScrollView,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Text,
} from 'react-native';
import { ThumbsDown, ThumbsUp, X } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';
import { useAppTheme } from '@/store/appThemeStore';
import { useAuthStore } from '@/store';
import { useNotificationStore } from '@/store/notificationStore';
import apiClient from '@/api/client';
import ErrorBanner from '@/components/ui/ErrorBanner';
import {
  DIALOG_CLOSE_MS,
  DIALOG_OPEN_MS,
  DIALOG_ZOOM_FROM,
  MODAL_ELEVATED_SHADOW,
  TOOLBAR_SHADOW,
  USE_NATIVE_DRIVER,
  boxShadow,
  overlayBlurStyle,
  pointerEventsProp,
  pointerEventsStyle,
} from '@/theme/webCompat';

const SUPPORT_FEEDBACK_CATEGORIES = [
  'Bugs',
  'Feature Request',
  'Uploading Files',
  'Notes',
  'Chat',
  'Quizzes',
  'Flashcards',
  'Podcasts',
  'Exam Prep',
  'Billing',
  'Other',
] as const;

const MAX_MESSAGE_LENGTH = 2000;
const DEFAULT_SOURCE = 'home_header_mobile';
const EASE_DIALOG = Easing.bezier(0.4, 0, 0.2, 1);

interface SupportFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  source?: string;
}

const SupportFeedbackModal: React.FC<SupportFeedbackModalProps> = ({
  visible,
  onClose,
  source = DEFAULT_SOURCE,
}) => {
  const isDark = (useAppTheme() as 'light' | 'dark') === 'dark';
  const user = useAuthStore((state) => state.user);
  const showSuccess = useNotificationStore((s) => s.showSuccess);

  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [mounted, setMounted] = useState(visible);

  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (!visible) return;
    setMessage('');
    setRating(null);
    setCategories([]);
    setIsSubmitting(false);
    setError(null);
    setFocused(false);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: DIALOG_OPEN_MS,
        easing: EASE_DIALOG,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
      return;
    }
    if (!mounted) return;
    Animated.timing(progress, {
      toValue: 0,
      duration: DIALOG_CLOSE_MS,
      easing: EASE_DIALOG,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, progress]);

  const toggleCategory = useCallback((category: string) => {
    setCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category],
    );
  }, []);

  const handleClose = useCallback(() => {
    if (!isSubmitting) onClose();
  }, [isSubmitting, onClose]);

  const handleSubmit = useCallback(async () => {
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      setError('Please describe your feedback in a few words.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/api/feedback', {
        message: trimmed,
        rating,
        categories: categories.length ? categories : null,
        user_id: user?.id ?? null,
        email: user?.email ?? null,
        source,
      });
      showSuccess('Thanks. We got your feedback.');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [message, rating, categories, user, source, onClose, showSuccess]);

  const trimmedLength = message.trim().length;
  const canSubmit = trimmedLength >= 3 && !isSubmitting;

  const paper = isDark ? '#111113' : '#FFFFFF';
  const ink = isDark ? '#FAFAFA' : BRAND_COLORS.ink;
  const muted = isDark ? '#A1A1AA' : '#71717A';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)';
  const chromeBg = isDark ? '#111113' : '#FFFFFF';
  const selectedBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(63,107,79,0.14)';
  const selectedFg = isDark ? '#7A9E86' : BRAND_COLORS.ink;
  const idleFg = isDark ? '#D4D4D8' : '#52525B';
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [DIALOG_ZOOM_FROM, 1] });

  if (!mounted) return null;

  const chipStyle = (selected: boolean) => [
    styles.toolbarChip,
    {
      borderColor: selected ? selectedFg : border,
      backgroundColor: selected ? selectedBg : chromeBg,
    },
  ];

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.flex} accessibilityViewIsModal>
          <Animated.View
            style={[
              styles.backdrop,
              overlayBlurStyle,
              { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(24,24,27,0.45)', opacity: progress },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel="Close" />
          </Animated.View>

          <View
            style={[styles.center, pointerEventsStyle('box-none')]}
            pointerEvents={pointerEventsProp('box-none')}
          >
            <Animated.View
              accessibilityViewIsModal
              accessibilityLabel="Support"
              style={[
                styles.modal,
                {
                  backgroundColor: paper,
                  borderColor: border,
                  opacity: progress,
                  transform: [{ scale }],
                },
              ]}
            >
              <Pressable
                onPress={handleClose}
                disabled={isSubmitting}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: pressed ? selectedBg : 'transparent' },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <X size={16} strokeWidth={ICON_STROKE} color={muted} />
              </Pressable>

              <View style={styles.header}>
                <Text style={[styles.title, { color: ink }]}>Support</Text>
                <Text style={[styles.description, { color: muted }]}>
                  Please explain in detail the feedback or issue you are having.
                </Text>
              </View>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} variant="compact" /> : null}

                <TextInput
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: isDark ? '#111113' : '#FAFAFA',
                      color: ink,
                      borderColor: focused ? BRAND_COLORS.ink : isDark ? 'rgba(255,255,255,0.1)' : '#D4D4D8',
                    },
                    focused
                      ? boxShadow('0 0 0 3px rgba(26,47,35,0.2)', {
                          shadowColor: BRAND_COLORS.ink,
                          shadowOpacity: 0.18,
                          shadowRadius: 3,
                          shadowOffset: { width: 0, height: 0 },
                        })
                      : null,
                  ]}
                  placeholder="Tell us what happened, what you expected, and any steps to reproduce…"
                  placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                  value={message}
                  onChangeText={setMessage}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  multiline
                  numberOfLines={5}
                  maxLength={MAX_MESSAGE_LENGTH}
                  editable={!isSubmitting}
                />
                <Text style={[styles.charCount, { color: muted }]}>
                  {trimmedLength}/{MAX_MESSAGE_LENGTH}
                </Text>

                <View style={styles.sentimentRow}>
                  <Pressable
                    onPress={() => setRating(5)}
                    disabled={isSubmitting}
                    style={({ pressed }) => [chipStyle(rating === 5), styles.sentimentButton, pressed && { opacity: 0.85 }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: rating === 5 }}
                    accessibilityLabel="Good"
                  >
                    <ThumbsUp size={16} strokeWidth={2} color={rating === 5 ? selectedFg : idleFg} />
                    <Text style={[styles.sentimentLabel, { color: rating === 5 ? selectedFg : ink }]}>Good</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setRating(1)}
                    disabled={isSubmitting}
                    style={({ pressed }) => [chipStyle(rating === 1), styles.sentimentButton, pressed && { opacity: 0.85 }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: rating === 1 }}
                    accessibilityLabel="Bad"
                  >
                    <ThumbsDown size={16} strokeWidth={2} color={rating === 1 ? selectedFg : idleFg} />
                    <Text style={[styles.sentimentLabel, { color: rating === 1 ? selectedFg : ink }]}>Bad</Text>
                  </Pressable>
                </View>

                <View style={styles.tagsWrap}>
                  {SUPPORT_FEEDBACK_CATEGORIES.map((category) => {
                    const selected = categories.includes(category);
                    return (
                      <Pressable
                        key={category}
                        onPress={() => toggleCategory(category)}
                        disabled={isSubmitting}
                        style={({ pressed }) => [chipStyle(selected), styles.tag, pressed && { opacity: 0.85 }]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={[styles.tagLabel, { color: selected ? selectedFg : idleFg }]}>{category}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                  style={({ pressed }) => [
                    styles.submitButton,
                    {
                      backgroundColor: BRAND_COLORS.ink,
                      opacity: canSubmit ? (pressed ? 0.92 : 1) : 0.5,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canSubmit }}
                >
                  <Text style={styles.submitButtonText}>{isSubmitting ? 'Submitting...' : 'Submit'}</Text>
                </Pressable>
              </ScrollView>
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 448,
    maxHeight: '88%',
    borderRadius: 16,
    borderWidth: 1,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 8,
    ...boxShadow(MODAL_ELEVATED_SHADOW, {
      shadowColor: BRAND_COLORS.ink,
      shadowOffset: { width: 0, height: 28 },
      shadowOpacity: 0.22,
      shadowRadius: 40,
      elevation: 16,
    }),
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  header: {
    gap: 6,
    paddingRight: 28,
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Fonts.ui.regular,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    gap: 16,
    paddingBottom: 16,
  },
  textArea: {
    minHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 22,
    fontFamily: Fonts.ui.regular,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  charCount: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
    marginTop: -8,
    fontFamily: Fonts.ui.regular,
  },
  sentimentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarChip: {
    borderWidth: 1,
    ...boxShadow(TOOLBAR_SHADOW, {
      shadowColor: BRAND_COLORS.ink,
      shadowOpacity: 0.04,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    }),
  },
  sentimentButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexDirection: 'row',
  },
  sentimentLabel: {
    fontSize: 14,
    fontFamily: Fonts.ui.medium,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagLabel: {
    fontSize: 12,
    fontFamily: Fonts.ui.medium,
  },
  submitButton: {
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontFamily: Fonts.ui.medium,
    color: '#FAFAFA',
  },
});

export default SupportFeedbackModal;
