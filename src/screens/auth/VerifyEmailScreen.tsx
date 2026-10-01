import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types/navigation';
import {
  AuthLink,
  AuthLinksRow,
  AuthShell,
  AuthSubmit,
} from '@/components/auth/AuthShell';
import { AUTH } from '@/components/auth/authTheme';
import { Fonts } from '@/config/fonts';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { useResendVerification } from '@/api/queries/auth';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'VerifyEmail'>;
type VerifyEmailRouteProp = RouteProp<AuthStackParamList, 'VerifyEmail'>;

const VerifyEmailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<VerifyEmailRouteProp>();
  const email = route.params?.email || '';

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const resendMutation = useResendVerification();

  const handleResend = async () => {
    setError('');
    setInfo('');
    if (!email) {
      setError('Missing email. Go back and try signing up again.');
      return;
    }
    const result = await resendMutation.mutateAsync(email);
    if (!result.success) {
      setError(result.message);
      return;
    }
    analytics.track(EVENTS.EMAIL_VERIFICATION_RESENT);
    setInfo(result.message);
  };

  return (
    <AuthShell
      layout="simple"
      modeTitle="Check your email"
      subtitle="Confirm your email to finish signup."
      onBack={() => navigation.navigate('Login')}
    >
      <View style={styles.form}>
        <Text style={styles.body}>
          We sent a verification link to <Text style={styles.email}>{email || 'your inbox'}</Text>.
          Open it to activate your account, then you can sign in. If you don’t see it, check Spam
          and Promotions.
        </Text>

        {error ? <ErrorBanner message={error} variant="compact" onDismiss={() => setError('')} /> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <AuthSubmit
          label="Resend verification email"
          onPress={handleResend}
          busy={resendMutation.isPending}
        />

        <AuthLinksRow centered>
          <AuthLink label="Back to sign in" onPress={() => navigation.navigate('Login')} />
        </AuthLinksRow>
      </View>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  form: {
    width: '100%',
    alignSelf: 'stretch',
    gap: 16,
  },
  body: {
    fontFamily: Fonts.body.regular,
    fontSize: 14,
    lineHeight: 22,
    color: AUTH.subtle,
    marginBottom: 4,
  },
  email: {
    fontFamily: Fonts.body.bold,
    color: AUTH.fg,
  },
  info: {
    fontFamily: Fonts.body.regular,
    fontSize: 14,
    lineHeight: 20,
    color: AUTH.cta,
  },
});

export default VerifyEmailScreen;
