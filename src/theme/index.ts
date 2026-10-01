import { Platform } from 'react-native';
import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';
import type { MD3Theme } from 'react-native-paper';
import { Fonts, outfitFamily } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';

type Md3Weight = '400' | '500' | '600' | '700';

function uiFace(size: number, weight: Md3Weight, letterSpacing: number) {
  const numeric = Number(weight) as 400 | 500 | 600 | 700;
  return {
    fontFamily: outfitFamily(numeric),
    fontSize: size,
    ...(Platform.OS === 'web' ? { fontWeight: weight } : {}),
    letterSpacing,
  };
}

const fontConfig = {
  bodyLarge: uiFace(16, '400', 0.5),
  bodyMedium: uiFace(14, '400', 0.25),
  bodySmall: uiFace(12, '400', 0.4),
  labelLarge: uiFace(14, '500', 0.1),
  labelMedium: uiFace(12, '500', 0.5),
  labelSmall: uiFace(11, '500', 0.5),
  titleLarge: uiFace(22, '400', 0),
  titleMedium: uiFace(16, '500', 0.15),
  titleSmall: uiFace(14, '500', 0.1),
  headlineLarge: uiFace(32, '600', 0),
  headlineMedium: uiFace(28, '600', 0),
  headlineSmall: uiFace(24, '600', 0),
  displayLarge: uiFace(57, '700', -0.25),
  displayMedium: uiFace(45, '700', 0),
  displaySmall: uiFace(36, '700', 0),
  default: {
    fontFamily: Fonts.ui.regular,
    letterSpacing: 0,
  },
};

const lightColors = {
  primary: '#1A2F23',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E4EBE6',
  onPrimaryContainer: '#1A2F23',
  secondary: '#3F6B4F',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#D8E5DC',
  onSecondaryContainer: '#1A2F23',
  tertiary: '#5C6B62',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#E8EDE9',
  onTertiaryContainer: '#1A2F23',
  error: BRAND_COLORS.danger,
  onError: '#FFFFFF',
  errorContainer: '#FEF2F2',
  onErrorContainer: '#991B1B',
  background: '#F1F0EC',
  onBackground: '#1A2F23',
  surface: '#FFFFFF',
  onSurface: '#1A2F23',
  surfaceVariant: '#E8E6E0',
  onSurfaceVariant: '#5C6B62',
  surfaceDisabled: '#E0E0E0',
  onSurfaceDisabled: '#BDBDBD',
  outline: '#BDBDBD',
  outlineVariant: 'rgba(26, 47, 35, 0.12)',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#1A2F23',
  inverseOnSurface: '#FFFFFF',
  inversePrimary: '#7A9E86',
  backdrop: 'rgba(0, 0, 0, 0.5)',
  elevation: {
    level0: '#F1F0EC',
    level1: '#F1F0EC',
    level2: '#EBE9E4',
    level3: '#E8E6E0',
    level4: '#E4E2DC',
    level5: '#DEDCD6',
  },
};

const darkColors = {
  primary: '#7A9E86',
  onPrimary: '#0F1A14',
  primaryContainer: '#243D30',
  onPrimaryContainer: '#D4E0D8',
  secondary: '#9BB8A6',
  onSecondary: '#0F1A14',
  secondaryContainer: '#3F6B4F',
  onSecondaryContainer: '#D8E5DC',
  tertiary: '#A8B5AE',
  onTertiary: '#0F1A14',
  tertiaryContainer: '#3A4740',
  onTertiaryContainer: '#E8EDE9',
  error: '#F87171',
  onError: '#18181B',
  errorContainer: '#7F1D1D',
  onErrorContainer: '#FECACA',
  background: '#050505',
  onBackground: '#FAFAFA',
  surface: '#111113',
  onSurface: '#FAFAFA',
  surfaceVariant: '#1A1A1E',
  onSurfaceVariant: '#A1A1AA',
  surfaceDisabled: '#27272A',
  onSurfaceDisabled: '#71717A',
  outline: '#3F3F46',
  outlineVariant: '#27272A',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#E4E4E7',
  inverseOnSurface: '#18181B',
  inversePrimary: '#1A2F23',
  backdrop: 'rgba(0, 0, 0, 0.85)',
  elevation: {
    level0: '#050505',
    level1: '#111113',
    level2: '#161618',
    level3: '#1C1C1F',
    level4: '#232328',
    level5: '#2A2A30',
  },
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: lightColors,
  fonts: configureFonts({ config: fontConfig }),
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: darkColors,
  fonts: configureFonts({ config: fontConfig }),
};

export type AppTheme = MD3Theme;
