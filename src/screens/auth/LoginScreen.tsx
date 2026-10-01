import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types/navigation';
import { useAppleAuth, useForgotPassword, useGoogleAuth, useLogin, useRegister } from '@/api/queries/auth';
import { validateEmail } from '@/utils/validation';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import {
  AuthDivider,
  AuthField,
  AuthInput,
  AuthLink,
  AuthLinksRow,
  AuthShell,
  AuthSubmit,
} from '@/components/auth/AuthShell';
import { AUTH } from '@/components/auth/authTheme';
import { Fonts } from '@/config/fonts';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import { useAuthStore } from '@/store';
import {
  isNativeGoogleSignInAvailable,
  signInWithGoogleNative,
} from '@/services/googleSignIn';
import {
  isNativeAppleSignInAvailable,
  signInWithAppleNative,
} from '@/services/appleSignIn';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;
type AuthMode = 'signin' | 'signup' | 'forgot';

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [appleEnabled, setAppleEnabled] = useState(false);
  const handledGoogleResponse = useRef<string | null>(null);
  const handledAppleResponse = useRef<string | null>(null);

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const forgotMutation = useForgotPassword();
  const googleMutation = useGoogleAuth();
  const appleMutation = useAppleAuth();

  const googleEnabled = isNativeGoogleSignInAvailable();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await isNativeAppleSignInAvailable();
      if (!cancelled) setAppleEnabled(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const busy =
    loginMutation.isPending ||
    registerMutation.isPending ||
    forgotMutation.isPending ||
    googleMutation.isPending ||
    appleMutation.isPending;

  const finishOAuth = async (
    method: 'google' | 'apple',
    result: {
      success: boolean;
      message?: string;
      userPresent?: boolean;
      token?: string;
      email?: string;
    },
    fallbackEmail: string
  ) => {
    if (!result.success) {
      analytics.track(EVENTS.LOGIN_FAILED, { method, reason: 'request_error' });
      setError(result.message || `${method === 'apple' ? 'Apple' : 'Google'} sign-in failed`);
      return;
    }
    const resolvedEmail = (result.email || fallbackEmail || '').toLowerCase();
    if (!result.userPresent && result.token) {
      analytics.track(EVENTS.SIGNUP_COMPLETED, { method, needs_onboarding: true });
      if (resolvedEmail) {
        analytics.identify(resolvedEmail, { email: resolvedEmail, $email: resolvedEmail });
      }
      navigation.navigate('Signup', {
        email: resolvedEmail,
        token: result.token,
      });
      return;
    }
    const user = useAuthStore.getState().user;
    if (user?.id) {
      analytics.identify(String(user.id), {
        email: user.email || resolvedEmail,
        $email: user.email || resolvedEmail,
      });
    }
    analytics.track(EVENTS.LOGIN_COMPLETED, { method, needs_onboarding: false });
  };

  const finishGoogle = async (idToken: string) => {
    if (handledGoogleResponse.current === idToken) return;
    handledGoogleResponse.current = idToken;

    setError('');
    setInfo('');
    const result = await googleMutation.mutateAsync(idToken);
    if (!result.success) {
      handledGoogleResponse.current = null;
    }
    await finishOAuth('google', result, email.trim().toLowerCase());
  };

  const finishApple = async (
    identityToken: string,
    fullName?: string,
    emailHint?: string
  ) => {
    if (handledAppleResponse.current === identityToken) return;
    handledAppleResponse.current = identityToken;

    setError('');
    setInfo('');
    const result = await appleMutation.mutateAsync({
      identityToken,
      fullName,
      email: emailHint,
    });
    if (!result.success) {
      handledAppleResponse.current = null;
    }
    await finishOAuth('apple', result, (emailHint || email).trim().toLowerCase());
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setInfo('');
  };

  const handleGooglePress = async () => {
    setError('');
    setInfo('');
    handledGoogleResponse.current = null;
    analytics.track(EVENTS.LOGIN_STARTED, { method: 'google' });

    const signedIn = await signInWithGoogleNative();
    if (!signedIn.ok) {
      if (signedIn.cancelled) {
        analytics.track(EVENTS.LOGIN_FAILED, { method: 'google', reason: 'cancelled_or_failed' });
        return;
      }
      analytics.track(EVENTS.LOGIN_FAILED, { method: 'google', reason: 'prompt_error' });
      setError(signedIn.message);
      return;
    }

    await finishGoogle(signedIn.idToken);
  };

  const handleApplePress = async () => {
    setError('');
    setInfo('');
    handledAppleResponse.current = null;
    analytics.track(EVENTS.LOGIN_STARTED, { method: 'apple' });

    const signedIn = await signInWithAppleNative();
    if (!signedIn.ok) {
      if (signedIn.cancelled) {
        analytics.track(EVENTS.LOGIN_FAILED, { method: 'apple', reason: 'cancelled_or_failed' });
        return;
      }
      analytics.track(EVENTS.LOGIN_FAILED, { method: 'apple', reason: 'prompt_error' });
      setError(signedIn.message);
      return;
    }

    await finishApple(signedIn.identityToken, signedIn.fullName, signedIn.email);
  };

  const handleSubmit = async () => {
    setError('');
    setInfo('');

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Please enter your email address');
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (mode === 'forgot') {
      const result = await forgotMutation.mutateAsync(trimmedEmail);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setInfo(result.message);
      setMode('signin');
      return;
    }

    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setError('Please enter your name');
        return;
      }
      analytics.track(EVENTS.SIGNUP_STARTED, { method: 'email' });
      const result = await registerMutation.mutateAsync({
        email: trimmedEmail,
        password,
        name: name.trim(),
      });
      if (result.needsEmailVerification) {
        analytics.track(EVENTS.EMAIL_VERIFICATION_SENT, { method: 'email' });
        navigation.navigate('VerifyEmail', {
          email: result.email || trimmedEmail,
        });
        return;
      }
      if (!result.success) {
        analytics.track(EVENTS.SIGNUP_FAILED, {
          method: 'email',
          reason: result.emailTaken ? 'email_taken' : 'request_error',
        });
        setError(result.message || 'Registration failed');
        if (result.emailTaken) {
          setMode('signin');
        }
        return;
      }
      if (!result.userPresent && result.token) {
        analytics.track(EVENTS.SIGNUP_COMPLETED, { method: 'email', needs_onboarding: true });
        analytics.identify(trimmedEmail, { email: trimmedEmail, $email: trimmedEmail });
        navigation.navigate('Signup', { email: trimmedEmail, token: result.token });
        return;
      }
      const user = useAuthStore.getState().user;
      if (user?.id) {
        analytics.identify(String(user.id), {
          email: user.email || trimmedEmail,
          $email: user.email || trimmedEmail,
        });
      }
      analytics.track(EVENTS.SIGNUP_COMPLETED, { method: 'email', needs_onboarding: false });
      return;
    }

    analytics.track(EVENTS.LOGIN_STARTED, { method: 'email' });
    const result = await loginMutation.mutateAsync({
      email: trimmedEmail,
      password,
    });
    if (result.needsEmailVerification) {
      navigation.navigate('VerifyEmail', {
        email: result.email || trimmedEmail,
      });
      return;
    }
    if (!result.success) {
      analytics.track(EVENTS.LOGIN_FAILED, { method: 'email', reason: 'request_error' });
      setError(result.message || 'Login failed');
      return;
    }
    if (!result.userPresent && result.token) {
      analytics.track(EVENTS.SIGNUP_COMPLETED, { method: 'email', needs_onboarding: true });
      analytics.identify(trimmedEmail, { email: trimmedEmail, $email: trimmedEmail });
      navigation.navigate('Signup', { email: trimmedEmail, token: result.token });
      return;
    }
    const user = useAuthStore.getState().user;
    if (user?.id) {
      analytics.identify(String(user.id), {
        email: user.email || trimmedEmail,
        $email: user.email || trimmedEmail,
      });
    }
    analytics.track(EVENTS.LOGIN_COMPLETED, { method: 'email', needs_onboarding: false });
  };

  const heading =
    mode === 'forgot' ? 'Reset password' : mode === 'signup' ? 'Create account' : 'Sign in';

  const subtitle =
    mode === 'forgot'
      ? 'We’ll email you a reset link.'
      : mode === 'signup'
        ? 'Create your free student account.'
        : 'Welcome back. Pick up where you left off.';

  const submitLabel =
    mode === 'forgot' ? 'Send reset link' : mode === 'signup' ? 'Create account' : 'Sign in';

  return (
    <AuthShell
      modeTitle={heading}
      subtitle={subtitle}
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
    >
      {mode !== 'forgot' && (appleEnabled || googleEnabled) ? (
        <View style={styles.googleBlock}>
          {appleEnabled ? (
            <AppleSignInButton
              onPress={handleApplePress}
              disabled={busy}
              loading={appleMutation.isPending}
            />
          ) : null}
          {googleEnabled ? (
            <GoogleSignInButton
              onPress={handleGooglePress}
              disabled={busy}
              loading={googleMutation.isPending}
              style={appleEnabled ? styles.oauthSecond : undefined}
            />
          ) : null}
          <AuthDivider />
        </View>
      ) : null}

      <View style={styles.form}>
        {mode === 'signup' ? (
          <AuthField label="Name">
            <AuthInput
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (error) setError('');
              }}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              editable={!busy}
              returnKeyType="next"
            />
          </AuthField>
        ) : null}

        <AuthField label="Email">
          <AuthInput
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
            editable={!busy}
            error={!!error}
            returnKeyType={mode === 'forgot' ? 'go' : 'next'}
            onSubmitEditing={mode === 'forgot' ? handleSubmit : undefined}
          />
        </AuthField>

        {mode !== 'forgot' ? (
          <AuthField
            label="Password"
            description={mode === 'signup' ? 'At least 8 characters' : undefined}
          >
            <AuthInput
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError('');
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'signup' ? 'password-new' : 'password'}
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
          </AuthField>
        ) : null}

        {error ? (
          <ErrorBanner message={error} variant="compact" onDismiss={() => setError('')} />
        ) : null}
        {info ? <Text style={styles.infoText}>{info}</Text> : null}

        <AuthSubmit
          label={submitLabel}
          onPress={handleSubmit}
          busy={busy && !googleMutation.isPending && !appleMutation.isPending}
          disabled={busy}
        />

        <AuthLinksRow centered={mode !== 'signin'}>
          {mode === 'signin' ? (
            <>
              <AuthLink label="Forgot password?" onPress={() => switchMode('forgot')} />
              <AuthLink label="Create an account" onPress={() => switchMode('signup')} />
            </>
          ) : (
            <AuthLink
              label={mode === 'signup' ? 'Already have an account? Sign in' : 'Back to sign in'}
              onPress={() => switchMode('signin')}
            />
          )}
        </AuthLinksRow>
      </View>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  googleBlock: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 10,
  },
  oauthSecond: {
    marginTop: 0,
  },
  form: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 18,
  },
  infoText: {
    fontFamily: Fonts.body.regular,
    fontSize: 14,
    lineHeight: 20,
    color: AUTH.cta,
  },
});

export default LoginScreen;
