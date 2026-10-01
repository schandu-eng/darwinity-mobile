import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, KeyboardAvoidingView, useWindowDimensions } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types/navigation';
import { onboardingEndpoints } from '@/api/endpoints/onboarding';
import { authEndpoints } from '@/api/endpoints/auth';
import { useAuthStore, useOnboardingDraftStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { CATEGORY_LABELS, GRADUATE_PROGRAM_LABELS, SECTOR_LABELS } from '@/utils/onboardingLabels';

import { Fonts } from '@/config/fonts';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'OnboardingDetails'>;

type DetailsContentProps = {
  preferencesMode?: boolean;
  onComplete?: () => void;
  onBack?: () => void;
};

export const OnboardingDetailsContent: React.FC<DetailsContentProps> = ({
  preferencesMode,
  onComplete,
  onBack,
}) => {
  const navigation = useNavigation<NavigationProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const { height: screenHeight } = useWindowDimensions();
  const category = useOnboardingDraftStore((state) => state.category);
  const draft = useOnboardingDraftStore((state) => state);
  const enums = useOnboardingDraftStore((state) => state.enums);
  const setDetails = useOnboardingDraftStore((state) => state.setDetails);
  const { user, setUser } = useAuthStore();

  const [undergraduateCourse, setUndergraduateCourse] = useState(draft.undergraduateCourse || '');
  const [graduateProgram, setGraduateProgram] = useState(draft.graduateProgram || '');
  const [graduateProgramOtherDesc, setGraduateProgramOtherDesc] = useState(draft.graduateProgramOtherDesc || '');
  const [graduateCourse, setGraduateCourse] = useState(draft.graduateCourse || '');
  const [middleSchoolInterest, setMiddleSchoolInterest] = useState(draft.middleSchoolInterest || '');
  const [highSchoolInterest, setHighSchoolInterest] = useState(draft.highSchoolInterest || '');
  const [professionalSector, setProfessionalSector] = useState(draft.professionalSector || '');
  const [professionalSectorOtherDesc, setProfessionalSectorOtherDesc] = useState(draft.professionalSectorOtherDesc || '');
  const [otherBackgroundDesc, setOtherBackgroundDesc] = useState(draft.otherBackgroundDesc || '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sectorSearch, setSectorSearch] = useState('');

  const graduatePrograms = useMemo(() => enums?.graduateProgramTypes || [], [enums]);
  const professionalSectors = useMemo(() => enums?.professionalSectors || [], [enums]);
  const optionListMaxHeight = Math.min(360, Math.max(220, screenHeight * 0.35));

  const filteredSectors = useMemo(() => {
    const query = sectorSearch.trim().toLowerCase();
    if (!query) return professionalSectors;
    return professionalSectors.filter((sector) => {
      const label = SECTOR_LABELS[sector] || sector;
      return label.toLowerCase().includes(query) || sector.toLowerCase().includes(query);
    });
  }, [professionalSectors, sectorSearch]);

  const getGraduateIcon = (value: string) => {
    switch (value) {
      case 'PROFESSIONAL_DEGREE':
        return 'scale-balance';
      case 'MASTERS_PROGRAM':
        return 'school';
      case 'PHD_RESEARCH':
        return 'flask-outline';
      case 'OTHERS':
      default:
        return 'star-four-points';
    }
  };

  const getSectorIcon = (value: string) => {
    switch (value) {
      case 'HEALTHCARE_MEDICAL':
        return 'heart-pulse';
      case 'ENGINEERING_TECHNOLOGY':
        return 'cog-outline';
      case 'EDUCATION_TRAINING':
        return 'school-outline';
      case 'INDUSTRIAL_MANUFACTURING':
        return 'factory';
      case 'BUSINESS_FINANCE':
        return 'briefcase-outline';
      case 'LEGAL':
        return 'scale-balance';
      case 'ARTS_DESIGN':
        return 'palette-outline';
      case 'INFORMATION_TECHNOLOGY':
        return 'laptop';
      case 'CONSTRUCTION_PROPERTY':
        return 'home-city-outline';
      case 'SCIENCE_RESEARCH':
        return 'flask-outline';
      case 'HOSPITALITY_TOURISM':
        return 'silverware-fork-knife';
      case 'GOVERNMENT_PUBLIC_SECTOR':
        return 'bank-outline';
      case 'RETAIL_SALES':
        return 'shopping-outline';
      case 'AGRICULTURE_ENVIRONMENT':
        return 'leaf';
      case 'TRANSPORTATION_LOGISTICS':
        return 'truck-outline';
      case 'MEDIA_COMMUNICATIONS':
        return 'bullhorn-outline';
      case 'OTHERS':
      default:
        return 'star-four-points';
    }
  };

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    navigation.goBack();
  }, [navigation, onBack]);

  const validate = () => {
    switch (category) {
      case 'UNDERGRADUATE':
        if (!undergraduateCourse.trim() || undergraduateCourse.trim().length < 2) {
          setError('Please enter your course (at least 2 characters).');
          return false;
        }
        if (undergraduateCourse.trim().length > 80) {
          setError('Course name must be 80 characters or less.');
          return false;
        }
        return true;
      case 'GRADUATE':
        if (!graduateProgram) {
          setError('Please select your graduate program type.');
          return false;
        }
        if (graduateProgram === 'OTHERS' && graduateProgramOtherDesc.trim().length < 5) {
          setError('Please describe your background (at least 5 characters).');
          return false;
        }
        if (graduateProgram === 'OTHERS' && graduateProgramOtherDesc.trim().length > 80) {
          setError('Description must be 80 characters or less.');
          return false;
        }
        if (!graduateCourse.trim() || graduateCourse.trim().length < 2) {
          setError('Please enter your course or specialization.');
          return false;
        }
        if (graduateCourse.trim().length > 80) {
          setError('Course must be 80 characters or less.');
          return false;
        }
        return true;
      case 'MIDDLE_SCHOOL':
        if (!middleSchoolInterest.trim() || middleSchoolInterest.trim().length < 2) {
          setError('Please enter your area of interest.');
          return false;
        }
        if (middleSchoolInterest.trim().length > 60) {
          setError('Interest must be 60 characters or less.');
          return false;
        }
        return true;
      case 'HIGH_SCHOOL':
        if (!highSchoolInterest.trim() || highSchoolInterest.trim().length < 2) {
          setError('Please enter your area of study or interest.');
          return false;
        }
        if (highSchoolInterest.trim().length > 60) {
          setError('Interest must be 60 characters or less.');
          return false;
        }
        return true;
      case 'WORKING_PROFESSIONAL':
        if (professionalSector === 'OTHERS' && professionalSectorOtherDesc.trim().length < 2) {
          setError('Please describe your background.');
          return false;
        }
        if (professionalSectorOtherDesc.trim().length > 80) {
          setError('Description must be 80 characters or less.');
          return false;
        }
        return true;
      case 'OTHERS':
        if (!otherBackgroundDesc.trim() || otherBackgroundDesc.trim().length < 5) {
          setError('Please describe your background (at least 5 characters).');
          return false;
        }
        if (otherBackgroundDesc.trim().length > 80) {
          setError('Description must be 80 characters or less.');
          return false;
        }
        return true;
      default:
        setError('Invalid category. Please go back and select again.');
        return false;
    }
  };

  const persistDetails = () => {
    setDetails({
      undergraduateCourse: undergraduateCourse.trim() || null,
      graduateProgram: graduateProgram || null,
      graduateProgramOtherDesc: graduateProgram === 'OTHERS' ? graduateProgramOtherDesc.trim() : null,
      graduateCourse: graduateCourse.trim() || null,
      middleSchoolInterest: middleSchoolInterest.trim() || null,
      highSchoolInterest: highSchoolInterest.trim() || null,
      professionalSector: professionalSector || null,
      professionalSectorOtherDesc: professionalSector === 'OTHERS' ? professionalSectorOtherDesc.trim() : null,
      otherBackgroundDesc: otherBackgroundDesc.trim() || null,
    });
  };

  const handleContinue = async () => {
    setError('');
    if (!validate()) return;

    persistDetails();

    if (preferencesMode) {
      if (!user?.email || !user?.name) {
        setError('User information missing. Please log in again.');
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await onboardingEndpoints.completeOnboarding({
          name: user.name,
          email: user.email,
          phoneNo: user.phoneNo || '',
          countryCode: user.countryCode || '',
          country: user.country || '',
          category: category || '',
          undergraduateCourse: undergraduateCourse.trim() || null,
          graduateProgram: graduateProgram || null,
          graduateProgramOtherDesc:
            graduateProgram === 'OTHERS' ? graduateProgramOtherDesc.trim() : null,
          graduateCourse: graduateCourse.trim() || null,
          middleSchoolInterest: middleSchoolInterest.trim() || null,
          highSchoolInterest: highSchoolInterest.trim() || null,
          professionalSector: professionalSector || null,
          professionalSectorOtherDesc:
            professionalSector === 'OTHERS' ? professionalSectorOtherDesc.trim() : null,
          otherBackgroundDesc: otherBackgroundDesc.trim() || null,
          acquisitionSource: null,
        });

        if (!response.status) {
          setError(response.message || 'Failed to save preferences. Please try again.');
          return;
        }

        if (response.userId) {
          try {
            const profile = await authEndpoints.getMemberProfile(response.userId);
            await setUser({
              id: profile.id,
              email: profile.email,
              name: profile.name || '',
              phoneNo: profile.phoneNo,
              country: profile.country,
              countryCode: profile.countryCode,
              category: profile.category,
              undergraduateCourse: profile.undergraduateCourse,
              graduateProgram: profile.graduateProgram,
              graduateProgramOtherDesc: profile.graduateProgramOtherDesc,
              graduateCourse: profile.graduateCourse,
              middleSchoolInterest: profile.middleSchoolInterest,
              highSchoolInterest: profile.highSchoolInterest,
              professionalSector: profile.professionalSector,
              professionalSectorOtherDesc: profile.professionalSectorOtherDesc,
              otherBackgroundDesc: profile.otherBackgroundDesc,
              acquisitionSource: profile.acquisitionSource,
            });
          } catch {

          }
        }

        if (onComplete) {
          onComplete();
        }
      } catch (err: any) {
        setError(err?.message || 'Something went wrong. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    navigation.navigate('OnboardingLanguage');
  };

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    maxLength?: number
  ) => (
    <View style={styles.inputBlock}>
      <Text variant="labelLarge" style={[styles.inputLabel, { color: theme.colors.onSurface }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          if (error) setError('');
        }}
        mode="outlined"
        placeholder={placeholder}
        maxLength={maxLength}
        style={styles.input}
        contentStyle={styles.inputContent}
        outlineStyle={styles.inputOutline}
        activeOutlineColor={theme.colors.primary}
        outlineColor={theme.colors.outline}
      />
    </View>
  );

  const renderCategoryFields = () => {
    switch (category) {
      case 'UNDERGRADUATE':
        return renderInput('Course', undergraduateCourse, setUndergraduateCourse, 'e.g., B.Tech Computer Science', 80);
      case 'GRADUATE':
        return (
          <>
            <View style={styles.inputBlock}>
              <Text variant="labelLarge" style={[styles.inputLabel, { color: theme.colors.onSurface }]}>
                Program Type
              </Text>
              <View style={styles.optionList}>
                {graduatePrograms.map((item) => {
                  const isSelected = graduateProgram === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.optionCard,
                        {
                          borderColor: isSelected ? theme.colors.primary : theme.colors.outlineVariant,
                          backgroundColor: isSelected
                            ? theme.colors.primaryContainer
                            : theme.colors.surface,
                        },
                      ]}
                      onPress={() => {
                        setGraduateProgram(item);
                        if (item !== 'OTHERS') setGraduateProgramOtherDesc('');
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
                          name={getGraduateIcon(item)}
                          size={20}
                          color={isSelected ? '#FFFFFF' : theme.colors.onSurfaceVariant}
                        />
                      </View>
                      <Text
                        style={[
                          styles.optionText,
                          {
                            color: isSelected
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onSurface,
                            fontWeight: isSelected ? '600' : '500',
                            fontFamily: Fonts.ui.regular,
                          },
                        ]}
                      >
                        {GRADUATE_PROGRAM_LABELS[item] || item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {graduateProgram === 'OTHERS' &&
              renderInput('Program Details', graduateProgramOtherDesc, setGraduateProgramOtherDesc, 'Describe your program', 80)}

            {renderInput('Specialization', graduateCourse, setGraduateCourse, 'Enter your course or specialization', 80)}
          </>
        );
      case 'MIDDLE_SCHOOL':
        return renderInput('Interest', middleSchoolInterest, setMiddleSchoolInterest, 'Area of interest', 60);
      case 'HIGH_SCHOOL':
        return renderInput('Interest', highSchoolInterest, setHighSchoolInterest, 'Area of study or interest', 60);
      case 'WORKING_PROFESSIONAL':
        return (
          <>
            <View style={styles.inputBlock}>
              <Text variant="labelLarge" style={[styles.inputLabel, { color: theme.colors.onSurface }]}>
                Sector
              </Text>
              <TextInput
                value={sectorSearch}
                onChangeText={setSectorSearch}
                placeholder="Search sector..."
                mode="outlined"
                style={styles.searchInput}
                contentStyle={styles.searchContent}
                outlineStyle={styles.searchOutline}
                activeOutlineColor={theme.colors.primary}
                outlineColor={theme.colors.outlineVariant}
                placeholderTextColor={theme.colors.onSurfaceVariant}
              />
              <ScrollView
                style={[styles.optionScroll, { maxHeight: optionListMaxHeight }]}
                contentContainerStyle={styles.optionList}
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
              >
                {filteredSectors.map((item) => {
                  const isSelected = professionalSector === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.optionCard,
                        {
                          borderColor: isSelected ? theme.colors.primary : theme.colors.outlineVariant,
                          backgroundColor: isSelected
                            ? theme.colors.primaryContainer
                            : theme.colors.surface,
                        },
                      ]}
                      onPress={() => {
                        setProfessionalSector(item);
                        if (item !== 'OTHERS') setProfessionalSectorOtherDesc('');
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
                          name={getSectorIcon(item)}
                          size={20}
                          color={isSelected ? '#FFFFFF' : theme.colors.onSurfaceVariant}
                        />
                      </View>
                      <Text
                        style={[
                          styles.optionText,
                          {
                            color: isSelected
                              ? theme.colors.onPrimaryContainer
                              : theme.colors.onSurface,
                            fontWeight: isSelected ? '600' : '500',
                            fontFamily: Fonts.ui.regular,
                          },
                        ]}
                      >
                        {SECTOR_LABELS[item] || item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                {!filteredSectors.length ? (
                  <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                    No sectors found.
                  </Text>
                ) : null}
              </ScrollView>
            </View>
            {professionalSector === 'OTHERS' &&
              renderInput('Sector Details', professionalSectorOtherDesc, setProfessionalSectorOtherDesc, 'Describe your background', 80)}
          </>
        );
      case 'OTHERS':
        return renderInput('Background', otherBackgroundDesc, setOtherBackgroundDesc, 'Briefly describe your background', 80);
      default:
        return (
          <Text style={{ color: theme.colors.onSurfaceVariant }}>
            Please go back and select a category.
          </Text>
        );
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
            {CATEGORY_LABELS[category] || 'About you'}
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Tell us a bit more so we can personalize your experience.
          </Text>
        </View>

        <View style={styles.formSection}>{renderCategoryFields()}</View>

        {error ? <ErrorBanner message={error} variant="compact" onDismiss={() => setError('')} /> : null}

        <TouchableOpacity
          style={[
            styles.continueButton,
            { backgroundColor: isSubmitting ? theme.colors.surfaceVariant : theme.colors.primary },
          ]}
          onPress={handleContinue}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.colors.onSurfaceVariant} />
              <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Saving...
              </Text>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              <Text variant="titleMedium" style={{ color: '#FFFFFF', fontFamily: Fonts.ui.semiBold }}>
                Continue
              </Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
};

const WelcomeDetailsScreen: React.FC = () => {
  return <OnboardingDetailsContent />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
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
  formSection: {
    gap: 16,
  },
  inputBlock: {
    gap: 8,
  },
  inputLabel: {
    fontFamily: Fonts.ui.semiBold,
  },
  input: {
    backgroundColor: 'transparent',
  },
  inputContent: {
    paddingVertical: 6,
  },
  inputOutline: {
    borderRadius: 12,
  },
  optionList: {
    gap: 12,
  },
  optionCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.ui.medium,
  },
  optionScroll: {
    marginTop: 8,
  },
  searchInput: {
    backgroundColor: 'transparent',
    marginTop: 8,
  },
  searchContent: {
    paddingVertical: 6,
  },
  searchOutline: {
    borderRadius: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 12,
    fontFamily: Fonts.ui.regular,
  },
  continueButton: {
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

export default WelcomeDetailsScreen;
