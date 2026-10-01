import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert } from 'react-native';
import { Text, Surface, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore, useOnboardingDraftStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { ProfileStackParamList } from '@/types/navigation';
import { CATEGORY_LABELS, GRADUATE_PROGRAM_LABELS, SECTOR_LABELS } from '@/utils/onboardingLabels';
import { OnboardingIdentityContent } from '@/screens/auth/WelcomeIdentityScreen';
import { OnboardingDetailsContent } from '@/screens/auth/WelcomeDetailsScreen';
import ExportSuccessModal from '@/components/content/ExportSuccessModal';

import { Fonts } from '@/config/fonts';

type MemberProfileScreenNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

const MemberProfileScreen: React.FC = () => {
  const navigation = useNavigation<MemberProfileScreenNavigationProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((state) => state.user);
  const resetDraft = useOnboardingDraftStore((state) => state.reset);
  const setPersonalInfo = useOnboardingDraftStore((state) => state.setPersonalInfo);
  const [preferencesVisible, setPreferencesVisible] = useState(false);
  const [preferencesStep, setPreferencesStep] = useState<'identity' | 'details'>('identity');
  const [preferencesSavedVisible, setPreferencesSavedVisible] = useState(false);

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="account-circle" size={64} color={theme.colors.onSurfaceVariant} />
          <Text variant="titleMedium" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
            No User Information
          </Text>
          <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            Please login to view your profile
          </Text>
        </View>
      </View>
    );
  }

  const hasValue = (value?: string | null) => {
    return value !== null && value !== undefined && String(value).trim().length > 0;
  };

  const preferenceItems = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];
    const category = user.category;

    if (hasValue(category)) {
      items.push({ label: 'Category', value: CATEGORY_LABELS[category as string] || (category as string) });
    }

    if (category === 'UNDERGRADUATE' && hasValue(user.undergraduateCourse)) {
      items.push({ label: 'Course', value: user.undergraduateCourse as string });
    }

    if (category === 'GRADUATE') {
      if (hasValue(user.graduateProgram)) {
        items.push({
          label: 'Program Type',
          value: GRADUATE_PROGRAM_LABELS[user.graduateProgram as string] || (user.graduateProgram as string),
        });
      }
      if (hasValue(user.graduateProgramOtherDesc)) {
        items.push({ label: 'Program Details', value: user.graduateProgramOtherDesc as string });
      }
      if (hasValue(user.graduateCourse)) {
        items.push({ label: 'Specialization', value: user.graduateCourse as string });
      }
    }

    if (category === 'MIDDLE_SCHOOL' && hasValue(user.middleSchoolInterest)) {
      items.push({ label: 'Interest', value: user.middleSchoolInterest as string });
    }

    if (category === 'HIGH_SCHOOL' && hasValue(user.highSchoolInterest)) {
      items.push({ label: 'Interest', value: user.highSchoolInterest as string });
    }

    if (category === 'WORKING_PROFESSIONAL') {
      if (hasValue(user.professionalSector)) {
        items.push({
          label: 'Sector',
          value: SECTOR_LABELS[user.professionalSector as string] || (user.professionalSector as string),
        });
      }
      if (hasValue(user.professionalSectorOtherDesc)) {
        items.push({ label: 'Sector Details', value: user.professionalSectorOtherDesc as string });
      }
    }

    if (category === 'OTHERS' && hasValue(user.otherBackgroundDesc)) {
      items.push({ label: 'Background', value: user.otherBackgroundDesc as string });
    }

    return items;
  }, [user]);

  const handleOpenPreferences = () => {
    if (!user?.email || !user?.name) {
      Alert.alert('Missing Details', 'Please make sure your profile has name and email.');
      return;
    }
    resetDraft();
    setPersonalInfo({
      email: user.email,
      name: user.name,
      phoneNo: user.phoneNo,
      countryCode: user.countryCode,
      country: user.country,
    });
    setPreferencesStep('identity');
    setPreferencesVisible(true);
  };

  const handleClosePreferences = () => {
    setPreferencesVisible(false);
  };

  const handlePreferencesSaved = () => {
    setPreferencesVisible(false);
    setPreferencesSavedVisible(true);
  };

  const renderPreferencesStep = () => {
    if (preferencesStep === 'identity') {
      return (
        <OnboardingIdentityContent
          onContinue={() => setPreferencesStep('details')}
          onBack={handleClosePreferences}
        />
      );
    }
    return (
      <OnboardingDetailsContent
        preferencesMode
        onComplete={handlePreferencesSaved}
        onBack={() => setPreferencesStep('identity')}
      />
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="account-circle" size={64} color={theme.colors.primary} />
            <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>
              Account Information
            </Text>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <MaterialCommunityIcons
                  name="account"
                  size={20}
                  color={theme.colors.primary}
                  style={styles.icon}
                />
                <Text variant="bodyMedium" style={[styles.label, { color: theme.colors.onSurface }]}>
                  Name:
                </Text>
              </View>
              <View style={[styles.infoValue, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text variant="bodyMedium" style={[styles.value, { color: theme.colors.onSurface }]}>
                  {user.name}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoLabel}>
                <MaterialCommunityIcons
                  name="email"
                  size={20}
                  color={theme.colors.primary}
                  style={styles.icon}
                />
                <Text variant="bodyMedium" style={[styles.label, { color: theme.colors.onSurface }]}>
                  Email:
                </Text>
              </View>
              <View style={[styles.infoValue, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text variant="bodyMedium" style={[styles.value, { color: theme.colors.onSurface }]}>
                  {user.email}
                </Text>
              </View>
            </View>

            {user.phoneNo && (
              <View style={styles.infoRow}>
                <View style={styles.infoLabel}>
                  <MaterialCommunityIcons
                    name="phone"
                    size={20}
                    color={theme.colors.primary}
                    style={styles.icon}
                  />
                  <Text variant="bodyMedium" style={[styles.label, { color: theme.colors.onSurface }]}>
                    Contact:
                  </Text>
                </View>
                <View style={styles.contactRow}>
                  {user.countryCode ? (
                    <View style={[styles.codeChip, { backgroundColor: theme.colors.surfaceVariant }]}>
                      <Text variant="bodyMedium" style={[styles.codeText, { color: theme.colors.onSurface }]}>
                        {user.countryCode}
                      </Text>
                    </View>
                  ) : null}
                  <View style={[styles.infoValue, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Text variant="bodyMedium" style={[styles.value, { color: theme.colors.onSurface }]}>
                      {user.phoneNo}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          <Divider style={styles.divider} />

          <View style={styles.preferencesHeader}>
            <Text variant="titleMedium" style={[styles.preferencesTitle, { color: theme.colors.onSurface }]}>
              Preferences
            </Text>
            <TouchableOpacity
              style={[styles.preferencesButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleOpenPreferences}
              activeOpacity={0.8}
            >
              <Text variant="bodyMedium" style={styles.preferencesButtonText}>
                Change Preferences
              </Text>
            </TouchableOpacity>
          </View>

          {preferenceItems.length > 0 ? (
            <View style={styles.preferencesList}>
              {preferenceItems.map((item) => (
                <View key={item.label} style={styles.preferenceItem}>
                  <Text variant="bodySmall" style={[styles.preferenceLabel, { color: theme.colors.onSurfaceVariant }]}>
                    {item.label}
                  </Text>
                  <View style={[styles.preferenceValue, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                      {item.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text variant="bodySmall" style={[styles.emptyPreferences, { color: theme.colors.onSurfaceVariant }]}>
              No preferences saved yet.
            </Text>
          )}
        </Surface>

        <Surface style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.settingsButton}
          >
            <View style={styles.settingsButtonContent}>
              <MaterialCommunityIcons name="cog" size={24} color={theme.colors.primary} />
              <Text variant="bodyLarge" style={[styles.settingsButtonText, { color: theme.colors.onSurface }]}>
                Settings
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
            </View>
          </TouchableOpacity>
        </Surface>
      </View>
      <Modal visible={preferencesVisible} animationType="slide" onRequestClose={handleClosePreferences}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          {renderPreferencesStep()}
        </View>
      </Modal>
      <ExportSuccessModal
        visible={preferencesSavedVisible}
        title="Preferences Saved"
        message="Preferences saved successfully"
        onClose={() => setPreferencesSavedVisible(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: Fonts.ui.semiBold,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  card: {
    borderRadius: 12,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  title: {
    fontFamily: Fonts.ui.bold,
  },
  divider: {
    marginBottom: 20,
  },
  infoSection: {
    gap: 16,
  },
  infoRow: {
    gap: 8,
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontFamily: Fonts.ui.semiBold,
  },
  infoValue: {
    padding: 12,
    borderRadius: 8,
    marginLeft: 32,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 32,
    flexWrap: 'wrap',
  },
  codeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  codeText: {
    fontFamily: Fonts.ui.medium,
  },
  value: {
    fontFamily: Fonts.ui.regular,
  },
  preferencesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
  },
  preferencesTitle: {
    fontFamily: Fonts.ui.bold,
  },
  preferencesButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  preferencesButtonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.ui.semiBold,
  },
  preferencesList: {
    gap: 12,
  },
  preferenceItem: {
    gap: 6,
  },
  preferenceLabel: {
    fontFamily: Fonts.ui.semiBold,
  },
  preferenceValue: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyPreferences: {
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
  },
  settingsButton: {
    padding: 16,
  },
  settingsButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsButtonText: {
    flex: 1,
    fontFamily: Fonts.ui.medium,
  },
});

export default MemberProfileScreen;
