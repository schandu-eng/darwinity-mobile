import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { Fonts } from '@/config/fonts';
import {
  getAppIcon,
  listLauncherApps,
  type LauncherApp,
} from '@/features/concentration/focusShields/native';
import {
  loadFocusShieldPrefs,
  setFocusShieldPackages,
} from '@/features/concentration/focusShields/storage';

const iconCache = new Map<string, string>();

const AppIcon: React.FC<{ packageName: string }> = ({ packageName }) => {
  const [uri, setUri] = useState<string | null>(iconCache.get(packageName) ?? null);

  React.useEffect(() => {
    if (uri || !packageName) return;
    let live = true;
    void getAppIcon(packageName).then((base64) => {
      if (!live || !base64) return;
      const next = `data:image/png;base64,${base64}`;
      iconCache.set(packageName, next);
      setUri(next);
    });
    return () => {
      live = false;
    };
  }, [packageName, uri]);

  if (!uri) {
    return <View style={styles.iconPlaceholder} />;
  }
  return <Image source={{ uri }} style={styles.icon} />;
};

const FocusShieldAppPickerScreen: React.FC = () => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const [apps, setApps] = useState<LauncherApp[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const selectedRef = useRef<Set<string>>(new Set());
  const persistChain = useRef<Promise<unknown>>(Promise.resolve());

  const persist = useCallback((next: Set<string>) => {
    selectedRef.current = next;
    persistChain.current = persistChain.current
      .then(() => setFocusShieldPackages([...selectedRef.current]))
      .catch(() => undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void Promise.all([listLauncherApps(), loadFocusShieldPrefs()]).then(([nextApps, prefs]) => {
        if (cancelled) return;
        const nextSelected = new Set(prefs.packageNames);
        selectedRef.current = nextSelected;
        setApps(nextApps);
        setSelected(nextSelected);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? apps.filter(
          (app) => app.label.toLowerCase().includes(q) || app.packageName.toLowerCase().includes(q)
        )
      : apps;
    return [...list].sort((a, b) => {
      const aSel = selected.has(a.packageName) ? 0 : 1;
      const bSel = selected.has(b.packageName) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      return a.label.localeCompare(b.label);
    });
  }, [apps, search, selected]);

  const toggle = useCallback(
    (packageName: string) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(packageName)) next.delete(packageName);
        else next.add(packageName);
        persist(next);
        return next;
      });
    },
    [persist]
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
          { backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface },
        ]}
        placeholder="Search apps…"
        placeholderTextColor={theme.colors.onSurfaceVariant}
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        autoCapitalize="none"
      />
      <Text style={[styles.count, { color: theme.colors.onSurfaceVariant }]}>
        {selected.size} selected
      </Text>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.packageName}
        initialNumToRender={16}
        windowSize={8}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.packageName);
          return (
            <TouchableOpacity
              onPress={() => toggle(item.packageName)}
              style={styles.listItem}
              activeOpacity={0.65}
            >
              <AppIcon packageName={item.packageName} />
              <Text
                style={[styles.listItemText, { color: theme.colors.onSurface }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              <MaterialCommunityIcons
                name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={22}
                color={isSelected ? theme.colors.primary : theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  searchInput: {
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    fontFamily: Fonts.ui.regular,
  },
  count: {
    marginHorizontal: 24,
    marginBottom: 4,
    fontSize: 13,
    fontFamily: Fonts.ui.regular,
  },
  listContent: { paddingHorizontal: 24, paddingBottom: 32 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  listItemText: { flex: 1, fontSize: 16, fontFamily: Fonts.ui.regular },
  icon: { width: 36, height: 36, borderRadius: 8 },
  iconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E8E6E0',
  },
});

export default FocusShieldAppPickerScreen;
