import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types/navigation';
import { onboardingEndpoints } from '@/api/endpoints/onboarding';
import { useOnboardingDraftStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { CATEGORY_LABELS } from '@/utils/onboardingLabels';

import { Fonts } from '@/config/fonts';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'OnboardingIdentity'>;

type IdentityContentProps = {
  onContinue?: () => void;
  onBack?: () => void;
};

export const OnboardingIdentityContent: React.FC<IdentityContentProps> = ({ onContinue, onBack }) => {
  const navigation = useNavigation<NavigationProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const { width } = useWindowDimensions();
  const category = useOnboardingDraftStore((state) => state.category);
  const setCategory = useOnboardingDraftStore((state) => state.setCategory);
  const enums = useOnboardingDraftStore((state) => state.enums);
  const setEnums = useOnboardingDraftStore((state) => state.setEnums);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = useMemo(() => enums?.onboardingCategories || [], [enums]);
  const isWide = width >= 600;

  const getCategoryIcon = (value: string) => {
    switch (value) {
      case 'UNDERGRADUATE':
        return 'book-open-page-variant';
      case 'GRADUATE':
        return 'school';
      case 'MIDDLE_SCHOOL':
        return 'account-school';
      case 'HIGH_SCHOOL':
        return 'school-outline';
      case 'WORKING_PROFESSIONAL':
        return 'briefcase-variant';
      case 'OTHERS':
      default:
        return 'star-four-points';
    }
  };

  useEffect(() => {
    if (enums || isLoading) return;
    const fetchEnums = async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await onboardingEndpoints.fetchEnums();
        setEnums(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load options. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchEnums();
  }, [enums, isLoading, setEnums]);

  const handleContinue = useCallback(() => {
    if (!category) {
      setError('Please select an option to continue.');
      return;
    }
    if (onContinue) {
      onContinue();
      return;
    }
    navigation.navigate('OnboardingDetails');
  }, [category, navigation, onContinue]);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    navigation.goBack();
  }, [navigation, onBack]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
            Which of these describes you best?
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Choose the option that best fits your current stage.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text variant="bodyMedium" style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
              Loading options...
            </Text>
          </View>
        ) : (
          <View style={styles.optionsContainer}>
            {categories.map((item) => {
              const isSelected = category === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[
                    styles.optionCard,
                    { width: isWide ? '48%' : '100%' },
                    {
                      borderColor: isSelected ? theme.colors.primary : theme.colors.outlineVariant,
                      backgroundColor: isSelected
                        ? theme.colors.primaryContainer
                        : theme.colors.surface,
                    },
                  ]}
                  onPress={() => {
                    setCategory(item);
                    if (error) setError('');
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.optionIcon,
                      {
                        backgroundColor: isSelected
                          ? theme.colors.primary
                          : theme.colors.surfaceVariant,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={getCategoryIcon(item)}
                      size={18}
                      color={isSelected ? '#FFFFFF' : theme.colors.onSurfaceVariant}
                    />
                  </View>
                  <Text
                    variant="titleSmall"
                    style={{
                      color: isSelected
                        ? theme.colors.onPrimaryContainer
                        : theme.colors.onSurface,
                      fontWeight: isSelected ? '600' : '500',
                      fontFamily: Fonts.ui.regular,
                      flex: 1,
                    }}
                  >
                    {CATEGORY_LABELS[item] || item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {error ? <ErrorBanner message={error} variant="compact" onDismiss={() => setError('')} /> : null}

        <TouchableOpacity
          style={[
            styles.continueButton,
            {
              backgroundColor: category ? theme.colors.primary : theme.colors.surfaceVariant,
            },
          ]}
          onPress={handleContinue}
          disabled={!category}
          activeOpacity={0.8}
        >
          <Text
            variant="titleMedium"
            style={{ color: category ? '#FFFFFF' : theme.colors.onSurfaceVariant, fontFamily: Fonts.ui.semiBold }}
          >
            Continue
          </Text>
          {category ? (
            <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
          ) : null}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const WelcomeIdentityScreen: React.FC = () => {
  return <OnboardingIdentityContent />;
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  loadingText: {
    textAlign: 'center',
    fontFamily: Fonts.ui.regular,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
});

export default WelcomeIdentityScreen;
