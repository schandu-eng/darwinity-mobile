import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Headphones, Search, X } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { useAuthStore } from '@/store';
import { useUserContent } from '@/api/queries/content';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { HubHomeHeader } from '@/components/home/HubHomeHeader';
import { useCreateNote } from '@/components/navigation/CreateNoteContext';
import PodcastProGate from '@/components/study-hub/PodcastProGate';
import { activityLabelForItem, formatActivityRelative } from '@/utils/dashboardDateGroups';
import { Fonts } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';
import type { AppStackParamList } from '@/types/navigation';
import type { ContentListItem } from '@/api/schemas/content';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

const ITEMS_PER_PAGE = 40;

function noteTitle(item: ContentListItem): string {
  return (item.title || `Note ${item.id}`).trim();
}

const PodcastsLibraryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((state) => state.user);
  const { openCreateNote } = useCreateNote();
  const paper = themeMode === 'dark' ? '#09090B' : BRAND_COLORS.paper;
  const [searchTerm, setSearchTerm] = useState('');

  const {
    data: contentData,
    isLoading,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUserContent(user?.id || null, ITEMS_PER_PAGE);

  const notes = useMemo(() => {
    if (!contentData?.pages) return [];
    return contentData.pages.flatMap((page) => page.data?.content || []);
  }, [contentData?.pages]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((note) => noteTitle(note).toLowerCase().includes(q));
  }, [notes, searchTerm]);

  type ListRow =
    | { key: string; kind: 'section'; label: string }
    | { key: string; kind: 'note'; item: ContentListItem };

  const listRows = useMemo<ListRow[]>(() => {
    const generated = filtered.filter((n) => n.has_podcast);
    const pending = filtered.filter((n) => !n.has_podcast);
    const rows: ListRow[] = [];
    if (generated.length > 0) {
      rows.push({ key: 'section-generated', kind: 'section', label: 'Generated' });
      generated.forEach((item) => {
        rows.push({ key: `note-${item.id}`, kind: 'note', item });
      });
    }
    if (pending.length > 0) {
      rows.push({ key: 'section-notes', kind: 'section', label: 'Notes' });
      pending.forEach((item) => {
        rows.push({ key: `note-${item.id}`, kind: 'note', item });
      });
    }
    return rows;
  }, [filtered]);

  const openPodcast = useCallback(
    (item: ContentListItem) => {
      navigation.navigate('Content', {
        screen: 'Podcast',
        params: { contentId: item.id },
      });
    },
    [navigation]
  );

  const cardBg = themeMode === 'dark' ? '#111113' : '#FFFFFF';
  const cardBorder = themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)';
  const divider = themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : '#F4F4F5';
  const sectionBg = themeMode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(250,250,250,0.8)';
  const titleColor = themeMode === 'dark' ? '#F4F4F5' : '#18181B';
  const metaColor = themeMode === 'dark' ? '#A1A1AA' : '#71717A';
  const sectionColor = themeMode === 'dark' ? '#D4D4D8' : '#3F3F46';

  const renderItem = useCallback(
    ({ item, index }: { item: ListRow; index: number }) => {
      const isFirst = index === 0;
      const isLast = index === listRows.length - 1;
      const wrapStyle = [
        styles.cardRow,
        { backgroundColor: cardBg, borderColor: cardBorder },
        !isLast && { borderBottomColor: divider },
        isFirst && styles.cardRowFirst,
        isLast && styles.cardRowLast,
      ];

      if (item.kind === 'section') {
        return (
          <View style={[wrapStyle, { backgroundColor: sectionBg }]}>
            <Text style={[styles.sectionLabel, { color: sectionColor }]}>{item.label}</Text>
          </View>
        );
      }

      const ready = Boolean(item.item.has_podcast);
      const { at } = activityLabelForItem(item.item);
      const rel = formatActivityRelative(at);
      const meta = ready
        ? rel
          ? `Ready to play · ${rel}`
          : 'Ready to play'
        : rel
          ? `Tap to generate · ${rel}`
          : 'Tap to generate';
      return (
        <TouchableOpacity
          style={[wrapStyle, styles.row]}
          onPress={() => openPodcast(item.item)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.rowIcon,
              {
                backgroundColor: ready
                  ? themeMode === 'dark'
                    ? 'rgba(63,107,79,0.2)'
                    : 'rgba(63,107,79,0.14)'
                  : themeMode === 'dark'
                    ? 'rgba(255,255,255,0.08)'
                    : '#F4F4F5',
              },
            ]}
          >
            <Headphones
              size={16}
              strokeWidth={ICON_STROKE}
              color={
                ready
                  ? themeMode === 'dark'
                    ? '#9BB8A6'
                    : BRAND_COLORS.ink
                  : themeMode === 'dark'
                    ? '#A1A1AA'
                    : '#71717A'
              }
            />
          </View>
          <View style={styles.rowText}>
            <Text numberOfLines={1} style={[styles.rowTitle, { color: titleColor }]}>
              {noteTitle(item.item)}
            </Text>
            <Text style={[styles.rowMeta, { color: metaColor }]}>{meta}</Text>
          </View>
          <View
            style={[
              styles.badge,
              ready
                ? { backgroundColor: BRAND_COLORS.ink }
                : {
                    backgroundColor: themeMode === 'dark' ? '#111113' : '#FFFFFF',
                    borderWidth: 1,
                    borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(26,47,35,0.2)',
                  },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: ready ? '#FFFFFF' : themeMode === 'dark' ? '#9BB8A6' : BRAND_COLORS.ink },
              ]}
            >
              {ready ? 'Listen' : 'Generate'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [cardBg, cardBorder, divider, listRows.length, metaColor, openPodcast, sectionBg, sectionColor, themeMode, titleColor]
  );

  return (
    <View style={[styles.container, { backgroundColor: paper }]}>
      <HubHomeHeader showFeedback={false} />
      <PodcastProGate>
      <View style={styles.page}>
        <View style={styles.titleRow}>
          <View
            style={[
              styles.titleIcon,
              { backgroundColor: themeMode === 'dark' ? 'rgba(63,107,79,0.2)' : 'rgba(63,107,79,0.14)' },
            ]}
          >
            <Headphones
              size={20}
              strokeWidth={ICON_STROKE}
              color={themeMode === 'dark' ? '#9BB8A6' : BRAND_COLORS.ink}
            />
          </View>
          <Text style={[styles.headerTitle, { color: themeMode === 'dark' ? '#FAFAFA' : '#18181B' }]}>
            Podcasts
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.createNoteBtn,
            {
              backgroundColor: themeMode === 'dark' ? '#111113' : '#FFFFFF',
              borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(26,47,35,0.15)',
            },
          ]}
          onPress={() => openCreateNote('podcast')}
          activeOpacity={0.85}
        >
          <Text style={[styles.createNoteBtnText, { color: themeMode === 'dark' ? '#9BB8A6' : BRAND_COLORS.ink }]}>
            Create a note
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.search,
            {
              backgroundColor: themeMode === 'dark' ? '#111113' : '#FFFFFF',
              borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)',
            },
          ]}
        >
          <Search
            size={16}
            strokeWidth={2.5}
            color={themeMode === 'dark' ? '#A1A1AA' : 'rgba(26,47,35,0.7)'}
          />
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search notes…"
            placeholderTextColor={themeMode === 'dark' ? '#71717A' : '#A1A1AA'}
            style={[styles.searchInput, { color: themeMode === 'dark' ? '#F4F4F5' : '#18181B' }]}
            autoCorrect={false}
          />
          {searchTerm ? (
            <TouchableOpacity onPress={() => setSearchTerm('')} hitSlop={8}>
              <X size={14} strokeWidth={2.5} color={themeMode === 'dark' ? '#A1A1AA' : '#A1A1AA'} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {isLoading && notes.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={listRows}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={themeMode === 'dark' ? '#7A9E86' : BRAND_COLORS.ink}
              colors={[themeMode === 'dark' ? '#7A9E86' : BRAND_COLORS.ink]}
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          contentContainerStyle={
            listRows.length === 0 ? styles.emptyList : styles.listContent
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View
                style={[styles.emptyIcon, { backgroundColor: themeMode === 'dark' ? 'rgba(63,107,79,0.2)' : 'rgba(63,107,79,0.12)' }]}
              >
                <Headphones size={22} strokeWidth={ICON_STROKE} color={theme.colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                {searchTerm ? 'No notes match your search' : 'No notes yet'}
              </Text>
              <Text style={[styles.emptyBody, { color: theme.colors.onSurfaceVariant }]}>
                {searchTerm
                  ? 'Try a different search, or clear the filter.'
                  : 'Create a note, then we will generate the podcast and take you there.'}
              </Text>
              {!searchTerm ? (
                <TouchableOpacity
                  style={[styles.createBtn, { backgroundColor: BRAND_COLORS.ink }]}
                  onPress={() => openCreateNote('podcast')}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.createBtnText, { color: '#FAFAFA' }]}>
                    Create a note
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}
      </PodcastProGate>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  page: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  titleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.ui.bold,
    fontSize: 24,
    letterSpacing: -0.6,
  },
  createNoteBtn: {
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(26,47,35,0.04)' },
      default: {
        shadowColor: BRAND_COLORS.ink,
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      },
    }),
  },
  createNoteBtnText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
  },
  search: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(26,47,35,0.04)' },
      default: {
        shadowColor: BRAND_COLORS.ink,
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.ui.regular,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  cardRow: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  cardRowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardRowLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  sectionLabel: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontFamily: Fonts.ui.medium, fontSize: 14, lineHeight: 20 },
  rowMeta: { marginTop: 2, fontSize: 12, lineHeight: 16, fontFamily: Fonts.ui.regular },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontFamily: Fonts.ui.semiBold },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontFamily: Fonts.ui.medium, fontSize: 14 },
  emptyBody: { fontSize: 14, textAlign: 'center', fontFamily: Fonts.ui.regular, lineHeight: 20 },
  createBtn: {
    marginTop: 16,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  createBtnText: { fontFamily: Fonts.ui.semiBold, fontSize: 14 },
});

export default PodcastsLibraryScreen;
