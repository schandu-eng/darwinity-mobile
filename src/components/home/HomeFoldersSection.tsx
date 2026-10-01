import React, { useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/store';
import { useRecentFoldersStore } from '@/store/recentFoldersStore';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useUserFolders } from '@/api/queries/folders';
import type { AppStackParamList } from '@/types/navigation';
import type { Folder } from '@/api/schemas/folders';

import { Fonts } from '@/config/fonts';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

const HomeFoldersSection: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((state) => state.user);
  const { data } = useUserFolders(user?.id || null);

  const openOrder = useRecentFoldersStore((s) => s.openOrder);
  const hydrateRecents = useRecentFoldersStore((s) => s.hydrate);

  useEffect(() => {
    hydrateRecents();
  }, [hydrateRecents]);

  const folders = data?.data ?? [];

  const orderedFolders = useMemo(() => {
    const rank = new Map(openOrder.map((id, i) => [id, i]));
    return [...folders].sort((a, b) => {
      const ra = rank.has(a.id) ? (rank.get(a.id) as number) : Infinity;
      const rb = rank.has(b.id) ? (rank.get(b.id) as number) : Infinity;
      return ra - rb;
    });
  }, [folders, openOrder]);

  const goToFolders = useCallback(() => {
    navigation.navigate('Content', { screen: 'Folders' });
  }, [navigation]);

  const openFolder = useCallback(
    (folder: Folder) => {
      navigation.navigate('Content', {
        screen: 'FolderDetail',
        params: { folderId: folder.id, folderName: folder.name },
      });
    },
    [navigation]
  );

  if (folders.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <TouchableOpacity
          onPress={goToFolders}
          activeOpacity={0.85}
          style={[styles.newFolderButton, { backgroundColor: theme.colors.primaryContainer }]}
        >
          <MaterialCommunityIcons name="folder-plus-outline" size={18} color={theme.colors.onPrimaryContainer} />
          <Text style={[styles.newFolderText, { color: theme.colors.onPrimaryContainer }]}>New folder</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
          Folders
        </Text>
        <TouchableOpacity onPress={goToFolders} activeOpacity={0.6} style={styles.seeAll}>
          <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>See all</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        {orderedFolders.slice(0, 2).map((folder) => (
          <TouchableOpacity
            key={folder.id}
            onPress={() => openFolder(folder)}
            activeOpacity={0.85}
            style={[
              styles.chip,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
            ]}
          >
            <View style={[styles.chipIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialCommunityIcons name="folder" size={18} color={theme.colors.onPrimaryContainer} />
            </View>
            <View style={styles.chipText}>
              <Text
                variant="bodyMedium"
                numberOfLines={1}
                style={[styles.chipTitle, { color: theme.colors.onSurface }]}
              >
                {folder.name}
              </Text>
              <Text style={[styles.chipCount, { color: theme.colors.onSurfaceVariant }]}>
                {folder.content_count ?? 0} {(folder.content_count ?? 0) === 1 ? 'note' : 'notes'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  emptyContainer: {
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  newFolderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  newFolderText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  chipIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    flex: 1,
  },
  chipTitle: {
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: -0.1,
  },
  chipCount: {
    fontFamily: Fonts.ui.regular,
    fontSize: 12,
    marginTop: 1,
  },
});

export default HomeFoldersSection;
