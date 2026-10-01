import React, { memo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Folder } from '@/api/schemas/folders';

import { Fonts } from '@/config/fonts';

interface FolderCardProps {
  folder: Folder;
  onPress: (folder: Folder) => void;
  onMenuPress?: (folder: Folder) => void;
  theme: any;
}

const countLabel = (count?: number): string => {
  if (!count || count <= 0) return 'No notes yet';
  return `${count} ${count === 1 ? 'note' : 'notes'}`;
};

const FolderCardComponent: React.FC<FolderCardProps> = ({ folder, onPress, onMenuPress, theme }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(folder)}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}
    >
      <View style={[styles.iconTile, { backgroundColor: theme.colors.primaryContainer }]}>
        <MaterialCommunityIcons name="folder" size={24} color={theme.colors.onPrimaryContainer} />
      </View>
      <View style={styles.textContainer}>
        <Text variant="bodyLarge" numberOfLines={1} style={[styles.title, { color: theme.colors.onSurface }]}>
          {folder.name}
        </Text>
        <Text variant="bodySmall" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          {countLabel(folder.content_count)}
        </Text>
      </View>
      {onMenuPress ? (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onMenuPress(folder);
          }}
          style={styles.menuButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}
        >
          <MaterialCommunityIcons name="dots-horizontal" size={20} color={theme.colors.onSurfaceVariant} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  menuButton: {
    padding: 6,
    marginRight: -4,
  },
});

export const FolderCard = memo(
  FolderCardComponent,
  (prev, next) =>
    prev.folder.id === next.folder.id &&
    prev.folder.name === next.folder.name &&
    prev.folder.content_count === next.folder.content_count &&
    prev.theme === next.theme &&
    prev.onPress === next.onPress &&
    prev.onMenuPress === next.onMenuPress
);
