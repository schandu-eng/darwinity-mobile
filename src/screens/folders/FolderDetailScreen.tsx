import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { useRecentFoldersStore } from '@/store/recentFoldersStore';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useFolderContent, FOLDERS_QUERY_KEY } from '@/api/queries/folders';
import { useUserContent, prefetchContentDetail } from '@/api/queries/content';
import { foldersService } from '@/services/foldersService';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import UploadModal from '@/components/upload/UploadModal';
import { useNotificationStore } from '@/store/notificationStore';
import type { ContentStackParamList } from '@/types/navigation';
import type { FolderContentItem } from '@/api/schemas/folders';
import type { ContentListItem, ContentType } from '@/api/schemas/content';
import { BRAND_COLORS } from '@/config/brand';
import { PanelLoadError } from '@/components/ui/PanelLoadError';

import { Fonts } from '@/config/fonts';

type NavigationProp = NativeStackNavigationProp<ContentStackParamList, 'FolderDetail'>;
type FolderDetailRouteProp = RouteProp<ContentStackParamList, 'FolderDetail'>;

const PICKER_PAGE_SIZE = 20;

const typeIcon = (
  contentType: ContentType
): { name: React.ComponentProps<typeof MaterialCommunityIcons>['name']; color: string } => {
  switch (contentType) {
    case 'PDF':
      return { name: 'file-document', color: '#EF4444' };
    case 'YOUTUBE':
      return { name: 'play-circle', color: '#FF0000' };
    case 'AUDIO_RECORDING':
      return { name: 'microphone', color: '#1A2F23' };
    default:
      return { name: 'note-text-outline', color: '#1A2F23' };
  }
};

const FolderDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<FolderDetailRouteProp>();
  const { folderId, folderName } = route.params;
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const showSuccess = useNotificationStore((s) => s.showSuccess);
  const markFolderOpened = useRecentFoldersStore((s) => s.markOpened);

  const { data, isLoading, isRefetching, error, refetch } = useFolderContent(folderId);

  const [, setBanner] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [menuItem, setMenuItem] = useState<FolderContentItem | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<FolderContentItem | 'bulk' | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);

  const items = useMemo(() => data?.data ?? [], [data?.data]);
  const existingIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  useEffect(() => {
    if (folderName) navigation.setOptions({ title: folderName });
  }, [folderName, navigation]);

  useEffect(() => {
    markFolderOpened(folderId);
  }, [folderId, markFolderOpened]);

  useEffect(() => {
    const err = route.params?.error;
    if (!err) return;
    navigation.setParams({ error: undefined });
    setBanner(err);
  }, [route.params?.error, navigation]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [FOLDERS_QUERY_KEY] });
  }, [queryClient]);

  const handleItemPress = useCallback(
    (item: FolderContentItem) => {
      if (selectMode) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(item.id)) next.delete(item.id);
          else next.add(item.id);
          return next;
        });
        return;
      }
      void prefetchContentDetail(item.id, userId);
      navigation.navigate('ContentDetail', { contentId: item.id });
    },
    [selectMode, navigation, userId]
  );

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const removeOne = useCallback(
    async (contentId: number): Promise<boolean> => {
      const result = await foldersService.removeContentFromFolder(folderId, contentId);
      if (!result.success) setBanner(result.message || 'Failed to remove note');
      return result.success;
    },
    [folderId]
  );

  const handleConfirmRemove = useCallback(async () => {
    if (!removeTarget) return;
    setIsRemoving(true);
    if (removeTarget === 'bulk') {
      const ids = Array.from(selectedIds);
      const results = await Promise.all(ids.map(removeOne));
      setIsRemoving(false);
      setRemoveTarget(null);
      exitSelectMode();
      invalidate();
      if (results.every(Boolean)) showSuccess('Notes removed from folder');
      return;
    }
    const ok = await removeOne(removeTarget.id);
    setIsRemoving(false);
    setRemoveTarget(null);
    setMenuItem(null);
    invalidate();
    if (ok) showSuccess('Note removed from folder');
  }, [removeTarget, selectedIds, removeOne, exitSelectMode, invalidate, showSuccess]);

  const renderItem = useCallback(
    ({ item }: { item: FolderContentItem }) => {
      const icon = typeIcon(item.content_type);
      const selected = selectedIds.has(item.id);
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleItemPress(item)}
          style={[
            styles.row,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
            selected && { borderColor: theme.colors.primary, borderWidth: 1.5 },
          ]}
        >
          <View style={[styles.rowIcon, { backgroundColor: theme.colors.surfaceVariant }]}>
            <MaterialCommunityIcons name={icon.name} size={22} color={icon.color} />
          </View>
          <Text
            variant="bodyLarge"
            numberOfLines={2}
            style={[styles.rowTitle, { color: theme.colors.onSurface }]}
          >
            {item.title}
          </Text>
          {selectMode ? (
            <MaterialCommunityIcons
              name={selected ? 'check-circle' : 'circle-outline'}
              size={24}
              color={selected ? theme.colors.primary : theme.colors.onSurfaceVariant}
            />
          ) : (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                setMenuItem(item);
                setMenuVisible(true);
              }}
              style={styles.menuButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.6}
            >
              <MaterialCommunityIcons name="dots-horizontal" size={20} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    },
    [handleItemPress, selectMode, selectedIds, theme]
  );

  const renderEmptyState = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyTile, { backgroundColor: theme.colors.primaryContainer }]}>
          <MaterialCommunityIcons name="folder-open-outline" size={32} color={theme.colors.onPrimaryContainer} />
        </View>
        <Text variant="titleMedium" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          This folder is empty
        </Text>
        <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          Add notes from your library or upload something new
        </Text>
        <TouchableOpacity
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.85}
          style={[styles.emptyCta, { backgroundColor: theme.colors.primary }]}
        >
          <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.emptyCtaText}>Add notes</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: themeMode === 'dark' ? '#09090B' : BRAND_COLORS.paper }]}>
        <PanelLoadError
          fill
          title="Couldn't load this folder"
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
        <View style={styles.toolbar}>
          {selectMode ? (
            <>
              <TouchableOpacity onPress={exitSelectMode} style={styles.ghostBtn} activeOpacity={0.6}>
                <Text style={[styles.ghostBtnText, { color: theme.colors.onSurfaceVariant }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.toolbarCount, { color: theme.colors.onSurface }]}>
                {selectedIds.size} selected
              </Text>
              <TouchableOpacity
                onPress={() => selectedIds.size > 0 && setRemoveTarget('bulk')}
                disabled={selectedIds.size === 0}
                activeOpacity={0.85}
                style={[
                  styles.pill,
                  { backgroundColor: 'rgba(220,38,38,0.12)', opacity: selectedIds.size === 0 ? 0.4 : 1 },
                ]}
              >
                <MaterialCommunityIcons name="folder-remove-outline" size={16} color="#DC2626" />
                <Text style={[styles.pillText, { color: '#DC2626' }]}>Remove</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.toolbarLeft}>
                <TouchableOpacity
                  onPress={() => setPickerVisible(true)}
                  activeOpacity={0.85}
                  style={[styles.pill, { backgroundColor: theme.colors.primaryContainer }]}
                >
                  <MaterialCommunityIcons name="plus" size={16} color={theme.colors.onPrimaryContainer} />
                  <Text style={[styles.pillText, { color: theme.colors.onPrimaryContainer }]}>Add notes</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setUploadVisible(true)}
                  activeOpacity={0.85}
                  style={[styles.pill, { backgroundColor: theme.colors.surfaceVariant }]}
                >
                  <MaterialCommunityIcons name="tray-arrow-up" size={16} color={theme.colors.onSurface} />
                  <Text style={[styles.pillText, { color: theme.colors.onSurface }]}>Upload</Text>
                </TouchableOpacity>
              </View>
              {items.length > 0 ? (
                <TouchableOpacity onPress={() => setSelectMode(true)} style={styles.ghostBtn} activeOpacity={0.6}>
                  <Text style={[styles.ghostBtnText, { color: theme.colors.onSurfaceVariant }]}>Select</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>

        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[styles.listContent, items.length === 0 && styles.listContentEmpty]}
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
      </View>

      <BottomSheet visible={menuVisible} onDismiss={() => setMenuVisible(false)}>
        <View style={styles.menuContainer}>
          <Text style={[styles.menuHeader, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            {menuItem?.title ?? 'Note'}
          </Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              setMenuVisible(false);
              setRemoveTarget(menuItem);
            }}
            activeOpacity={0.6}
          >
            <View style={[styles.menuIconTile, { backgroundColor: 'rgba(220,38,38,0.12)' }]}>
              <MaterialCommunityIcons name="folder-remove-outline" size={20} color="#DC2626" />
            </View>
            <Text style={[styles.menuItemText, { color: '#DC2626' }]}>Remove from folder</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      <ConfirmModal
        visible={!!removeTarget}
        title="Remove from folder"
        message="This removes the note from this folder. It stays in your library."
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveTarget(null)}
        isLoading={isRemoving}
        loadingText="Removing..."
        destructive
      />

      <BottomSheet visible={pickerVisible} onDismiss={() => setPickerVisible(false)}>
        {pickerVisible ? (
          <AddNotesContent
            folderId={folderId}
            existingIds={existingIds}
            theme={theme}
            onClose={() => setPickerVisible(false)}
            onAdded={() => {
              invalidate();
              refetch();
            }}
          />
        ) : null}
      </BottomSheet>

      <UploadModal
        visible={uploadVisible}
        onDismiss={() => setUploadVisible(false)}
        sourceScreenForProgress="FolderDetail"
        folderId={folderId}
      />
    </>
  );
};

