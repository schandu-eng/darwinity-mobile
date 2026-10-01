import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar, Check, FileText, Folder, GraduationCap, Plus, Search, Trash2 } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { useAuthStore } from '@/store';
import { useUserContent } from '@/api/queries/content';
import { useUserFolders } from '@/api/queries/folders';
import { useExamTargets, useDeleteExamTarget } from '@/api/queries/testPrep';
import { testPrepService } from '@/services/testPrepService';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { HubHomeHeader } from '@/components/home/HubHomeHeader';
import { Fonts } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';
import BottomSheet from '@/components/ui/BottomSheet';
import { PanelLoadError } from '@/components/ui/PanelLoadError';
import { boxShadow, hideWebFocusRing } from '@/theme/webCompat';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import ExamPrepProGate, { useExamPrepAccess } from '@/components/exam-prep/ExamPrepProGate';
import type { ExamPrepStackParamList } from '@/types/navigation';
import type { ExamTargetSummary } from '@/api/schemas/testPrep';
type NavigationProp = NativeStackNavigationProp<ExamPrepStackParamList, 'ExamPrepHub'>;

const ExamPrepHubScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const paper = themeMode === 'dark' ? '#09090B' : BRAND_COLORS.paper;
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { allowed } = useExamPrepAccess();

  const { data: targets = [], isLoading, isRefetching, refetch, error } = useExamTargets(allowed ? userId : null);
  const deleteMutation = useDeleteExamTarget();
  const [sheet, setSheet] = useState<'create' | null>(null);
  const [formError, setFormError] = useState('');

  const goToTarget = useCallback(
    (targetId: number) => {
      navigation.navigate('ExamPrepTarget', { targetId });
    },
    [navigation]
  );

  const handleDelete = useCallback(
    (target: ExamTargetSummary) => {
      if (!userId) return;
      Alert.alert(`Delete "${target.name}"?`, 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate({ targetId: target.id, userId }),
        },
      ]);
    },
    [deleteMutation, userId]
  );

  return (
    <View style={[styles.container, { backgroundColor: paper }]}>
      <HubHomeHeader />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.colors.primary} />
        }
      >
        <ExamPrepProGate>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={[styles.headerIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <GraduationCap size={22} strokeWidth={ICON_STROKE} color={theme.colors.primary} />
            </View>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Exam preparation</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                setFormError('');
                setSheet('create');
              }}
              activeOpacity={0.85}
            >
              <Plus size={16} strokeWidth={ICON_STROKE} color={theme.colors.onPrimary} />
              <Text style={[styles.primaryBtnText, { color: theme.colors.onPrimary }]}>Plan an exam</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading && targets.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : error && targets.length === 0 ? (
          <PanelLoadError
            title="Couldn't load exam targets"
            description={error instanceof Error ? error.message : undefined}
            onRetry={() => {
              void refetch();
            }}
            retrying={isRefetching}
          />
        ) : targets.length === 0 ? (
          <View style={[styles.emptyCard, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }]}>
            <View style={styles.emptyArt} accessibilityElementsHidden>
              <View
                style={[
                  styles.emptyArtCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: themeMode === 'dark' ? 'rgba(122,158,134,0.3)' : 'rgba(26,47,35,0.15)',
                  },
                ]}
              >
                <View style={styles.emptyArtTop}>
                  <View style={[styles.emptyArtIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                    <GraduationCap size={16} strokeWidth={ICON_STROKE} color={theme.colors.primary} />
                  </View>
                  <View style={[styles.emptyArtBar, { backgroundColor: themeMode === 'dark' ? 'rgba(122,158,134,0.4)' : 'rgba(26,47,35,0.25)' }]} />
                </View>
                <View style={[styles.emptyArtLine, { width: '88%', backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.15)' : '#E4E4E7' }]} />
                <View style={[styles.emptyArtLine, { width: '64%', backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : BRAND_COLORS.paperDeep }]} />
                <View style={styles.emptyArtTags}>
                  <View style={[styles.emptyMiniTag, { backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.1)' : BRAND_COLORS.paperDeep }]}>
                    <Text style={[styles.emptyMiniTagText, { color: theme.colors.onSurfaceVariant }]}>Notes</Text>
                  </View>
                  <View style={[styles.emptyMiniTag, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Text style={[styles.emptyMiniTagText, { color: theme.colors.primary }]}>MCQ</Text>
                  </View>
                </View>
              </View>
              <View style={styles.emptyBadgeTen}>
                <Text style={styles.emptyBadgeTenText}>10 Q</Text>
              </View>
              <View style={[styles.emptyBadgePractice, { backgroundColor: theme.colors.primaryContainer }]}>
                <Text style={[styles.emptyBadgePracticeText, { color: theme.colors.primary }]}>Practice</Text>
              </View>
            </View>

            <Text style={[styles.emptyEyebrow, { color: theme.colors.primary }]}>READY WHEN YOU ARE</Text>
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>Start practicing</Text>
            <Text style={[styles.emptyBody, { color: theme.colors.onSurfaceVariant }]}>
              Create an exam target with notes, folders, and optional PYQs, then start practicing from it.
            </Text>
            <TouchableOpacity
              style={[styles.emptyCta, { backgroundColor: theme.colors.primary }]}
              onPress={() => {
                setFormError('');
                setSheet('create');
              }}
              activeOpacity={0.85}
            >
              <Plus size={16} strokeWidth={ICON_STROKE} color={theme.colors.onPrimary} />
              <Text style={[styles.primaryBtnText, { color: theme.colors.onPrimary }]}>Plan an exam</Text>
            </TouchableOpacity>
            <View style={styles.emptyChips}>
              {[
                { label: 'Notes & folders', bg: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : BRAND_COLORS.paperDeep, fg: theme.colors.onSurfaceVariant },
                { label: 'Practice from a target', bg: theme.colors.primaryContainer, fg: theme.colors.primary },
                { label: 'PYQs optional', bg: themeMode === 'dark' ? 'rgba(120,53,15,0.35)' : '#FFFBEB', fg: themeMode === 'dark' ? '#FDE68A' : '#92400E' },
              ].map((chip) => (
                <View key={chip.label} style={[styles.emptyChip, { backgroundColor: chip.bg }]}>
                  <Check size={14} strokeWidth={ICON_STROKE} color={chip.fg} />
                  <Text style={[styles.emptyChipText, { color: chip.fg }]}>{chip.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.list}>
            {targets.map((target) => (
              <TouchableOpacity
                key={target.id}
                style={[
                  styles.card,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant },
                ]}
                onPress={() => goToTarget(target.id)}
                activeOpacity={0.8}
              >
                <View style={styles.cardTop}>
                  <Text numberOfLines={1} style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                    {target.name}
                  </Text>
                  <TouchableOpacity onPress={() => handleDelete(target)} hitSlop={8}>
                    <Trash2 size={18} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
                {target.description ? (
                  <Text numberOfLines={2} style={[styles.cardDesc, { color: theme.colors.onSurfaceVariant }]}>
                    {target.description}
                  </Text>
                ) : null}
                <View style={styles.chips}>
                  <Chip theme={theme} label={`${target.content_count || 0} note${target.content_count === 1 ? '' : 's'}`} />
                  <Chip theme={theme} label={`${target.folder_count || 0} folder${target.folder_count === 1 ? '' : 's'}`} />
                  {target.has_pyqs ? <Chip theme={theme} label="PYQs added" accent /> : null}
                  {target.exam_date ? (
                    <Chip
                      theme={theme}
                      label={target.exam_date}
                      icon={<Calendar size={12} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />}
                    />
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        </ExamPrepProGate>
      </ScrollView>

      <CreateTargetSheet
        visible={sheet === 'create'}
        onDismiss={() => setSheet(null)}
        userId={userId}
        error={formError}
        setError={setFormError}
        onCreated={(id) => {
          setSheet(null);
          goToTarget(id);
        }}
      />
    </View>
  );
};

const Chip: React.FC<{
  theme: typeof lightTheme;
  label: string;
  accent?: boolean;
  icon?: React.ReactNode;
}> = ({ theme, label, accent, icon }) => (
  <View
    style={[
      styles.chip,
      {
        backgroundColor: accent ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      },
    ]}
  >
    {icon}
    <Text style={[styles.chipText, { color: accent ? theme.colors.primary : theme.colors.onSurfaceVariant }]}>
      {label}
    </Text>
  </View>
);

function LibraryPickRow({
  title,
  selected,
  onPress,
  icon,
  theme,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  theme: typeof lightTheme;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.libRow,
        { borderBottomColor: theme.colors.outlineVariant },
        selected && { backgroundColor: theme.colors.primaryContainer },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: selected ? theme.colors.primary : theme.colors.outline,
            backgroundColor: selected ? theme.colors.primary : 'transparent',
          },
        ]}
      >
        {selected ? <Check size={12} strokeWidth={3} color={theme.colors.onPrimary} /> : null}
      </View>
      {icon}
      <Text numberOfLines={1} style={[styles.libTitle, { color: theme.colors.onSurface }]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function CreateTargetSheet({
  visible,
  onDismiss,
  userId,
  onCreated,
  error,
  setError,
}: {
  visible: boolean;
  onDismiss: () => void;
  userId: number | null;
  onCreated: (targetId: number) => void;
  error: string;
  setError: (v: string) => void;
}) {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const { data: contentData, isLoading: notesLoading } = useUserContent(userId, 100);
  const { data: foldersResult } = useUserFolders(userId);
  const notes = useMemo(
    () => contentData?.pages?.flatMap((page) => page.data?.content || []) ?? [],
    [contentData?.pages]
  );
  const folders = foldersResult?.data ?? [];
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [examDate, setExamDate] = useState('');
  const [pyqs, setPyqs] = useState('');
  const [query, setQuery] = useState('');
  const [libraryTab, setLibraryTab] = useState<'notes' | 'folders'>('notes');
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<number>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setDescription('');
    setExamDate('');
    setPyqs('');
    setQuery('');
    setLibraryTab('notes');
    setSelectedNoteIds(new Set());
    setSelectedFolderIds(new Set());
    setError('');
  }, [visible, setError]);

  const toggle = (set: Set<number>, id: number, setter: (next: Set<number>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const q = query.trim().toLowerCase();
  const visibleNotes = useMemo(
    () => (q ? notes.filter((n) => n.title.toLowerCase().includes(q)) : notes),
    [notes, q]
  );
  const visibleFolders = useMemo(
    () => (q ? folders.filter((f) => f.name.toLowerCase().includes(q)) : folders),
    [folders, q]
  );

  const selectedCount = selectedNoteIds.size + selectedFolderIds.size;
  const selectionLabel = !selectedCount
    ? 'None selected yet'
    : [
        selectedNoteIds.size ? `${selectedNoteIds.size} note${selectedNoteIds.size === 1 ? '' : 's'}` : null,
        selectedFolderIds.size
          ? `${selectedFolderIds.size} folder${selectedFolderIds.size === 1 ? '' : 's'}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ');

  const handleCreate = async () => {
    if (!userId || saving) return;
    if (!name.trim()) {
      setError('Give your exam target a name');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await testPrepService.createTarget({
        userId,
        name: name.trim(),
        description: description.trim() || null,
        examDate: examDate || null,
      });
      if (!created.success || !created.data) {
        setError(created.message || 'Failed to create exam target');
        return;
      }
      let target = created.data;
      for (const contentId of selectedNoteIds) {
        const res = await testPrepService.addContent(target.id, userId, contentId);
        if (res.data) target = res.data;
      }
      for (const folderId of selectedFolderIds) {
        const res = await testPrepService.addFolder(target.id, userId, folderId);
        if (res.data) target = res.data;
      }
      if (pyqs.trim()) {
        const res = await testPrepService.savePyqs(target.id, userId, pyqs.trim());
        if (res.data) target = res.data;
      }
      analytics.track(EVENTS.EXAM_TARGET_CREATED, {
        target_id: target.id,
        note_count: selectedNoteIds.size,
        folder_count: selectedFolderIds.size,
        has_pyqs: Boolean(pyqs.trim()),
        quick_start: false,
      });
      onCreated(target.id);
    } finally {
      setSaving(false);
    }
  };

  const listEmpty =
    libraryTab === 'notes'
      ? notesLoading
        ? null
        : notes.length === 0
          ? 'No notes yet. Create some from Home first.'
          : visibleNotes.length === 0
            ? 'No notes match that search.'
            : null
      : folders.length === 0
        ? 'No folders yet. Create one from Home first.'
        : visibleFolders.length === 0
          ? 'No folders match that search.'
          : null;

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      footer={
        <View style={styles.sheetActions}>
          <TouchableOpacity
            style={[styles.sheetBtn, { borderColor: theme.colors.outline }]}
            onPress={onDismiss}
            disabled={saving}
          >
            <Text style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.semiBold }}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sheetBtnFill, { backgroundColor: theme.colors.primary, opacity: saving ? 0.6 : 1 }]}
            onPress={() => void handleCreate()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={theme.colors.onPrimary} />
            ) : (
              <Text style={{ color: theme.colors.onPrimary, fontFamily: Fonts.ui.bold }}>
                Create
              </Text>
            )}
          </TouchableOpacity>
        </View>
      }
    >
      <Text style={[styles.sheetTitle, { color: theme.colors.onSurface }]}>New exam target</Text>
      <Text style={[styles.sheetSub, { color: theme.colors.onSurfaceVariant }]}>
        Name the exam and pick the notes or folders it should use.
      </Text>
      {error ? (
        <Text style={[styles.formError, { color: theme.colors.error }]}>{error}</Text>
      ) : null}

      <Text style={[styles.fieldLabel, { color: theme.colors.onSurface, marginTop: 4 }]}>Name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Biology midterm"
        placeholderTextColor={theme.colors.onSurfaceVariant}
        returnKeyType="done"
        style={[
          styles.input,
          hideWebFocusRing,
          { color: theme.colors.onSurface, borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface },
        ]}
      />

      <Text style={[styles.fieldLabel, { color: theme.colors.onSurface }]}>
        Description <Text style={{ fontFamily: Fonts.ui.regular, color: theme.colors.onSurfaceVariant }}>(optional)</Text>
      </Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Syllabus focus, chapters, etc."
        placeholderTextColor={theme.colors.onSurfaceVariant}
        multiline
        style={[
          styles.textarea,
          hideWebFocusRing,
          { color: theme.colors.onSurface, borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface, minHeight: 56 },
        ]}
      />

      <Text style={[styles.fieldLabel, { color: theme.colors.onSurface }]}>
        Exam date <Text style={{ fontFamily: Fonts.ui.regular, color: theme.colors.onSurfaceVariant }}>(optional)</Text>
      </Text>
      <TextInput
        value={examDate}
        onChangeText={setExamDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={theme.colors.onSurfaceVariant}
        {...(Platform.OS === 'web' ? ({ type: 'date' } as object) : {})}
        style={[
          styles.input,
          hideWebFocusRing,
          { color: theme.colors.onSurface, borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface },
        ]}
      />

      <View style={styles.libraryHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.fieldLabel, { color: theme.colors.onSurface, marginTop: 0, marginBottom: 2 }]}>
            Study material
          </Text>
          <Text style={[styles.selectionHint, { color: theme.colors.onSurfaceVariant }]}>{selectionLabel}</Text>
        </View>
        <View style={[styles.tabRow, { backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : BRAND_COLORS.paperDeep }]}>
          {(['notes', 'folders'] as const).map((tab) => {
            const active = libraryTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => {
                  setLibraryTab(tab);
                  setQuery('');
                }}
                style={[styles.tabBtn, active && { backgroundColor: theme.colors.primary }]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    { color: active ? theme.colors.onPrimary : theme.colors.onSurfaceVariant },
                  ]}
                >
                  {tab === 'notes' ? 'Notes' : 'Folders'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {(libraryTab === 'notes' ? notes.length : folders.length) > 8 ? (
        <View
          style={[
            styles.searchWrap,
            { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface },
          ]}
        >
          <Search size={16} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={libraryTab === 'notes' ? 'Search notes' : 'Search folders'}
            placeholderTextColor={theme.colors.onSurfaceVariant}
            style={[styles.searchInput, { color: theme.colors.onSurface }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
      ) : null}

      <View style={[styles.picker, { borderColor: theme.colors.outlineVariant }]}>
        {notesLoading && libraryTab === 'notes' ? (
          <View style={styles.pickerEmpty}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : listEmpty ? (
          <Text style={[styles.pickerEmptyText, { color: theme.colors.onSurfaceVariant }]}>{listEmpty}</Text>
        ) : (
          <ScrollView
            style={styles.pickerScroll}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
          >
            {libraryTab === 'notes'
              ? visibleNotes.map((note) => (
                  <LibraryPickRow
                    key={note.id}
                    title={note.title}
                    selected={selectedNoteIds.has(note.id)}
                    onPress={() => toggle(selectedNoteIds, note.id, setSelectedNoteIds)}
                    theme={theme}
                    icon={<FileText size={16} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />}
                  />
                ))
              : visibleFolders.map((folder) => (
                  <LibraryPickRow
                    key={folder.id}
                    title={folder.name}
                    selected={selectedFolderIds.has(folder.id)}
                    onPress={() => toggle(selectedFolderIds, folder.id, setSelectedFolderIds)}
                    theme={theme}
                    icon={<Folder size={16} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />}
                  />
                ))}
          </ScrollView>
        )}
      </View>

      <Text style={[styles.fieldLabel, { color: theme.colors.onSurface }]}>Paste PYQs (optional)</Text>
      <TextInput
        value={pyqs}
        onChangeText={setPyqs}
        placeholder="Paste previous year questions here…"
        placeholderTextColor={theme.colors.onSurfaceVariant}
        multiline
        style={[
          styles.textarea,
          { color: theme.colors.onSurface, borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface },
        ]}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  header: { paddingTop: 8, paddingBottom: 16 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontFamily: Fonts.ui.semiBold, fontSize: 22, letterSpacing: -0.4 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryBtnText: { fontFamily: Fonts.ui.bold, fontSize: 14 },
  centered: { paddingVertical: 48, alignItems: 'center' },
  emptyCard: { borderWidth: 1, borderRadius: 16, padding: 20, marginTop: 8 },
  emptyArt: {
    height: 160,
    width: '100%',
    maxWidth: 280,
    alignSelf: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  emptyArtCard: {
    position: 'absolute',
    left: '50%',
    top: 12,
    width: 192,
    marginLeft: -96,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    transform: [{ rotate: '-2deg' }],
    ...boxShadow('0 8px 14px rgba(26,47,35,0.12)', {
      shadowColor: '#1A2F23',
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    }),
  },
  emptyArtTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  emptyArtIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyArtBar: { height: 10, width: 96, borderRadius: 999 },
  emptyArtLine: { height: 8, borderRadius: 999, marginBottom: 8 },
  emptyArtTags: { flexDirection: 'row', gap: 6, marginTop: 4 },
  emptyMiniTag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  emptyMiniTagText: { fontSize: 9, fontFamily: Fonts.ui.semiBold },
  emptyBadgeTen: {
    position: 'absolute',
    right: 12,
    top: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FEF3C7',
  },
  emptyBadgeTenText: { fontSize: 10, fontFamily: Fonts.ui.bold, color: '#92400E' },
  emptyBadgePractice: {
    position: 'absolute',
    left: 16,
    bottom: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  emptyBadgePracticeText: { fontSize: 10, fontFamily: Fonts.ui.bold },
  emptyEyebrow: { fontSize: 11, letterSpacing: 1.2, fontFamily: Fonts.ui.bold, textAlign: 'center' },
  emptyTitle: { marginTop: 6, fontSize: 22, fontFamily: Fonts.ui.semiBold, textAlign: 'center' },
  emptyBody: { marginTop: 8, fontSize: 14, lineHeight: 20, fontFamily: Fonts.ui.regular, textAlign: 'center' },
  emptyCta: {
    marginTop: 20,
    height: 44,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
  },
  emptyChips: { marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  emptyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  emptyChipText: { fontSize: 11, fontFamily: Fonts.ui.semiBold },
  list: { gap: 12, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { flex: 1, fontFamily: Fonts.ui.bold, fontSize: 16 },
  cardDesc: { marginTop: 6, fontSize: 13, fontFamily: Fonts.ui.regular },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontFamily: Fonts.ui.semiBold },
  sheetTitle: { fontFamily: Fonts.ui.semiBold, fontSize: 18, marginBottom: 4 },
  sheetSub: { fontFamily: Fonts.ui.regular, fontSize: 13, marginBottom: 12, lineHeight: 18 },
  formError: { fontFamily: Fonts.ui.regular, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  libraryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 14,
    marginBottom: 10,
  },
  selectionHint: { fontFamily: Fonts.ui.regular, fontSize: 12 },
  tabRow: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
    gap: 2,
  },
  tabBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tabBtnText: { fontFamily: Fonts.ui.semiBold, fontSize: 12 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    marginBottom: 10,
    minHeight: 40,
  },
  searchInput: { flex: 1, fontFamily: Fonts.ui.regular, fontSize: 14, paddingVertical: 8 },
  picker: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    maxHeight: 220,
    minHeight: 88,
  },
  pickerScroll: { maxHeight: 220 },
  pickerEmpty: { paddingVertical: 28, alignItems: 'center', justifyContent: 'center' },
  pickerEmptyText: {
    fontFamily: Fonts.ui.regular,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 28,
    lineHeight: 18,
  },
  libRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libTitle: { flex: 1, fontFamily: Fonts.ui.semiBold, fontSize: 14 },
  sheetActions: { flexDirection: 'row', gap: 8 },
  sheetBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  sheetBtnFill: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  fieldLabel: { marginTop: 10, marginBottom: 6, fontFamily: Fonts.ui.semiBold, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.ui.regular,
    fontSize: 15,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 72,
    textAlignVertical: 'top',
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
  },
});

export default ExamPrepHubScreen;
