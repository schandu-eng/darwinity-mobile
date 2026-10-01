import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandMark } from '@/components/brand/BrandMark';
import { InkPanelGradient } from '@/components/brand/InkPanelGradient';
import { BRAND_NAME, BRAND_TAGLINE } from '@/config/brand';
import { Fonts } from '@/config/fonts';
import { ChevronLeft, Eye, EyeOff } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { pointerEventsProp, pointerEventsStyle } from '@/theme/webCompat';
import {
  AUTH,
  AUTH_BREAKPOINT,
  AUTH_FEATURES,
  AUTH_GRAIN_URI,
  AUTH_SUPPORT,
  type AuthPressState,
  inputFocusShadow,
  panelMarkShadow,
  submitHoverShadow,
  submitPressedShadow,
  submitShadow,
  webCursor,
} from '@/components/auth/authTheme';

type AuthShellProps = {
  modeTitle: string;
  subtitle: string;
  /** `split` = web login (ink panel at ≥960). `simple` = verify-email / reset. */
  layout?: 'split' | 'simple';
  onBack?: () => void;
  children: React.ReactNode;
};

export const AuthShell: React.FC<AuthShellProps> = ({
  modeTitle,
  subtitle,
  layout = 'split',
  onBack,
  children,
}) => {
  const { width } = useWindowDimensions();
  const isWide = layout === 'split' && width >= AUTH_BREAKPOINT;
  const nameSize = Math.min(48, Math.max(37.6, width * 0.08));

  const ritual = (
    <View style={[styles.ritual, isWide && styles.ritualWide]}>
      {isWide ? (
        <Text style={styles.modeTitle} accessibilityRole="header">
          {modeTitle}
        </Text>
      ) : (
        <View style={styles.brand}>
          <View style={styles.markWrap}>
            <BrandMark size={36} color={AUTH.cta} />
          </View>
          <Text style={[styles.brandName, { fontSize: nameSize, lineHeight: nameSize * 0.95 }]}>
            {BRAND_NAME}
          </Text>
        </View>
      )}
      <Text style={[styles.subtitle, isWide && styles.subtitleWide]}>{subtitle}</Text>
      {children}
    </View>
  );

  const formColumn = (
    <View style={[styles.main, isWide && styles.mainWide]}>
      {isWide ? (
        <>
          <View style={[styles.top, styles.topWide]}>{onBack ? <AuthBackButton onPress={onBack} /> : null}</View>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              contentContainerStyle={styles.scrollWide}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {ritual}
            </ScrollView>
          </KeyboardAvoidingView>
        </>
      ) : (
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          {onBack ? (
            <View style={styles.top}>
              <AuthBackButton onPress={onBack} />
            </View>
          ) : null}
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView
              contentContainerStyle={styles.scroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {ritual}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      )}
    </View>
  );

  return (
    <View style={[styles.root, isWide && styles.rootWide]}>
      {!isWide ? (
        <>
          <LinearGradient
            colors={[AUTH.washStart, AUTH.paper, AUTH.white]}
            locations={[0, 0.42, 1]}
            start={{ x: 0.08, y: 0 }}
            end={{ x: 0.92, y: 1 }}
            style={[StyleSheet.absoluteFill, pointerEventsStyle('none')]}
            pointerEvents={pointerEventsProp('none')}
          />
          {/* Soft washes need CSS blur — omit on native to avoid hard-edged blobs. */}
          {Platform.OS === 'web' ? (
            <>
              <View
                style={[styles.washA, pointerEventsStyle('none')]}
                pointerEvents={pointerEventsProp('none')}
              />
              <View
                style={[styles.washB, pointerEventsStyle('none')]}
                pointerEvents={pointerEventsProp('none')}
              />
              <View
                style={[styles.grain, pointerEventsStyle('none')]}
                pointerEvents={pointerEventsProp('none')}
              />
            </>
          ) : null}
        </>
      ) : null}

      {isWide ? (
        <View style={styles.stage}>
          <AuthBrandPanel />
          {formColumn}
        </View>
      ) : (
        formColumn
      )}
    </View>
  );
};

const AuthBrandPanel: React.FC = () => (
  <InkPanelGradient style={styles.panel} contentStyle={styles.panelContent}>
    <View style={styles.panelInner}>
      <View style={styles.panelBrand}>
        <View style={styles.panelMark}>
          <BrandMark size={28} color={AUTH.cta} />
        </View>
        <Text style={styles.panelName}>{BRAND_NAME}</Text>
      </View>
      <View style={styles.panelCopy}>
        <Text style={styles.panelTagline}>{BRAND_TAGLINE}</Text>
        <Text style={styles.panelSupport}>{AUTH_SUPPORT}</Text>
      </View>
      <View style={styles.panelFeatures}>
        {AUTH_FEATURES.map(({ title, detail }, index) => (
          <View
            key={title}
            style={[styles.feature, index > 0 && styles.featureRule]}
          >
            <Text style={styles.featureTitle}>{title}</Text>
            <Text style={styles.featureDetail}>{detail}</Text>
          </View>
        ))}
      </View>
    </View>
  </InkPanelGradient>
);

type AuthBackButtonProps = {
  onPress: () => void;
};

export const AuthBackButton: React.FC<AuthBackButtonProps> = ({ onPress }) => (
  <Pressable
    onPress={onPress}
    hitSlop={8}
    accessibilityRole="button"
    accessibilityLabel="Back"
    style={({ pressed, hovered }: AuthPressState) => [
      styles.back,
      webCursor,
      (hovered || pressed) && styles.backHover,
    ]}
  >
    <View style={styles.backCircle}>
      <ChevronLeft size={16} strokeWidth={ICON_STROKE} color={AUTH.muted} />
    </View>
    <Text style={styles.backLabel}>Back</Text>
  </Pressable>
);

type AuthFieldProps = {
  label: string;
  description?: string;
  children: React.ReactNode;
};

export const AuthField: React.FC<AuthFieldProps> = ({ label, description, children }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {children}
    {description ? <Text style={styles.fieldHint}>{description}</Text> : null}
  </View>
);

type AuthInputProps = TextInputProps & {
  error?: boolean;
};

export const AuthInput: React.FC<AuthInputProps> = ({
  error,
  style,
  onFocus,
  onBlur,
  secureTextEntry,
  ...props
}) => {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = Boolean(secureTextEntry);
  const hidePassword = isPassword && !passwordVisible;

  const input = (
    <TextInput
      {...props}
      secureTextEntry={hidePassword}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      underlineColorAndroid="transparent"
      placeholderTextColor={AUTH.placeholder}
      {...(Platform.OS === 'web'
        ? {
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
          }
        : null)}
      style={[
        styles.input,
        isPassword && styles.inputWithToggle,
        hovered && !focused && !error && styles.inputHover,
        focused && !error && styles.inputFocus,
        error && styles.inputError,
        props.editable === false && styles.inputDisabled,
        style,
      ]}
    />
  );

  if (!isPassword) return input;

  return (
    <View style={styles.passwordWrap}>
      {input}
      <Pressable
        onPress={() => setPasswordVisible((current) => !current)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
        accessibilityState={{ selected: passwordVisible }}
        style={({ pressed, hovered: toggleHovered }: AuthPressState) => [
          styles.passwordToggle,
          webCursor,
          (toggleHovered || pressed) && styles.passwordToggleHover,
        ]}
      >
        {passwordVisible ? (
          <EyeOff size={18} strokeWidth={ICON_STROKE} color={AUTH.muted} />
        ) : (
          <Eye size={18} strokeWidth={ICON_STROKE} color={AUTH.muted} />
        )}
      </Pressable>
    </View>
  );
};

type AuthSubmitProps = {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
};

export const AuthSubmit: React.FC<AuthSubmitProps> = ({
  label,
  onPress,
  busy = false,
  disabled = false,
}) => {
  const isDisabled = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy }}
      style={({ pressed, hovered }: AuthPressState) => [
        styles.submit,
        webCursor,
        hovered && !isDisabled && styles.submitHover,
        pressed && !isDisabled && styles.submitPressed,
        isDisabled && styles.submitBusy,
      ]}
    >
      {busy ? (
        <View style={styles.submitRow}>
          <ActivityIndicator size="small" color={AUTH.ctaFg} />
          <Text style={styles.submitText}>Please wait…</Text>
        </View>
      ) : (
        <Text style={styles.submitText}>{label}</Text>
      )}
    </Pressable>
  );
};