interface AddNotesContentProps {
  folderId: number;
  existingIds: Set<number>;
  theme: any;
  onClose: () => void;
  onAdded: () => void;
}

const AddNotesContent: React.FC<AddNotesContentProps> = ({
  folderId,
  existingIds,
  theme,
  onClose,
  onAdded,
}) => {
  const user = useAuthStore((state) => state.user);
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } = useUserContent(
    user?.id || null,
    PICKER_PAGE_SIZE
  );

  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [pendingId, setPendingId] = useState<number | null>(null);

  const notes = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.data?.content || []);
  }, [data?.pages]);

  const handleAdd = useCallback(
    async (item: ContentListItem) => {
      if (!user?.id) return;
      setPendingId(item.id);
      const result = await foldersService.addContentToFolder(item.id, folderId, user.id);
      setPendingId(null);
      if (result.success) {
        setAddedIds((prev) => new Set(prev).add(item.id));
        onAdded();
      }
    },
    [user?.id, folderId, onAdded]
  );

  return (
    <View style={styles.sheetContent}>
      <View style={styles.sheetHeader}>
        <Text variant="titleLarge" style={[styles.sheetHeaderText, { color: theme.colors.onSurface }]}>
          Add notes
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

      {isLoading ? (
        <View style={styles.sheetLoading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : notes.length === 0 ? (
        <Text style={[styles.sheetEmpty, { color: theme.colors.onSurfaceVariant }]}>
          No notes in your library yet
        </Text>
      ) : (
        <>
          {notes.map((item, index) => {
            const icon = typeIcon(item.content_type);
            const already = existingIds.has(item.id) || addedIds.has(item.id);
            const pending = pendingId === item.id;
            return (
              <View key={item.id}>
                {index > 0 ? (
                  <View style={[styles.sheetSeparator, { backgroundColor: theme.colors.outlineVariant }]} />
                ) : null}
                <TouchableOpacity
                  activeOpacity={0.7}
                  disabled={already || pending}
                  onPress={() => handleAdd(item)}
                  style={styles.sheetRow}
                >
                  <View style={[styles.sheetRowIcon, { backgroundColor: theme.colors.surfaceVariant }]}>
                    <MaterialCommunityIcons name={icon.name} size={20} color={icon.color} />
                  </View>
                  <Text
                    variant="bodyMedium"
                    numberOfLines={2}
                    style={[styles.sheetRowTitle, { color: theme.colors.onSurface }]}
                  >
                    {item.title}
                  </Text>
                  {pending ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : already ? (
                    <View style={[styles.addBtn, { backgroundColor: theme.colors.primaryContainer }]}>
                      <MaterialCommunityIcons name="check" size={18} color={theme.colors.onPrimaryContainer} />
                    </View>
                  ) : (
                    <View style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}>
                      <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
          {hasNextPage ? (
            <TouchableOpacity
              onPress={() => !isFetchingNextPage && fetchNextPage()}
              disabled={isFetchingNextPage}
              style={styles.loadMore}
              activeOpacity={0.7}
            >
              {isFetchingNextPage ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Text style={[styles.loadMoreText, { color: theme.colors.primary }]}>Load more</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bannerContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  pillText: {
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
  },
  ghostBtn: {
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  ghostBtnText: {
    fontSize: 15,
    fontFamily: Fonts.ui.semiBold,
  },
  toolbarCount: {
    fontSize: 15,
    fontFamily: Fonts.ui.semiBold,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 40,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#1E293B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 1 },
    }),
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.ui.medium,
    marginRight: 10,
    lineHeight: 21,
  },
  menuButton: {
    padding: 4,
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
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 14,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Fonts.ui.semiBold,
  },
  menuContainer: {
    width: '100%',
    paddingBottom: 4,
  },
  menuHeader: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 13,
    letterSpacing: 0.3,
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
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetContent: {
    width: '100%',
    paddingBottom: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sheetHeaderText: {
    fontFamily: Fonts.ui.bold,
    letterSpacing: -0.3,
  },
  sheetLoading: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  sheetSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 54,
  },
  sheetRowTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.ui.medium,
    marginRight: 12,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetEmpty: {
    textAlign: 'center',
    paddingVertical: 40,
    fontFamily: Fonts.ui.regular,
  },
  loadMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadMoreText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
  },
});

export default FolderDetailScreen;
