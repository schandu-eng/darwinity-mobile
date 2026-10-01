import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types/navigation';
import { useSignup } from '@/api/queries/auth';
import { useOnboardingDraftStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { ACQUISITION_LABELS } from '@/utils/onboardingLabels';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import { useAuthStore } from '@/store';

import { Fonts } from '@/config/fonts';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'OnboardingSource'>;

const WelcomeSourceScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const enums = useOnboardingDraftStore((state) => state.enums);
  const draft = useOnboardingDraftStore((state) => state);
  const setAcquisition = useOnboardingDraftStore((state) => state.setAcquisition);
  const resetDraft = useOnboardingDraftStore((state) => state.reset);
  const signupMutation = useSignup();
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [error, setError] = useState('');

  const sources = useMemo(() => enums?.acquisitionSources || [], [enums]);

  const handleFinish = async () => {
    setError('');
    const trimmedCountry = (draft.country || '').trim();

    if (!draft.email || !draft.name || !draft.token) {
      setError('Missing signup information. Please go back and try again.');
      return;
    }

    if (!trimmedCountry) {
      setError('Please select your country.');
      return;
    }

    const result = await signupMutation.mutateAsync({
      email: draft.email,
      name: draft.name,
      phoneNo: draft.phoneNo || '',
      countryCode: draft.countryCode || '',
      country: trimmedCountry,
      token: draft.token,
      category: draft.category,
      undergraduateCourse: draft.undergraduateCourse,
      graduateProgram: draft.graduateProgram,
      graduateProgramOtherDesc: draft.graduateProgramOtherDesc,
      graduateCourse: draft.graduateCourse,
      middleSchoolInterest: draft.middleSchoolInterest,
      highSchoolInterest: draft.highSchoolInterest,
      professionalSector: draft.professionalSector,
      professionalSectorOtherDesc: draft.professionalSectorOtherDesc,
      otherBackgroundDesc: draft.otherBackgroundDesc,
      acquisitionSource: selectedSource || null,
      preferredLanguage: draft.preferredLanguage || undefined,
    });

    if (!result.success) {
      analytics.track(EVENTS.SIGNUP_FAILED, { method: 'email', reason: 'request_error' });
      setError(result.message || 'Signup failed. Please try again.');
      return;
    }

    const user = useAuthStore.getState().user;
    if (user?.id) {
      analytics.identify(String(user.id), {
        email: user.email || draft.email,
        $email: user.email || draft.email,
      });
    }
    analytics.track(EVENTS.SIGNUP_COMPLETED, { method: 'email', needs_onboarding: false });

    setAcquisition(selectedSource || null);
    resetDraft();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
            Where did you hear about us?
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Optional. You can skip this step.
          </Text>
        </View>

        <View style={styles.optionsContainer}>
          {sources.map((source) => {
            const isSelected = selectedSource === source;
            return (
              <TouchableOpacity
                key={source}
                style={[
                  styles.optionCard,
                  {
                    borderColor: isSelected ? theme.colors.primary : theme.colors.outlineVariant,
                    backgroundColor: isSelected
                      ? theme.colors.primaryContainer
                      : theme.colors.surface,
                  },
                ]}
                onPress={() => setSelectedSource(isSelected ? '' : source)}
                activeOpacity={0.8}
              >
                <Text
                  variant="titleSmall"
                  style={{
                    color: isSelected
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.onSurface,
                    fontWeight: isSelected ? '600' : '500',
                    fontFamily: Fonts.ui.regular,
                  }}
                >
                  {ACQUISITION_LABELS[source] || source}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? <ErrorBanner message={error} variant="compact" onDismiss={() => setError('')} /> : null}

        <TouchableOpacity
          style={[
            styles.finishButton,
            { backgroundColor: signupMutation.isPending ? theme.colors.surfaceVariant : theme.colors.primary },
          ]}
          onPress={handleFinish}
          disabled={signupMutation.isPending}
          activeOpacity={0.8}
        >
          {signupMutation.isPending ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.onSurfaceVariant} />
              <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Creating account...
              </Text>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              <Text variant="titleMedium" style={{ color: '#FFFFFF', fontFamily: Fonts.ui.semiBold }}>
                Finish Sign Up
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    gap: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: Fonts.ui.bold,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    fontFamily: Fonts.ui.regular,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  finishButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});

export default WelcomeSourceScreen;