type AuthLinkProps = {
  label: string;
  onPress: () => void;
};

export const AuthLink: React.FC<AuthLinkProps> = ({ label, onPress }) => (
  <Pressable
    onPress={onPress}
    hitSlop={8}
    accessibilityRole="link"
    accessibilityLabel={label}
    style={({ pressed }: AuthPressState) => [styles.linkHit, webCursor, pressed && styles.linkPressed]}
  >
    {({ hovered }: AuthPressState) => (
      <Text style={[styles.link, hovered && styles.linkHovered]}>{label}</Text>
    )}
  </Pressable>
);

export const AuthDivider: React.FC = () => (
  <View style={styles.divider} accessibilityRole="none">
    <View style={styles.dividerLine} />
    <Text style={styles.dividerText}>or email</Text>
    <View style={styles.dividerLine} />
  </View>
);

type AuthLinksRowProps = {
  children: React.ReactNode;
  centered?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const AuthLinksRow: React.FC<AuthLinksRowProps> = ({ children, centered, style }) => (
  <View style={[styles.links, centered && styles.linksCentered, style]}>{children}</View>
);

const blur = (amount: number): ViewStyle =>
  Platform.OS === 'web' ? ({ filter: `blur(${amount}px)` } as ViewStyle) : { opacity: 0.85 };

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AUTH.paper,
    overflow: 'hidden',
  },
  rootWide: {
    backgroundColor: AUTH.white,
  },
  flex: {
    flex: 1,
  },
  washA: {
    position: 'absolute',
    width: 320,
    height: 240,
    borderRadius: 160,
    backgroundColor: 'rgba(63, 107, 79, 0.18)',
    top: -80,
    left: -90,
    ...blur(48),
  },
  washB: {
    position: 'absolute',
    width: 280,
    height: 220,
    borderRadius: 140,
    backgroundColor: 'rgba(26, 47, 35, 0.1)',
    bottom: -90,
    right: -70,
    ...blur(44),
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    ...(Platform.OS === 'web'
      ? {
          mixBlendMode: 'multiply',
          backgroundImage: AUTH_GRAIN_URI,
          backgroundSize: '180px 180px',
        }
      : {}),
  } as ViewStyle,
  stage: {
    flex: 1,
    flexDirection: 'row',
  },
  panel: {
    flex: 1.1,
    minWidth: 352,
    alignSelf: 'stretch',
  },
  panelContent: {
    flex: 1,
  },
  panelInner: {
    flex: 1,
    justifyContent: 'center',
    gap: 36,
    maxWidth: 544,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: 48,
    paddingHorizontal: 40,
  },
  panelBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  panelMark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: AUTH.paperLift,
    alignItems: 'center',
    justifyContent: 'center',
    ...panelMarkShadow,
  },
  panelName: {
    fontFamily: Fonts.display.extraBold,
    fontSize: 34,
    letterSpacing: -1.5,
    lineHeight: 34,
    color: AUTH.panelFg,
  },
  panelCopy: {
    gap: 14,
  },
  panelTagline: {
    fontFamily: Fonts.display.bold,
    fontSize: 40,
    letterSpacing: -1.6,
    lineHeight: 44,
    color: AUTH.panelFg,
    maxWidth: 280,
  },
  panelSupport: {
    fontFamily: Fonts.body.regular,
    fontSize: 17,
    lineHeight: 26,
    color: 'rgba(250, 249, 246, 0.72)',
    maxWidth: 360,
  },
  panelFeatures: {
    flexDirection: 'row',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(250, 249, 246, 0.14)',
  },
  feature: {
    flex: 1,
    gap: 6,
    paddingRight: 18,
    minWidth: 0,
  },
  featureRule: {
    paddingLeft: 18,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(250, 249, 246, 0.14)',
  },
  featureTitle: {
    fontFamily: Fonts.display.bold,
    fontSize: 16,
    letterSpacing: -0.3,
    color: AUTH.panelFg,
  },
  featureDetail: {
    fontFamily: Fonts.body.regular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(250, 249, 246, 0.62)',
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  mainWide: {
    flex: 0.95,
    backgroundColor: AUTH.paperLift,
  },
  top: {
    paddingTop: 18,
    paddingHorizontal: 20,
    zIndex: 2,
  },
  topWide: {
    paddingTop: 24,
    paddingHorizontal: 32,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
  },
  backHover: {
    opacity: 0.85,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(24, 24, 27, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLabel: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
    color: AUTH.muted,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  scrollWide: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 32,
    alignItems: 'flex-start',
  },
  ritual: {
    width: '100%',
    maxWidth: 376,
    alignSelf: 'center',
    alignItems: 'center',
  },
  ritualWide: {
    maxWidth: 368,
    alignSelf: 'flex-start',
    alignItems: 'stretch',
  },
  brand: {
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  markWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(63, 107, 79, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(63, 107, 79, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontFamily: Fonts.display.extraBold,
    letterSpacing: -1.9,
    color: AUTH.fg,
    textAlign: 'center',
  },
  modeTitle: {
    fontFamily: Fonts.display.bold,
    fontSize: 30,
    letterSpacing: -1.05,
    lineHeight: 34,
    color: AUTH.fg,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: Fonts.body.regular,
    fontSize: 16,
    lineHeight: 24,
    color: AUTH.muted,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 30,
  },
  subtitleWide: {
    textAlign: 'left',
    maxWidth: '100%',
    marginBottom: 26,
  },
  field: {
    gap: 8,
  },
  label: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
    lineHeight: 20,
    color: AUTH.muted,
  },
  fieldHint: {
    fontFamily: Fonts.body.regular,
    fontSize: 13,
    lineHeight: 18,
    color: AUTH.subtle,
    marginTop: -6,
  },
  input: {
    width: '100%',
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AUTH.border,
    backgroundColor: AUTH.white,
    color: AUTH.fg,
    fontFamily: Fonts.body.regular,
    fontSize: 16,
    lineHeight: 20,
    paddingHorizontal: 15,
    paddingVertical: 11,
    ...(Platform.OS === 'web'
      ? {
          outlineStyle: 'none',
          transitionDuration: '150ms',
          transitionProperty: 'border-color, box-shadow, background-color',
        }
      : {}),
  } as ViewStyle,
  passwordWrap: {
    position: 'relative',
    width: '100%',
  },
  inputWithToggle: {
    paddingRight: 44,
  },
  passwordToggle: {
    position: 'absolute',
    right: 6,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    elevation: 2,
  },
  passwordToggleHover: {
    opacity: 0.75,
  },
  inputHover: {
    borderColor: 'rgba(26, 47, 35, 0.28)',
  },
  inputFocus: {
    borderColor: AUTH.growth,
    ...inputFocusShadow,
  },
  inputError: {
    borderColor: AUTH.error,
    borderWidth: 1.5,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  submit: {
    width: '100%',
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: AUTH.cta,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    ...submitShadow,
    ...(Platform.OS === 'web'
      ? {
          transitionDuration: '200ms',
          transitionProperty: 'transform, box-shadow, background-color',
        }
      : {}),
  },
  submitHover: {
    backgroundColor: AUTH.ctaHover,
    ...submitHoverShadow,
    ...(Platform.OS === 'web' ? { transform: [{ translateY: -1 }] } : {}),
  },
  submitPressed: {
    ...submitPressedShadow,
    ...(Platform.OS === 'web' ? { transform: [{ translateY: 0 }] } : { opacity: 0.92 }),
  },
  submitBusy: {
    opacity: 0.9,
    backgroundColor: AUTH.ctaHover,
  },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  submitText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 15,
    letterSpacing: -0.15,
    color: AUTH.ctaFg,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  linksCentered: {
    justifyContent: 'center',
  },
  linkHit: {
    paddingVertical: 2,
  },
  linkPressed: {
    opacity: 0.7,
  },
  link: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
    lineHeight: 20,
    color: AUTH.muted,
  },
  linkHovered: {
    color: AUTH.ink,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26, 47, 35, 0.35)',
  },
  divider: {
    width: '100%',
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    marginBottom: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: AUTH.line,
  },
  dividerText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: AUTH.subtle,
  },
});
