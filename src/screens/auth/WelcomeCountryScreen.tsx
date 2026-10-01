import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform, Image } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types/navigation';
import { useOnboardingDraftStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { countryCodes } from '@/utils/countryCodes';
import { flagUrlFromCountryCode } from '@/utils/flagCdn';

import { Fonts } from '@/config/fonts';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'OnboardingCountry'>;

const WelcomeCountryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const savedCountry = useOnboardingDraftStore((state) => state.country) || '';
  const setDetails = useOnboardingDraftStore((state) => state.setDetails);

  const [selectedCountry, setSelectedCountry] = useState(savedCountry);
  const [query, setQuery] = useState(savedCountry);
  const [error, setError] = useState('');

  const countries = useMemo(
    () => countryCodes.map((item) => ({ name: item.name, code: item.code })),
    []
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return countries
      .filter((item) => item.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [countries, query]);

  const handleSelect = (country: string) => {
    setSelectedCountry(country);
    setQuery(country);
    setDetails({ country });
    if (error) setError('');
  };

  const handleContinue = () => {
    const trimmed = selectedCountry.trim() || query.trim();
    const exact = countries.find((item) => item.name.toLowerCase() === trimmed.toLowerCase());
    if (!exact) {
      setError(trimmed ? 'Pick a country from the suggestions.' : 'Please select your country.');
      return;
    }
    setDetails({ country: exact.name });
    navigation.navigate('OnboardingSource');
  };

  const selectedFlagUrl = flagUrlFromCountryCode(
    countries.find((item) => item.name === selectedCountry)?.code
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
            Select your country
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Type to find the country you currently reside in.
          </Text>
        </View>

        <View style={styles.inputBlock}>
          <Text variant="labelLarge" style={[styles.inputLabel, { color: theme.colors.onSurface }]}>
            Country
          </Text>
          <View style={[styles.inputWrap, { borderColor: theme.colors.outline }]}>
            {selectedCountry && selectedFlagUrl ? (
              <Image source={{ uri: selectedFlagUrl }} style={[styles.flagImage, styles.flagMargin]} />
            ) : null}
            <TextInput
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (selectedCountry && text !== selectedCountry) {
                  setSelectedCountry('');
                }
                if (error) setError('');
              }}
              placeholder="Start typing a country…"
              mode="flat"
              style={styles.typeInput}
              contentStyle={styles.typeContent}
              underlineColor="transparent"
              activeUnderlineColor="transparent"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              autoCorrect={false}
              autoCapitalize="words"
            />
          </View>
          {suggestions.length > 0 ? (
            <View style={[styles.suggestList, { borderColor: theme.colors.outlineVariant }]}>
              {suggestions.map((item) => {
                const flagUrl = flagUrlFromCountryCode(item.code);
                return (
                  <TouchableOpacity
                    key={item.code}
                    style={[styles.suggestItem, { borderBottomColor: theme.colors.outlineVariant }]}
                    onPress={() => handleSelect(item.name)}
                  >
                    <View style={styles.sheetRow}>
                      {flagUrl ? <Image source={{ uri: flagUrl }} style={[styles.flagImage, styles.flagMargin]} /> : null}
                      <Text style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.regular }}>{item.name}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : query.trim().length > 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
              No countries found.
            </Text>
          ) : null}
        </View>

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
  flagImage: {
    width: 24,
    height: 18,
    borderRadius: 2,
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
  flagMargin: {
    marginRight: 10,
  },
  inputBlock: {
    gap: 8,
  },
  inputLabel: {
    fontFamily: Fonts.ui.semiBold,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeInput: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  typeContent: {
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  suggestList: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 8,
    fontFamily: Fonts.ui.regular,
  },
});

export default WelcomeCountryScreen;
