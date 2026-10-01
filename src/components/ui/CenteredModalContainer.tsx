import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, KeyboardAvoidingView } from 'react-native';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';

interface CenteredModalContainerProps {
  onBackdropPress: () => void;
  withKeyboardAvoidance?: boolean;
  children: React.ReactNode;
}

const CenteredModalContainer: React.FC<CenteredModalContainerProps> = ({
  onBackdropPress,
  withKeyboardAvoidance = false,
  children,
}) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const card = (
    <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
      {children}
    </View>
  );

  return (
    <View style={styles.outer}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onBackdropPress} />
      {withKeyboardAvoidance ? (
        <KeyboardAvoidingView
          style={styles.center}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          pointerEvents="box-none"
        >
          {card}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.center} pointerEvents="box-none">
          {card}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});

export default CenteredModalContainer;
