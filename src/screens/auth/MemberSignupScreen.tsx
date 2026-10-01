import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView } from 'react-native';
import { TextInput, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types/navigation';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { useOnboardingDraftStore } from '@/store';
import { Fonts } from '@/config/fonts';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;
type MemberSignupScreenRouteProp = RouteProp<AuthStackParamList, 'Signup'>;

const MemberSignupScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<MemberSignupScreenRouteProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const email = route.params?.email || '';
  const token = route.params?.token || '';
  
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const setPersonalInfo = useOnboardingDraftStore((state) => state.setPersonalInfo);
  const resetOnboardingDraft = useOnboardingDraftStore((state) => state.reset);

  const handleSubmit = async () => {
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please enter your full name');
      return;
    }

    if (trimmedName.length < 2) {
      setError('Please enter a valid name');
      return;
    }

    if (!email) {
      setError('Email not found. Please go back and try again.');
      return;
    }

    if (!token) {
      setError('Session expired. Please go back and try again.');
      return;
    }

    resetOnboardingDraft();
    setPersonalInfo({
      email,
      token,
      name: trimmedName,
    });

    navigation.navigate('OnboardingIdentity');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const isFormValid = !!name.trim();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableOpacity
          style={[styles.headerBackButton, { marginTop: Platform.OS === 'ios' ? 8 : 16, marginLeft: 16 }]}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text variant="displaySmall" style={[styles.title, { color: theme.colors.onSurface }]}>
                Complete Your Profile
              </Text>
              <Text variant="bodyLarge" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                Add your details to finish setting up your account
              </Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputWrapper}>
                <Text variant="labelLarge" style={[styles.inputLabel, { color: theme.colors.onSurface }]}>
                  Full Name
                </Text>
                <TextInput
                  value={name}
                  onChangeText={(text) => {
                    setName(text);
                    if (error) setError('');
                  }}
                  mode="outlined"
                  autoCapitalize="words"
                  autoComplete="name"
                  error={!!error && !name.trim()}
                  style={[styles.input, error && !name.trim() && styles.inputError]}
                  contentStyle={styles.inputContent}
                  outlineStyle={[
                    styles.inputOutline,
                    error && !name.trim() && { borderColor: theme.colors.error, borderWidth: 2 },
                  ]}
                  activeOutlineColor={theme.colors.primary}
                  outlineColor={error && !name.trim() ? theme.colors.error : theme.colors.outline}
                  left={
                    <TextInput.Icon
                      icon={() => (
                        <MaterialCommunityIcons
                          name="account-outline"
                          size={20}
                          color={error && !name.trim() ? theme.colors.error : theme.colors.onSurfaceVariant}
                        />
                      )}
                    />
                  }
                />
              </View>

              {error ? <ErrorBanner message={error} variant="compact" onDismiss={() => setError('')} /> : null}

              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    backgroundColor: isFormValid ? theme.colors.primary : theme.colors.surfaceVariant,
                  },
                ]}
                onPress={handleSubmit}
                disabled={!isFormValid}
                activeOpacity={0.8}
              >
                <View style={styles.buttonContent}>
                  <Text
                    variant="titleMedium"
                    style={[
                      styles.buttonText,
                      { color: isFormValid ? '#FFFFFF' : theme.colors.onSurfaceVariant },
                    ]}
                  >
                    Continue
                  </Text>
                  {isFormValid && <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={handleBack}
                activeOpacity={0.7}
              >
                <Text variant="bodyMedium" style={[styles.backButtonText, { color: theme.colors.primary }]}>
                  Use Different Email
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  header: {
    marginBottom: 48,
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.display.bold,
    fontSize: 36,
    letterSpacing: -1,
    lineHeight: 44,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.body.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  formContainer: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: Fonts.body.semiBold,
    fontSize: 14,
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  input: {
    backgroundColor: 'transparent',
    fontSize: 16,
    fontFamily: Fonts.body.regular,
  },
  inputContent: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    fontFamily: Fonts.body.regular,
  },
  inputOutline: {
    borderRadius: 12,
    borderWidth: 1.5,
  },
  inputError: {
    marginBottom: 4,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#1A2F23',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.body.semiBold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontFamily: Fonts.body.medium,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});

export default MemberSignupScreen;
