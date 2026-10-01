import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useAuthStore } from '@/store';
import { authEndpoints } from '@/api/endpoints/auth';

import { Fonts } from '@/config/fonts';

interface Language {
  code: string;
  name: string;
}

const ChangeLanguageScreen: React.FC = () => {
  const navigation = useNavigation();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const { user, setUser } = useAuthStore();

  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [currentCode, setCurrentCode] = useState(user?.preferredLanguage || 'en');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const list = await authEndpoints.getSupportedLanguages();
        setLanguages(list);
      } catch {
        Alert.alert('Error', 'Failed to load languages');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const code = user?.preferredLanguage || 'en';
      setCurrentCode(code);
    }, [user?.preferredLanguage])
  );

  const filteredLanguages = useMemo(() => {
    if (!search.trim()) return languages;
    const q = search.trim().toLowerCase();
    return languages.filter(
      (l) => l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)
    );
  }, [languages, search]);

  const handleSelect = useCallback(
    async (code: string) => {
      if (!user?.id || code === currentCode || saving) return;

      setSaving(true);
      try {
        await authEndpoints.updatePreferredLanguage(user.id, code);
        setCurrentCode(code);
        await setUser({ ...user, preferredLanguage: code });
        navigation.goBack();
      } catch (error: any) {
        const msg = error.response?.data?.detail || 'Failed to update language';
        Alert.alert('Error', msg);
      } finally {
        setSaving(false);
      }
    },
    [user, currentCode, saving, setUser, navigation]
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.surface }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <TextInput
        style={[
          styles.searchInput,
          {
            backgroundColor: theme.colors.surfaceVariant,
            color: theme.colors.onSurface,
          },
        ]}
        placeholder="Search language…"
        placeholderTextColor={theme.colors.onSurfaceVariant}
        value={search}
        onChangeText={setSearch}
      />
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filteredLanguages.map((lang) => {
          const isSelected = lang.code === currentCode;
          return (
            <TouchableOpacity
              key={lang.code}
              onPress={() => handleSelect(lang.code)}
              style={styles.listItem}
              activeOpacity={0.65}
              disabled={saving}
            >
              <Text
                style={[
                  styles.listItemText,
                  {
                    color: isSelected ? theme.colors.primary : theme.colors.onSurface,
                    fontWeight: isSelected ? '600' : '400',
                  },
                ]}
              >
                {lang.name}
              </Text>
              {isSelected ? (
                <MaterialCommunityIcons name="check" size={20} color={theme.colors.primary} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    fontFamily: Fonts.ui.regular,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.ui.regular,
  },
});

export default ChangeLanguageScreen;
