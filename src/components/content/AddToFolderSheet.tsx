import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient, useQueries } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useUserFolders, FOLDERS_QUERY_KEY } from '@/api/queries/folders';
import { foldersService } from '@/services/foldersService';
import { useNotificationStore } from '@/store/notificationStore';
import BottomSheet from '@/components/ui/BottomSheet';
import type { Folder } from '@/api/schemas/folders';

import { Fonts } from '@/config/fonts';
import { USE_NATIVE_DRIVER } from '@/theme/webCompat';

const FOLDER_CONTENT_STALE = 5 * 60 * 1000;

const AddToggle: React.FC<{ added: boolean; pending: boolean; theme: any }> = ({
  added,
  pending,
  theme,
}) => {
  const progress = useRef(new Animated.Value(added ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: added ? 1 : 0,
      useNativeDriver: USE_NATIVE_DRIVER,
      friction: 6,
      tension: 160,
    }).start();
  }, [added, progress]);

  if (pending) {
    return (
      <View style={styles.addBtnWrap}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  const plusOpacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const plusScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] });
  const checkOpacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const checkScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });

  return (
    <View style={styles.addBtnWrap}>
      <Animated.View
        style={[
          styles.addBtn,
          styles.addBtnLayer,
          { backgroundColor: theme.colors.primary, opacity: plusOpacity, transform: [{ scale: plusScale }] },
        ]}
      >
        <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
      </Animated.View>
      <Animated.View
        style={[
          styles.addBtn,
          { backgroundColor: theme.colors.primaryContainer, opacity: checkOpacity, transform: [{ scale: checkScale }] },
        ]}
      >
        <MaterialCommunityIcons name="check" size={18} color={theme.colors.onPrimaryContainer} />
      </Animated.View>
    </View>
  );
};

interface FolderPickerListProps {
  contentId: number;
  onClose: () => void;
}

export const FolderPickerList: React.FC<FolderPickerListProps> = ({ contentId, onClose }) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const showSuccess = useNotificationStore((s) => s.showSuccess);
  const { data, isLoading } = useUserFolders(user?.id || null);

  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const folders = useMemo(() => data?.data ?? [], [data?.data]);

  const contentQueries = useQueries({
    queries: folders.map((f) => ({
      queryKey: [FOLDERS_QUERY_KEY, 'content', f.id],
      queryFn: () => foldersService.getFolderContent(f.id),
      staleTime: FOLDER_CONTENT_STALE,
      enabled: !!contentId,
    })),
  });

  const memberIds = useMemo(() => {
    const set = new Set<number>();
    contentQueries.forEach((q, i) => {
      const folder = folders[i];
      if (folder && q.data?.data?.some((item) => item.id === contentId)) set.add(folder.id);
    });
    return set;
  }, [contentQueries, folders, contentId]);

  const isAdded = useCallback(
    (folderId: number) => memberIds.has(folderId) || addedIds.has(folderId),
    [memberIds, addedIds]
  );

  const handleAdd = useCallback(
    async (folder: Folder) => {
      if (!user?.id || isAdded(folder.id)) return;
      setPendingId(folder.id);
      setError('');
      const result = await foldersService.addContentToFolder(contentId, folder.id, user.id);
      setPendingId(null);
      if (result.success) {
        setAddedIds((prev) => new Set(prev).add(folder.id));
        queryClient.invalidateQueries({ queryKey: [FOLDERS_QUERY_KEY] });
        showSuccess(`Added to ${folder.name}`);
      } else {
        setError(result.message || 'Failed to add to folder');
      }
    },
    [user?.id, isAdded, contentId, queryClient, showSuccess]
  );

  const renderRow = (item: Folder) => {
    const added = isAdded(item.id);
    const pending = pendingId === item.id;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={added || pending}
        onPress={() => handleAdd(item)}
        style={styles.row}
      >
        <View style={[styles.iconTile, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons name="folder" size={20} color={theme.colors.onPrimaryContainer} />
        </View>
        <View style={styles.rowText}>
          <Text
            variant="bodyLarge"
            numberOfLines={1}
            style={[styles.rowTitle, { color: theme.colors.onSurface }]}
          >
            {item.name}
          </Text>
          <Text style={[styles.rowCount, { color: theme.colors.onSurfaceVariant }]}>
            {item.content_count ?? 0} {(item.content_count ?? 0) === 1 ? 'note' : 'notes'}
          </Text>
        </View>
        <AddToggle added={added} pending={pending} theme={theme} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleLarge" style={[styles.headerText, { color: theme.colors.onSurface }]}>
          Add to folder
        </Text>
        <TouchableOpacity
          onPress={onClose}
          style={[styles.closeButton, { backgroundColor: theme.colors.surfaceVariant }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="close" size={18} color={theme.colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      {error ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text> : null}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : folders.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyTile, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="folder-outline" size={28} color={theme.colors.onPrimaryContainer} />
          </View>
          <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            No folders yet. Create one from the Folders screen.
          </Text>
        </View>
      ) : (
        <View>
          {folders.map((folder, index) => (
            <View key={folder.id}>
              {index > 0 ? (
                <View style={[styles.separator, { backgroundColor: theme.colors.outlineVariant }]} />
              ) : null}
              {renderRow(folder)}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

interface AddToFolderSheetProps {
  visible: boolean;
  contentId: number | null;
  onDismiss: () => void;
}

const AddToFolderSheet: React.FC<AddToFolderSheetProps> = ({ visible, contentId, onDismiss }) => {
  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      {contentId != null ? <FolderPickerList contentId={contentId} onClose={onDismiss} /> : null}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxHeight: 460,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerText: {
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowText: {
    flex: 1,
    marginRight: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: -0.1,
  },
  rowCount: {
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
    marginTop: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },
  addBtnWrap: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnLayer: {
    position: 'absolute',
  },
  loading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 14,
  },
  emptyTile: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  errorText: {
    fontFamily: Fonts.ui.regular,
    fontSize: 13,
    marginBottom: 8,
  },
});

export default AddToFolderSheet;
