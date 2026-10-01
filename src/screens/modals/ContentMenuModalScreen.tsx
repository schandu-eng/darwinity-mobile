import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useContent } from '@/api/queries/content';
import type { AppStackParamList } from '@/types/navigation';

import { Fonts } from '@/config/fonts';

type ContentMenuModalRouteProp = RouteProp<AppStackParamList, 'ContentMenuModal'>;
type ContentMenuModalNavigationProp = NativeStackNavigationProp<AppStackParamList, 'ContentMenuModal'>;

const ContentMenuModalScreen: React.FC = () => {
  const navigation = useNavigation<ContentMenuModalNavigationProp>();
  const route = useRoute<ContentMenuModalRouteProp>();
  const { contentId } = route.params;
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const { data: contentData } = useContent(contentId);
  const content = contentData?.data;

  const handleRename = useCallback(() => {
    navigation.replace('RenameNoteModal', {
      contentId,
      currentTitle: content?.title || '',
    });
  }, [navigation, contentId, content?.title]);

  const handleExportPDF = useCallback(() => {
    navigation.replace('ExportModal', { contentId, type: 'pdf' });
  }, [navigation, contentId]);

  const handleAddToFolder = useCallback(() => {
    navigation.replace('AddToFolderModal', { contentId });
  }, [navigation, contentId]);

  const menuItems: Array<{
    id: string;
    label: string;
    icon: 'pencil' | 'file-pdf-box' | 'folder-plus-outline';
    onPress: () => void;
  }> = [
    { id: 'rename', label: 'Rename note', icon: 'pencil', onPress: handleRename },
    { id: 'folder', label: 'Add to folder', icon: 'folder-plus-outline', onPress: handleAddToFolder },
    { id: 'export', label: 'Export PDF', icon: 'file-pdf-box', onPress: handleExportPDF },
  ];

  const sheet = (
    <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
      <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />
      <View style={styles.menuContainer}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuItem, { borderBottomColor: theme.colors.surfaceVariant }]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name={item.icon} size={24} color={theme.colors.onSurface} />
            <Text style={[styles.menuItemText, { color: theme.colors.onSurface }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (Platform.OS === 'android') {
    return (
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={() => navigation.goBack()} />
        {sheet}
      </View>
    );
  }

  return sheet;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  menuContainer: {
    width: '100%',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemText: {
    fontSize: 16,
    fontFamily: Fonts.ui.regular,
    marginLeft: 16,
  },
});

export default ContentMenuModalScreen;
