import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useUserFolders, FOLDERS_QUERY_KEY } from '@/api/queries/folders';
import { foldersService } from '@/services/foldersService';
import { FolderCard } from '@/components/content/FolderCard';
import { PanelLoadError } from '@/components/ui/PanelLoadError';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CenteredModalContainer from '@/components/ui/CenteredModalContainer';
import { useNotificationStore } from '@/store/notificationStore';
import type { ContentStackParamList } from '@/types/navigation';
import type { Folder } from '@/api/schemas/folders';
import { BRAND_COLORS } from '@/config/brand';

import { Fonts } from '@/config/fonts';

type NavigationProp = NativeStackNavigationProp<ContentStackParamList, 'Folders'>;

const FoldersScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const showSuccess = useNotificationStore((s) => s.showSuccess);

  const { data, isLoading, isRefetching, error, refetch } = useUserFolders(user?.id || null);

  const [, setBanner] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuFolder, setMenuFolder] = useState<Folder | null>(null);
  const [nameDialog, setNameDialog] = useState<{ mode: 'create' | 'rename'; folder?: Folder } | null>(null);
  const [nameValue, setNameValue] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const folders = useMemo(() => data?.data ?? [], [data?.data]);

  const invalidateFolders = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [FOLDERS_QUERY_KEY] });
  }, [queryClient]);

  const handleFolderPress = useCallback(
    (folder: Folder) => {
      navigation.navigate('FolderDetail', { folderId: folder.id, folderName: folder.name });
    },
    [navigation]
  );

  const handleOpenMenu = useCallback((folder: Folder) => {
    setMenuFolder(folder);
    setMenuVisible(true);
  }, []);

  const handleOpenCreate = useCallback(() => {
    setNameValue('');
    setNameDialog({ mode: 'create' });
  }, []);

  const handleOpenRename = useCallback(() => {
    if (!menuFolder) return;
    setNameValue(menuFolder.name);
    setNameDialog({ mode: 'rename', folder: menuFolder });
    setMenuVisible(false);
  }, [menuFolder]);

  const handleSaveName = useCallback(async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || !user?.id || !nameDialog) return;
    setIsSavingName(true);
    const result =
      nameDialog.mode === 'create'
        ? await foldersService.createFolder(trimmed, user.id)
        : await foldersService.renameFolder(nameDialog.folder!.id, trimmed, user.id);
    setIsSavingName(false);
    if (!result.success) {
      setBanner(result.message || 'Something went wrong');
      return;
    }
    setNameDialog(null);
    invalidateFolders();
    showSuccess(nameDialog.mode === 'create' ? 'Folder created' : 'Folder renamed');
  }, [nameValue, user?.id, nameDialog, invalidateFolders, showSuccess]);

  const handleRequestDelete = useCallback(() => {
    setMenuVisible(false);
    setDeleteVisible(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!menuFolder || !user?.id) return;
    setIsDeleting(true);
    const result = await foldersService.deleteFolder(menuFolder.id, user.id);
    setIsDeleting(false);
    setDeleteVisible(false);
    if (!result.success) {
      setBanner(result.message || 'Failed to delete folder');
      return;
    }
    setMenuFolder(null);
    invalidateFolders();
    showSuccess('Folder deleted');
  }, [menuFolder, user?.id, invalidateFolders, showSuccess]);

  const renderItem = useCallback(
    ({ item }: { item: Folder }) => (
      <FolderCard folder={item} onPress={handleFolderPress} onMenuPress={handleOpenMenu} theme={theme} />
    ),
    [handleFolderPress, handleOpenMenu, theme]
  );

  const renderEmptyState = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyTile, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons name="folder-multiple-outline" size={32} color={theme.colors.onPrimaryContainer} />
        </View>
        <Text variant="titleMedium" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          No folders yet
        </Text>
        <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          Create a folder to keep your notes organized
        </Text>
      </View>
    );
  };

  const nameValid = nameValue.trim().length > 0;

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: themeMode === 'dark' ? '#09090B' : BRAND_COLORS.paper }]}>
        <PanelLoadError
          fill
          title="Couldn't load folders"
          description="Something went wrong. Check your connection and try again."
          onRetry={() => {
            void refetch();
          }}
          retrying={isRefetching}
        />
      </View>
    );
  }

  return (
    <>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <FlatList
          data={folders}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[styles.listContent, folders.length === 0 && styles.listContentEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={themeMode === 'dark' ? '#7A9E86' : BRAND_COLORS.ink}
              colors={themeMode === 'dark' ? ['#7A9E86'] : [BRAND_COLORS.ink]}
            />
          }
        />
        <TouchableOpacity
          onPress={handleOpenCreate}
          activeOpacity={0.9}
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        >
          <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
          <Text style={styles.fabText}>New Folder</Text>
        </TouchableOpacity>
      </View>

      <BottomSheet visible={menuVisible} onDismiss={() => setMenuVisible(false)}>
        <View style={styles.menuContainer}>
          <Text style={[styles.menuHeader, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            {menuFolder?.name ?? 'Folder'}
          </Text>
          <TouchableOpacity style={styles.menuItem} onPress={handleOpenRename} activeOpacity={0.6}>
            <View style={[styles.menuIconTile, { backgroundColor: theme.colors.surfaceVariant }]}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={theme.colors.onSurface} />
            </View>
            <Text style={[styles.menuItemText, { color: theme.colors.onSurface }]}>Rename folder</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={handleRequestDelete} activeOpacity={0.6}>
            <View style={[styles.menuIconTile, { backgroundColor: 'rgba(220,38,38,0.12)' }]}>
              <MaterialCommunityIcons name="trash-can-outline" size={20} color="#DC2626" />
            </View>
            <Text style={[styles.menuItemText, { color: '#DC2626' }]}>Delete folder</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      <Modal visible={!!nameDialog} transparent animationType="fade" onRequestClose={() => setNameDialog(null)}>
        <CenteredModalContainer onBackdropPress={() => !isSavingName && setNameDialog(null)} withKeyboardAvoidance>
          <View style={styles.dialogHeader}>
            <Text variant="titleLarge" style={[styles.dialogTitle, { color: theme.colors.onSurface }]}>
              {nameDialog?.mode === 'create' ? 'New folder' : 'Rename folder'}
            </Text>
            <TouchableOpacity
              onPress={() => setNameDialog(null)}
              disabled={isSavingName}
              style={[styles.closeButton, { backgroundColor: theme.colors.surfaceVariant }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close" size={18} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.inputWrap,
              {
                backgroundColor: theme.colors.surfaceVariant,
                borderColor: nameFocused ? theme.colors.primary : 'transparent',
              },
            ]}
          >
            <MaterialCommunityIcons name="folder-outline" size={20} color={theme.colors.onSurfaceVariant} />
            <TextInput
              value={nameValue}
              onChangeText={setNameValue}
              placeholder="Folder name"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              autoFocus
              editable={!isSavingName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
              onSubmitEditing={handleSaveName}
              returnKeyType="done"
              style={[styles.input, { color: theme.colors.onSurface }]}
            />
          </View>
          <TouchableOpacity
            onPress={handleSaveName}
            activeOpacity={0.85}
            disabled={!nameValid || isSavingName}
            style={[
              styles.primaryButton,
              { backgroundColor: theme.colors.primary, opacity: !nameValid || isSavingName ? 0.45 : 1 },
            ]}
          >
            {isSavingName ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {nameDialog?.mode === 'create' ? 'Create folder' : 'Save changes'}
              </Text>
            )}
          </TouchableOpacity>
        </CenteredModalContainer>
      </Modal>

      <ConfirmModal
        visible={deleteVisible}
        title="Delete folder"
        message="This removes the folder. Your notes stay in your library."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteVisible(false)}
        isLoading={isDeleting}
        destructive
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bannerContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTile: {
    width: 72,
    height: 72,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: Fonts.ui.semiBold,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#1A2F23',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.2,
  },
  menuContainer: {
    width: '100%',
    paddingBottom: 4,
  },
  menuHeader: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 13,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 14,
  },
  menuIconTile: {
    width: 38,
    height: 38,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    fontFamily: Fonts.ui.medium,
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dialogTitle: {
    fontFamily: Fonts.ui.bold,
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    height: 52,
  },
  input: {
    flex: 1,
    fontFamily: Fonts.ui.regular,
    fontSize: 16,
    padding: 0,
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.ui.semiBold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
});

export default FoldersScreen;
