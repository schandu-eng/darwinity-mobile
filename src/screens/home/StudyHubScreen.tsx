import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Pressable,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Check, ChevronDown, Download, Folder as FolderIcon, FolderPlus, LayoutGrid, List, ListFilter, Search, Trash2, X } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store';
import { useActiveJobsStore } from '@/store/activeJobsStore';
import { useUserContent, prefetchContentDetail } from '@/api/queries/content';
import { useUserFolders } from '@/api/queries/folders';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { ContentCard } from '@/components/content/ContentCard';
import ProcessingJobsSection from '@/components/home/ProcessingJobsSection';
import BillingPlanLimitBanner from '@/components/ui/SubscriptionLimitBanner';
import { showUpgradePaywall, tryShowLimitPaywall } from '@/utils/subscriptionErrorHandler';
import BottomSheet from '@/components/ui/BottomSheet';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AddToFolderSheet from '@/components/content/AddToFolderSheet';
import { contentService } from '@/services/contentService';
import { foldersService } from '@/services/foldersService';
import type { AppStackParamList, HomeTabParamList } from '@/types/navigation';
import type { ContentListItem } from '@/api/schemas/content';
import type { Folder } from '@/api/schemas/folders';
import { HubHomeHeader } from '@/components/home/HubHomeHeader';
import { HubCreateCards, type CreateCardId } from '@/components/home/HubCreateCards';
import { HubNotesEmpty } from '@/components/home/HubNotesEmpty';
import { HubNotesSkeleton } from '@/components/home/HubNotesSkeleton';
import { PanelLoadError } from '@/components/ui/PanelLoadError';
import { TourAnchor } from '@/components/ui/feature-tour';
import { useCreateNote } from '@/components/navigation/CreateNoteContext';
import { usePodcastPlaybackOptional } from '@/features/podcast/PodcastPlaybackContext';
import { getActivityAt, groupNotesByActivityDate } from '@/utils/dashboardDateGroups';
import { Fonts } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type HomeRouteProp = RouteProp<HomeTabParamList, 'HomeFeed'>;

const ITEMS_PER_PAGE = 20;

const FILTER_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'folders', label: 'Folders' },
  { value: 'notes', label: 'Notes' },
  { value: 'pdf', label: 'PDF' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'audio_recording', label: 'Audio' },
] as const;

const StudyHubScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<HomeRouteProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [subscriptionLimitMessage, setBillingPlanLimitMessage] = useState<string>('');
  const [, setUploadError] = useState<string>('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuItem, setMenuItem] = useState<ContentListItem | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [addToFolderId, setAddToFolderId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [notesSort, setNotesSort] = useState<'newest' | 'oldest'>('newest');
  const [searchFilter, setSearchFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createFolderNoteIds, setCreateFolderNoteIds] = useState<Set<number>>(() => new Set());
  const [createFolderNoteQuery, setCreateFolderNoteQuery] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const initializeActiveJobs = useActiveJobsStore((state) => state.initialize);
  const { openCreateNote, openCreateOption } = useCreateNote();
  const podcastPlayback = usePodcastPlaybackOptional();
  const miniPlayerPad = podcastPlayback?.session.active ? 88 : 0;
  const { data: foldersData } = useUserFolders(user?.id || null);

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

  useEffect(() => {
    initializeActiveJobs();
  }, [initializeActiveJobs]);

  useEffect(() => {
    const limitMessage = route.params?.subscriptionLimitMessage;
    if (!limitMessage) return;
    navigation.setParams({ subscriptionLimitMessage: undefined });
    if (tryShowLimitPaywall(limitMessage)) {
      return;
    }
    setBillingPlanLimitMessage(limitMessage);
    const timer = setTimeout(() => setBillingPlanLimitMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [route.params?.subscriptionLimitMessage, navigation]);

  useEffect(() => {
    const err = route.params?.error;
    if (!err) return;
    navigation.setParams({ error: undefined });
    if (tryShowLimitPaywall(err)) {
      return;
    }
    setUploadError(err);
  }, [route.params?.error, navigation]);

  const handleUpgradeToPro = useCallback(async () => {
    showUpgradePaywall(subscriptionLimitMessage || 'Upgrade to Pro to continue.', 'content');
  }, [subscriptionLimitMessage]);

  const content = useMemo(() => {
    if (!contentData?.pages) return [];
    return contentData.pages.flatMap((page) => page.data?.content || []);
  }, [contentData?.pages]);

  const folders = foldersData?.data ?? [];

  const filteredNotes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let next = content;
    if (q) next = next.filter((item) => item.title.toLowerCase().includes(q));
    if (searchFilter === 'folders') return [];
    if (searchFilter === 'pdf') next = next.filter((item) => item.content_type === 'PDF');
    else if (searchFilter === 'youtube') next = next.filter((item) => item.content_type === 'YOUTUBE');
    else if (searchFilter === 'audio_recording') {
      next = next.filter((item) => item.content_type === 'AUDIO_RECORDING');
    }
    // 'notes' / 'all' keep all content types (folders already excluded above for folders-only)
    const dir = notesSort === 'newest' ? -1 : 1;
    return [...next].sort((a, b) => {
      const da = getActivityAt(a)?.getTime() ?? 0;
      const db = getActivityAt(b)?.getTime() ?? 0;
      return (da - db) * dir;
    });
  }, [content, searchTerm, notesSort, searchFilter]);

  const filteredFolders = useMemo(() => {
    const isSourceFilter =
      searchFilter === 'pdf' || searchFilter === 'youtube' || searchFilter === 'audio_recording';
    if (searchFilter === 'notes' || isSourceFilter) return [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((folder) => folder.name.toLowerCase().includes(q));
  }, [folders, searchTerm, searchFilter]);

  const totalItems = filteredFolders.length + filteredNotes.length;

  const createFolderNoteChoices = useMemo(() => {
    const q = createFolderNoteQuery.toLowerCase().trim();
    const list = !q
      ? content
      : content.filter((item) => (item.title || '').toLowerCase().includes(q));
    return list.slice(0, 80);
  }, [content, createFolderNoteQuery]);

  type ListRow =
    | { key: string; kind: 'section'; label: string }
    | { key: string; kind: 'note'; item: ContentListItem }
    | { key: string; kind: 'folder'; folder: Folder };

  const listRows = useMemo<ListRow[]>(() => {
    const rows: ListRow[] = [];
    if (viewMode === 'grid') {
      if (filteredFolders.length > 0) {
        rows.push({ key: 'section-folders', kind: 'section', label: 'Folders' });
        filteredFolders.forEach((folder) => {
          rows.push({ key: `folder-${folder.id}`, kind: 'folder', folder });
        });
      }
      if (filteredNotes.length > 0) {
        const noteGroups = groupNotesByActivityDate(filteredNotes);
        if (filteredFolders.length > 0 || noteGroups.length > 1) {
          rows.push({ key: 'section-notes', kind: 'section', label: 'Notes' });
        }
        filteredNotes.forEach((item) => {
          rows.push({ key: `note-${item.id}`, kind: 'note', item });
        });
      }
      return rows;
    }
    if (filteredFolders.length > 0) {
      rows.push({ key: 'section-folders', kind: 'section', label: 'Folders' });
      filteredFolders.forEach((folder) => {
        rows.push({ key: `folder-${folder.id}`, kind: 'folder', folder });
      });
    }
    groupNotesByActivityDate(filteredNotes).forEach((group) => {
      rows.push({ key: `section-${group.id}`, kind: 'section', label: group.label });
      group.items.forEach((item) => {
        rows.push({ key: `note-${item.id}`, kind: 'note', item });
      });
    });
    return rows;
  }, [filteredFolders, filteredNotes, viewMode]);

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
      navigation.navigate('Content', {
        screen: 'ContentDetail',
        params: { contentId: item.id },
      });
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

  const handleOpenExportModal = useCallback(() => {
    if (!menuItem) return;
    const targetItem = menuItem;
    setMenuVisible(false);
    navigation.navigate('ExportModal', { contentId: targetItem.id, type: 'pdf' });
  }, [menuItem, navigation]);

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

  const handleCreate = useCallback(
    (id: CreateCardId) => {
      openCreateOption(id);
    },
    [openCreateOption]
  );

  const handleFolderPress = useCallback(
    (folder: Folder) => {
      navigation.navigate('Content', {
        screen: 'FolderDetail',
        params: { folderId: folder.id, folderName: folder.name },
      });
    },
    [navigation]
  );

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name || !user?.id) return;
    setIsCreatingFolder(true);
    const result = await foldersService.createFolder(name, user.id);
    if (!result.success || !result.data) {
      setIsCreatingFolder(false);
      setUploadError(result.message || 'Failed to create folder');
      return;
    }
    const folderId = result.data.id;
    const selectedIds = [...createFolderNoteIds];
    if (selectedIds.length > 0) {
      await Promise.allSettled(
        selectedIds.map((contentId) =>
          foldersService.addContentToFolder(contentId, folderId, user.id)
        )
      );
    }
    setIsCreatingFolder(false);
    setShowCreateFolderModal(false);
    setNewFolderName('');
    setCreateFolderNoteIds(new Set());
    setCreateFolderNoteQuery('');
    queryClient.invalidateQueries({ queryKey: ['folders'] });
    queryClient.invalidateQueries({ queryKey: ['content'] });
  }, [newFolderName, user?.id, queryClient, createFolderNoteIds]);

  const toggleCreateFolderNote = useCallback((contentId: number) => {
    setCreateFolderNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(contentId)) next.delete(contentId);
      else next.add(contentId);
      return next;
    });
  }, []);

  const resetCreateFolderModal = useCallback(() => {
    setShowCreateFolderModal(false);
    setNewFolderName('');
    setCreateFolderNoteIds(new Set());
    setCreateFolderNoteQuery('');
  }, []);

  const cardBg = themeMode === 'dark' ? '#111113' : '#FFFFFF';
  const cardBorder = themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)';
  const divider = themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : '#F4F4F5';
  const sectionBg = themeMode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(250,250,250,0.8)';
  const titleColor = themeMode === 'dark' ? '#F4F4F5' : '#18181B';
  const metaColor = themeMode === 'dark' ? '#A1A1AA' : '#71717A';
  const sectionColor = themeMode === 'dark' ? '#D4D4D8' : '#3F3F46';

  const renderContentItem = useCallback(
    ({ item, index }: { item: ListRow; index: number }) => {
      const isGrid = viewMode === 'grid';
      const isFirst = index === 0;
      const isLast = index === listRows.length - 1;
      const wrapStyle = isGrid
        ? [
            styles.gridCard,
            { backgroundColor: cardBg, borderColor: cardBorder },
            item.kind === 'section' && styles.gridSection,
          ]
        : [
            styles.listRow,
            { backgroundColor: cardBg, borderColor: cardBorder },
            !isLast && { borderBottomColor: divider },
            isFirst && styles.listRowFirst,
            isLast && styles.listRowLast,
          ];

      if (item.kind === 'section') {
        return (
          <View
            style={[
              wrapStyle,
              isGrid && styles.gridSectionFull,
              !isGrid && { backgroundColor: sectionBg },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: sectionColor }]}>{item.label}</Text>
          </View>
        );
      }
      if (item.kind === 'folder') {
        if (isGrid) {
          return (
            <TouchableOpacity
              style={[wrapStyle, styles.gridFolder]}
              onPress={() => handleFolderPress(item.folder)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.gridFolderIcon,
                  { backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : '#F4F4F5' },
                ]}
              >
                <FolderIcon size={20} strokeWidth={ICON_STROKE} color={themeMode === 'dark' ? '#D4D4D8' : '#52525B'} />
              </View>
              <Text numberOfLines={2} style={[styles.folderTitleGrid, { color: titleColor }]}>
                {item.folder.name}
              </Text>
              <Text style={[styles.folderMeta, { color: metaColor }]}>
                {(item.folder.content_count ?? 0) === 0
                  ? 'Add your first note'
                  : `${item.folder.content_count} ${(item.folder.content_count ?? 0) === 1 ? 'note' : 'notes'}`}
              </Text>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity
            style={[wrapStyle, styles.folderRow]}
            onPress={() => handleFolderPress(item.folder)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.folderIcon,
                { backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : '#F4F4F5' },
              ]}
            >
              <FolderIcon size={16} strokeWidth={ICON_STROKE} color={themeMode === 'dark' ? '#D4D4D8' : '#52525B'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[styles.folderTitle, { color: titleColor }]}>
                {item.folder.name}
              </Text>
              <Text style={[styles.folderMeta, { color: metaColor }]}>
                {(item.folder.content_count ?? 0) === 0
                  ? 'Empty folder'
                  : `${item.folder.content_count} ${(item.folder.content_count ?? 0) === 1 ? 'note' : 'notes'}`}
              </Text>
            </View>
          </TouchableOpacity>
        );
      }
      return (
        <View style={wrapStyle}>
          <ContentCard
            item={item.item}
            onPress={handleContentPress}
            onMenuPress={handleOpenMenu}
            theme={theme}
            variant={isGrid ? 'grid' : 'list'}
          />
        </View>
      );
    },
    [handleContentPress, handleOpenMenu, handleFolderPress, theme, themeMode, cardBg, cardBorder, divider, sectionBg, sectionColor, titleColor, metaColor, viewMode, listRows.length]
  );

  const renderEmptyState = () => {
    if (isLoading) return <HubNotesSkeleton variant={viewMode} />;
    return <HubNotesEmpty onUpload={openCreateNote} />;
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  };

  const filterLabel = FILTER_OPTIONS.find((o) => o.value === searchFilter)?.label || 'All types';

  const renderListHeader = useCallback(
    () => (
      <>
        <HubCreateCards userName={user?.name} onSelect={handleCreate} />
        <ProcessingJobsSection />
        <TourAnchor stepId="my-notes" style={styles.notesHead}>
          <Text style={[styles.notesTitle, { color: themeMode === 'dark' ? '#F4F4F5' : '#18181B' }]}>My Notes</Text>
          <View style={[styles.countPill, { backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(63,107,79,0.14)' }]}>
            <Text style={[styles.countText, { color: themeMode === 'dark' ? '#D4D4D8' : BRAND_COLORS.ink }]}>
              {totalItems} {totalItems === 1 ? 'note' : 'notes'}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <TourAnchor stepId="organize">
            <Pressable
              onPress={() => setShowCreateFolderModal(true)}
              style={({ pressed }) => [styles.newFolderBtn, { backgroundColor: BRAND_COLORS.ink, opacity: pressed ? 0.85 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="New Folder"
            >
              <FolderPlus size={16} strokeWidth={2.25} color="#FAFAFA" />
            </Pressable>
          </TourAnchor>
          <View style={[styles.viewToggle, { backgroundColor: themeMode === 'dark' ? '#111113' : '#FFFFFF', borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)' }]}>
            <Pressable onPress={() => setViewMode('list')} style={[styles.viewToggleBtn, viewMode === 'list' && { backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(63,107,79,0.14)' }]}>
              <List size={16} strokeWidth={ICON_STROKE} color={viewMode === 'list' ? (themeMode === 'dark' ? '#FAFAFA' : BRAND_COLORS.ink) : '#A1A1AA'} />
            </Pressable>
            <Pressable onPress={() => setViewMode('grid')} style={[styles.viewToggleBtn, viewMode === 'grid' && { backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(63,107,79,0.14)' }]}>
              <LayoutGrid size={16} strokeWidth={ICON_STROKE} color={viewMode === 'grid' ? (themeMode === 'dark' ? '#FAFAFA' : BRAND_COLORS.ink) : '#A1A1AA'} />
            </Pressable>
          </View>
        </TourAnchor>
        <TourAnchor stepId="search-filter">
        <ScrollView
          horizontal
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.searchToolbarScroll}
          contentContainerStyle={styles.searchToolbarRow}
        >
          <View style={[styles.search, { backgroundColor: themeMode === 'dark' ? '#111113' : '#FFFFFF', borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)' }]}>
            <Search size={16} strokeWidth={2.5} color={themeMode === 'dark' ? '#A1A1AA' : 'rgba(26,47,35,0.7)'} />
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search notes..."
              placeholderTextColor={themeMode === 'dark' ? '#71717A' : '#A1A1AA'}
              style={[styles.searchInput, { color: theme.colors.onSurface }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchTerm ? (
              <TouchableOpacity onPress={() => setSearchTerm('')} hitSlop={8}>
                <X size={14} strokeWidth={2.5} color={theme.colors.onSurfaceVariant} />
              </TouchableOpacity>
            ) : null}
          </View>
          <Pressable
            onPress={() => setFilterDropdownOpen((v) => !v)}
            style={[
              styles.filterBtn,
              {
                backgroundColor: themeMode === 'dark' ? '#111113' : '#FFFFFF',
                borderColor: searchFilter !== 'all'
                  ? (themeMode === 'dark' ? 'rgba(122,158,134,0.4)' : 'rgba(63,107,79,0.35)')
                  : (themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)'),
              },
            ]}
          >
            <ListFilter size={16} strokeWidth={2.25} color={searchFilter !== 'all' ? BRAND_COLORS.ink : theme.colors.onSurfaceVariant} />
            <Text style={[styles.filterLabel, { color: searchFilter !== 'all' ? BRAND_COLORS.ink : theme.colors.onSurface }]}>{filterLabel}</Text>
            <ChevronDown size={14} strokeWidth={2.25} color={theme.colors.onSurfaceVariant} style={{ opacity: 0.5 }} />
          </Pressable>
          <View
            style={[
              styles.sortRow,
              {
                backgroundColor: themeMode === 'dark' ? '#111113' : '#FFFFFF',
                borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)',
              },
            ]}
          >
            {(['newest', 'oldest'] as const).map((value) => {
              const active = notesSort === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setNotesSort(value)}
                  style={[
                    styles.sortBtn,
                    {
                      backgroundColor: active
                        ? themeMode === 'dark'
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(63,107,79,0.14)'
                        : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortLabel,
                      { color: active ? (themeMode === 'dark' ? '#FAFAFA' : BRAND_COLORS.ink) : theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {value === 'newest' ? 'Newest' : 'Oldest'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        </TourAnchor>
        {filterDropdownOpen && (
          <View style={[styles.filterDropdown, { backgroundColor: themeMode === 'dark' ? '#1A1A1E' : '#FFFFFF', borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
            {FILTER_OPTIONS.map((opt) => {
              const selected = searchFilter === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => { setSearchFilter(opt.value); setFilterDropdownOpen(false); }}
                  style={[styles.filterOption, selected && { backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(63,107,79,0.06)' }]}
                >
                  <Text style={[styles.filterOptionText, { color: selected ? BRAND_COLORS.ink : theme.colors.onSurface }]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </>
    ),
    [handleCreate, user?.name, theme, themeMode, totalItems, searchTerm, notesSort, searchFilter, filterLabel, filterDropdownOpen, viewMode]
  );

  if (error) {
    const paper = themeMode === 'dark' ? '#09090B' : BRAND_COLORS.paper;
    return (
      <View style={[styles.container, { backgroundColor: paper }]}>
        <HubHomeHeader />
        <ScrollView
          contentContainerStyle={styles.errorScroll}
          showsVerticalScrollIndicator={false}
        >
          <HubCreateCards userName={user?.name} onSelect={handleCreate} />
          <View style={styles.notesHead}>
            <Text style={[styles.notesTitle, { color: themeMode === 'dark' ? '#F4F4F5' : '#18181B' }]}>
              My Notes
            </Text>
          </View>
          <PanelLoadError
            title="Couldn't load your notes"
            description="Something went wrong. Check your connection and try again."
            onRetry={() => {
              void refetch();
            }}
            retrying={isRefetching}
          />
        </ScrollView>
      </View>
    );
  }

  const paper = themeMode === 'dark' ? '#09090B' : BRAND_COLORS.paper;

  return (
    <>
      <View style={[styles.container, { backgroundColor: paper }]}>
        <HubHomeHeader />
        {subscriptionLimitMessage ? (
          <View style={styles.bannerContainer}>
            <BillingPlanLimitBanner
              message={subscriptionLimitMessage}
              onUpgrade={handleUpgradeToPro}
              onDismiss={() => setBillingPlanLimitMessage('')}
            />
          </View>
        ) : null}
        <FlatList
          data={listRows}
          renderItem={renderContentItem}
          keyExtractor={(item) => item.key}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          contentContainerStyle={[
            styles.listContent,
            listRows.length === 0 && styles.listContentEmpty,
            miniPlayerPad ? { paddingBottom: 24 + miniPlayerPad } : null,
          ]}
          key={viewMode}
          numColumns={1}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={themeMode === 'dark' ? '#7A9E86' : BRAND_COLORS.ink}
              colors={[themeMode === 'dark' ? '#7A9E86' : BRAND_COLORS.ink]}
              progressBackgroundColor={themeMode === 'dark' ? theme.colors.surface : '#FFFFFF'}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={10}
          showsVerticalScrollIndicator={false}
        />
      </View>
      <BottomSheet visible={menuVisible} onDismiss={handleCloseMenu}>
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.colors.surfaceVariant }]}
            onPress={handleAddToFolder}
            activeOpacity={0.8}
          >
            <FolderPlus size={22} strokeWidth={ICON_STROKE} color={theme.colors.onSurface} />
            <Text style={[styles.menuItemText, { color: theme.colors.onSurface }]}>Add to folder</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.colors.surfaceVariant }]}
            onPress={handleOpenExportModal}
            activeOpacity={0.8}
          >
            <Download size={22} strokeWidth={ICON_STROKE} color={theme.colors.onSurface} />
            <Text style={[styles.menuItemText, { color: theme.colors.onSurface }]}>Export PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: theme.colors.surfaceVariant }]}
            onPress={handleRequestDelete}
            activeOpacity={0.8}
          >
            <Trash2 size={22} strokeWidth={ICON_STROKE} color={theme.colors.error} />
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
      {/* Create folder modal — matches web Create New Folder */}
      <Modal visible={showCreateFolderModal} transparent animationType="fade" onRequestClose={resetCreateFolderModal}>
        <Pressable style={styles.modalBackdrop} onPress={resetCreateFolderModal}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: themeMode === 'dark' ? '#1A1A1E' : '#FFFFFF' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHead}>
              <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>Create New Folder</Text>
              <Pressable onPress={resetCreateFolderModal} hitSlop={8} accessibilityLabel="Close">
                <X size={18} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />
              </Pressable>
            </View>
            <Text style={[styles.modalSub, { color: theme.colors.onSurfaceVariant }]}>
              Name the folder, then optionally pick notes to add.
            </Text>
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Folder name..."
              placeholderTextColor={theme.colors.onSurfaceVariant}
              style={[styles.modalInput, { color: theme.colors.onSurface, borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }]}
              autoFocus
            />
            <Text style={[styles.modalSectionLabel, { color: theme.colors.onSurface }]}>
              Add notes ({createFolderNoteIds.size} selected)
            </Text>
            <View style={[styles.modalSearch, { borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }]}>
              <Search size={16} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />
              <TextInput
                value={createFolderNoteQuery}
                onChangeText={setCreateFolderNoteQuery}
                placeholder="Search notes to add..."
                placeholderTextColor={theme.colors.onSurfaceVariant}
                style={[styles.modalSearchInput, { color: theme.colors.onSurface }]}
              />
            </View>
            <ScrollView style={styles.modalNoteList} keyboardShouldPersistTaps="handled">
              {createFolderNoteChoices.map((item) => {
                const selected = createFolderNoteIds.has(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleCreateFolderNote(item.id)}
                    style={[
                      styles.modalNoteRow,
                      {
                        borderColor: selected
                          ? BRAND_COLORS.ink
                          : themeMode === 'dark'
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.08)',
                        backgroundColor: selected
                          ? themeMode === 'dark'
                            ? 'rgba(63,107,79,0.2)'
                            : 'rgba(63,107,79,0.08)'
                          : 'transparent',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.modalCheck,
                        {
                          borderColor: selected ? BRAND_COLORS.ink : theme.colors.onSurfaceVariant,
                          backgroundColor: selected ? BRAND_COLORS.ink : 'transparent',
                        },
                      ]}
                    >
                      {selected ? <Check size={12} strokeWidth={2.5} color="#FAFAFA" /> : null}
                    </View>
                    <Text numberOfLines={1} style={[styles.modalNoteTitle, { color: theme.colors.onSurface }]}>
                      {item.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable onPress={resetCreateFolderModal} style={styles.modalCancelBtn}>
                <Text style={[styles.modalCancelText, { color: theme.colors.onSurfaceVariant }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleCreateFolder}
                disabled={!newFolderName.trim() || isCreatingFolder}
                style={({ pressed }) => [
                  styles.modalCreateBtn,
                  {
                    backgroundColor: BRAND_COLORS.ink,
                    opacity: !newFolderName.trim() || isCreatingFolder ? 0.5 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                {isCreatingFolder ? (
                  <ActivityIndicator size="small" color="#FAFAFA" />
                ) : (
                  <Text style={styles.modalCreateText}>Create Folder</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  notesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  notesTitle: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 18,
    letterSpacing: -0.3,
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 12,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    minWidth: 160,
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
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
    fontFamily: Fonts.ui.regular,
    fontSize: 16,
    paddingVertical: 0,
  },
  searchToolbarScroll: {
    marginBottom: 16,
    flexGrow: 0,
  },
  searchToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexGrow: 1,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
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
  filterLabel: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
  },
  filterDropdown: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  filterOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterOptionText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 13,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 2,
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
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
  },
  sortLabel: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
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
  viewToggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newFolderBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRow: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  listRowFirst: {
    borderTopWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  listRowLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  sectionLabel: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  folderIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderTitle: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
  },
  folderTitleGrid: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
    lineHeight: 20,
  },
  folderMeta: {
    fontFamily: Fonts.ui.regular,
    fontSize: 12,
    marginTop: 4,
  },
  emptyContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 18,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 16,
  },
  emptyCta: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyCtaText: {
    color: '#FAFAFA',
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
  },
  errorScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  bannerContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 16,
    padding: 20,
  },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: Fonts.ui.bold,
    fontSize: 20,
  },
  modalSub: {
    fontFamily: Fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  modalInput: {
    fontFamily: Fonts.ui.regular,
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  modalSectionLabel: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 13,
    marginBottom: 8,
  },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    paddingVertical: 0,
  },
  modalNoteList: {
    maxHeight: 220,
    marginBottom: 12,
  },
  modalNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 6,
  },
  modalCheck: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalNoteTitle: {
    flex: 1,
    fontFamily: Fonts.ui.medium,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  modalCancelText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
  },
  modalCreateBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  modalCreateText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
    color: '#FAFAFA',
  },
  gridCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  gridSection: {
    borderWidth: 0,
    marginBottom: 12,
    marginTop: 4,
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  gridSectionFull: {
    paddingHorizontal: 0,
  },
  gridFolder: {
    padding: 16,
    minHeight: 120,
  },
  gridFolderIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontFamily: Fonts.ui.medium,
  },
});

export default StudyHubScreen;
