import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Image } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types/navigation';
import { authEndpoints } from '@/api/endpoints/auth';
import { useOnboardingDraftStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { flagUrlForLanguageCode } from '@/utils/flagCdn';

import { Fonts } from '@/config/fonts';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'OnboardingLanguage'>;

type Language = {
  code: string;
  name: string;
};

const WelcomeLanguageScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const preferredLanguage = useOnboardingDraftStore((state) => state.preferredLanguage);
  const setDetails = useOnboardingDraftStore((state) => state.setDetails);

  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCode, setSelectedCode] = useState(preferredLanguage || 'en');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadLanguages = async () => {
      setLoading(true);
      setError('');
      try {
        const list = await authEndpoints.getSupportedLanguages();
        setLanguages(Array.isArray(list) ? list : []);
      } catch {
        setError('Failed to load languages. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    loadLanguages();
  }, []);

  useEffect(() => {
    setSelectedCode(preferredLanguage || 'en');
  }, [preferredLanguage]);

  const filteredLanguages = useMemo(() => {
    if (!search.trim()) return languages;
    const q = search.trim().toLowerCase();
    return languages.filter(
      (lang) => lang.name.toLowerCase().includes(q) || lang.code.toLowerCase().includes(q)
    );
  }, [languages, search]);

  const handleContinue = () => {
    if (!selectedCode) {
      setError('Please select a language to continue.');
      return;
    }
    setDetails({ preferredLanguage: selectedCode });
    navigation.navigate('OnboardingCountry');
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
            Choose your language
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            This setting applies to notes, quizzes, flashcards, and chat, and does not change the app&apos;s interface language.
          </Text>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search language..."
          mode="outlined"
          style={styles.searchInput}
          contentStyle={styles.searchContent}
          outlineStyle={styles.searchOutline}
          activeOutlineColor={theme.colors.primary}
          outlineColor={theme.colors.outlineVariant}
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Loading languages...
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredLanguages.map((lang) => {
              const isSelected = lang.code === selectedCode;
              const flagUrl = flagUrlForLanguageCode(lang.code);
              return (
                <TouchableOpacity
                  key={lang.code}
                  onPress={() => {
                    setSelectedCode(lang.code);
                    setDetails({ preferredLanguage: lang.code });
                    if (error) setError('');
                  }}
                  style={[
                    styles.listItem,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: isSelected ? theme.colors.primary : theme.colors.outlineVariant,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  {flagUrl ? (
                    <Image source={{ uri: flagUrl }} style={styles.flagImage} />
                  ) : (
                    <MaterialCommunityIcons
                      name="earth"
                      size={22}
                      color={isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant}
                    />
                  )}
                  <Text
                    style={[
                      styles.listItemText,
                      {
                        color: isSelected ? theme.colors.primary : theme.colors.onSurface,
                        fontWeight: isSelected ? '600' : '400',
                        fontFamily: Fonts.ui.regular,
                      },
                    ]}
                  >
                    {lang.name}
                  </Text>
                  {isSelected ? (
                    <MaterialCommunityIcons name="check" size={22} color={theme.colors.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
            {!filteredLanguages.length && (
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                No languages found.
              </Text>
            )}
          </View>
        )}

        {error ? <ErrorBanner message={error} variant="compact" onDismiss={() => setError('')} /> : null}

        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <Text variant="titleMedium" style={{ color: '#FFFFFF', fontFamily: Fonts.ui.semiBold }}>
            Continue
          </Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
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
    gap: 20,
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
  searchInput: {
    backgroundColor: 'transparent',
  },
  searchContent: {
    paddingVertical: 8,
  },
  searchOutline: {
    borderRadius: 12,
  },
  listContainer: {
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.ui.regular,
  },
  flagImage: {
    width: 22,
    height: 16,
    borderRadius: 2,
    marginRight: 10,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 12,
    fontFamily: Fonts.ui.regular,
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 40,
  },
});

export default WelcomeLanguageScreen;
