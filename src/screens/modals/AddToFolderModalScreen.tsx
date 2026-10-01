import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { FolderPickerList } from '@/components/content/AddToFolderSheet';
import type { AppStackParamList } from '@/types/navigation';

type AddToFolderModalRouteProp = RouteProp<AppStackParamList, 'AddToFolderModal'>;
type AddToFolderModalNavigationProp = NativeStackNavigationProp<AppStackParamList, 'AddToFolderModal'>;

const AddToFolderModalScreen: React.FC = () => {
  const navigation = useNavigation<AddToFolderModalNavigationProp>();
  const route = useRoute<AddToFolderModalRouteProp>();
  const { contentId } = route.params;
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const close = () => navigation.goBack();

  const sheet = (
    <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
      <View style={[styles.handle, { backgroundColor: theme.colors.outlineVariant }]} />
      <FolderPickerList contentId={contentId} onClose={close} />
    </View>
  );

  if (Platform.OS === 'android') {
    return (
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={close} />
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
});

export default AddToFolderModalScreen;
