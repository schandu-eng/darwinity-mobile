import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { contentService } from '@/services/contentService';
import CenteredModalContainer from '@/components/ui/CenteredModalContainer';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { useNotificationStore } from '@/store/notificationStore';
import type { AppStackParamList } from '@/types/navigation';

import { Fonts } from '@/config/fonts';

type RenameNoteModalRouteProp = RouteProp<AppStackParamList, 'RenameNoteModal'>;
type RenameNoteModalNavigationProp = NativeStackNavigationProp<AppStackParamList, 'RenameNoteModal'>;

const RenameNoteModalScreen: React.FC = () => {
  const navigation = useNavigation<RenameNoteModalNavigationProp>();
  const route = useRoute<RenameNoteModalRouteProp>();
  const { contentId, currentTitle } = route.params;
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const queryClient = useQueryClient();
  const showSuccess = useNotificationStore((s) => s.showSuccess);

  const [title, setTitle] = useState(currentTitle);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (isSaving) return;
    navigation.goBack();
  }, [isSaving, navigation]);

  const handleSave = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    setIsSaving(true);
    setError(null);
    try {
      const result = await contentService.updateContentTitle(contentId, trimmed);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['content'] });
        showSuccess('Title updated successfully');
        navigation.goBack();
      } else {
        setError(result.message || 'Failed to update title');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update title');
    } finally {
      setIsSaving(false);
    }
  }, [title, contentId, queryClient, navigation, showSuccess]);

  return (
    <CenteredModalContainer onBackdropPress={handleClose} withKeyboardAvoidance>
      <View style={styles.header}>
        <Text variant="titleLarge" style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          Rename Note
        </Text>
        <TouchableOpacity onPress={handleClose} disabled={isSaving} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
      </View>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} variant="compact" /> : null}

      <TextInput
        label="Note Title"
        value={title}
        onChangeText={setTitle}
        mode="outlined"
        autoFocus
        disabled={isSaving}
        onSubmitEditing={handleSave}
      />

      <Button
        mode="contained"
        onPress={handleSave}
        loading={isSaving}
        disabled={!title.trim() || isSaving}
      >
        Rename
      </Button>
    </CenteredModalContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.ui.semiBold,
  },
  closeButton: {
    padding: 4,
  },
});

export default RenameNoteModalScreen;
