import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text, FAB } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { useUserContent, prefetchContentDetail } from '@/api/queries/content';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { ContentCard } from '@/components/content/ContentCard';
import { PanelLoadError } from '@/components/ui/PanelLoadError';
import { USER_FACING_ERROR } from '@/utils/userFacingError';
import UploadModal from '@/components/upload/UploadModal';
import { tryShowLimitPaywall } from '@/utils/subscriptionErrorHandler';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AddToFolderSheet from '@/components/content/AddToFolderSheet';
import { contentService } from '@/services/contentService';
import type { ContentStackParamList } from '@/types/navigation';
import type { ContentListItem } from '@/api/schemas/content';
import { BRAND_COLORS } from '@/config/brand';

import { Fonts } from '@/config/fonts';

type NavigationProp = NativeStackNavigationProp<ContentStackParamList, 'ContentList'>;
type ContentListRouteProp = RouteProp<ContentStackParamList, 'ContentList'>;

const ITEMS_PER_PAGE = 10;

const ContentScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ContentListRouteProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [, setUploadError] = useState<string>('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuItem, setMenuItem] = useState<ContentListItem | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [addToFolderId, setAddToFolderId] = useState<number | null>(null);

  const {
    data: contentData,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
  } = useUserContent(user?.id || null, ITEMS_PER_PAGE);

  const content = useMemo(() => {
    if (!contentData?.pages) return [];
    return contentData.pages.flatMap((page) => page.data?.content || []);
  }, [contentData?.pages]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isLoading) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  const handleContentPress = useCallback(
    (item: ContentListItem) => {
      void prefetchContentDetail(item.id, user?.id ?? null);
      navigation.navigate('ContentDetail', { contentId: item.id });
    },
    [navigation, user?.id]
  );

  const handleOpenMenu = useCallback((item: ContentListItem) => {
    setMenuItem(item);
    setMenuVisible(true);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuVisible(false);
  }, []);

  const handleRequestDelete = useCallback(() => {
    setMenuVisible(false);
    setConfirmVisible(true);
  }, []);

  const handleAddToFolder = useCallback(() => {
    if (!menuItem) return;
    setMenuVisible(false);
    setAddToFolderId(menuItem.id);
  }, [menuItem]);

  const handleConfirmDelete = useCallback(async () => {
    if (!menuItem || !user?.id) return;
    setIsDeleting(true);
    const result = await contentService.deleteContent(menuItem.id, user.id);
    setIsDeleting(false);
    if (!result.success) {
      setConfirmVisible(false);
      setUploadError(result.message || 'Failed to delete content');
      return;
    }
    setConfirmVisible(false);
    setMenuItem(null);
    queryClient.invalidateQueries({ queryKey: ['content'] });
  }, [menuItem, queryClient, user?.id]);

  const handleCancelDelete = useCallback(() => {
    setConfirmVisible(false);
  }, []);

  useEffect(() => {
    const err = route.params?.error;
    if (!err) return;
    navigation.setParams({ error: undefined });
    if (tryShowLimitPaywall(err)) {
      return;
    }
    setUploadError(err);
  }, [route.params?.error, navigation]);

  const renderContentItem = useCallback(
    ({ item }: { item: ContentListItem }) => (
      <ContentCard item={item} onPress={handleContentPress} onMenuPress={handleOpenMenu} theme={theme} />
    ),
    [handleContentPress, handleOpenMenu, theme]
  );

  const renderEmptyState = () => {
    if (isLoading) return null;

    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.colors.background }]}>
        <MaterialCommunityIcons
          name="file-document-outline"
          size={64}
          color={theme.colors.onSurfaceVariant}
        />
        <Text variant="titleLarge" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
          No content yet
        </Text>
        <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
          Start adding content to build your library
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  };

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: themeMode === 'dark' ? '#09090B' : BRAND_COLORS.paper }]}>
        <PanelLoadError
          fill
          title="Couldn't load your notes"
          description={USER_FACING_ERROR.generic}
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
          data={content}
          renderItem={renderContentItem}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          contentContainerStyle={[
            styles.listContent,
            content.length === 0 && styles.listContentEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={themeMode === 'dark' ? '#7A9E86' : BRAND_COLORS.ink}
              colors={themeMode === 'dark' ? ['#7A9E86'] : [BRAND_COLORS.ink]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
        />
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          color="#FFFFFF"
          onPress={() => setUploadModalVisible(true)}
        />
      </View>
      <UploadModal
        visible={uploadModalVisible}
        onDismiss={() => setUploadModalVisible(false)}
        sourceScreenForProgress="ContentList"
      />
      <BottomSheet visible={menuVisible} onDismiss={handleCloseMenu}>
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.colors.surfaceVariant }]}
            onPress={handleAddToFolder}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="folder-plus-outline" size={22} color={theme.colors.onSurface} />
            <Text style={[styles.menuItemText, { color: theme.colors.onSurface }]}>Add to folder</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.colors.surfaceVariant }]}
            onPress={handleRequestDelete}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={22} color={theme.colors.error} />
            <Text style={[styles.menuItemText, { color: theme.colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
      <AddToFolderSheet
        visible={addToFolderId !== null}
        contentId={addToFolderId}
        onDismiss={() => setAddToFolderId(null)}
      />
      <ConfirmModal
        visible={confirmVisible}
        title="Delete content"
        message="Are you sure you want to delete this content? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
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
    paddingBottom: 100,
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
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 80,
  },
  menuContainer: {
    width: '100%',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontFamily: Fonts.ui.medium,
  },
});

export default ContentScreen;
