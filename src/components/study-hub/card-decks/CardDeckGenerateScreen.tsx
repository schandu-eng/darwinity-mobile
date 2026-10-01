import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Pressable,
} from 'react-native';
import { Text, Checkbox } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { Chapter, ContentType } from '@/api/schemas/content';

import { Fonts } from '@/config/fonts';
import { NotebookPen, Upload } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { STUDY_INK, STUDY_ZINC_500 } from '../studyPanelTokens';
import { boxShadow } from '@/theme/webCompat';

export const CARD_COUNT_OPTIONS = [
  { value: 10, label: '10', subtitle: 'Quick review' },
  { value: 20, label: '20', subtitle: 'Standard set' },
  { value: 30, label: '30', subtitle: 'Comprehensive' },
  { value: 50, label: '50', subtitle: 'Deep dive' },
];

type Props = {
  chapters: Chapter[];
  selectedTopics: number[] | null;
  onSelectedTopicsChange: (topics: number[] | null) => void;
  contentType: ContentType;
  cardCount: number;
  onCardCountChange: (count: number) => void;
  specialInstructions: string;
  onSpecialInstructionsChange: (value: string) => void;
  onGenerate: () => void;
  disabled?: boolean;
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  showCardCount?: boolean;
  showSpecialInstructions?: boolean;
  allowImport?: boolean;
  onImport?: () => void;
  onStartBlank?: () => void;
  blankCreating?: boolean;
  notesReady?: boolean;
  onCancel?: () => void;
};

const getTopicInfo = (chapter: Chapter, contentType: ContentType): string => {
  if (contentType === 'YOUTUBE' || contentType === 'AUDIO_RECORDING') {
    return chapter.start_time || '';
  }
  if (contentType === 'PDF') {
    if (chapter.start_page && chapter.end_page) {
      return `Pages ${chapter.start_page}–${chapter.end_page}`;
    }
    if (chapter.start_page) {
      return `Page ${chapter.start_page}`;
    }
  }
  return '';
};

const CardDeckGenerateScreen: React.FC<Props> = ({
  chapters,
  selectedTopics,
  onSelectedTopicsChange,
  contentType,
  cardCount,
  onCardCountChange,
  specialInstructions,
  onSpecialInstructionsChange,
  onGenerate,
  disabled = false,
  title = 'Welcome to Flashcards',
  subtitle = 'Choose how many flashcards to generate from your notes',
  submitLabel,
  showCardCount = true,
  showSpecialInstructions = true,
  allowImport = false,
  onImport,
  onStartBlank,
  blankCreating = false,
  notesReady = true,
  onCancel,
}) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const generateLabel = submitLabel || `Generate ${cardCount} Flashcard${cardCount === 1 ? '' : 's'}`;
  const isAllSelected = selectedTopics === null;
  const selectedIds = selectedTopics || [];

  const handleTopicToggle = (topicId: number | null) => {
    if (topicId === null) {
      onSelectedTopicsChange(selectedTopics === null ? [] : null);
      return;
    }
    if (selectedTopics === null) {
      const allIds = chapters.map((ch) => ch.id).filter((id): id is number => id !== undefined);
      onSelectedTopicsChange(allIds.filter((id) => id !== topicId));
      return;
    }
    const newSelection = selectedTopics.includes(topicId)
      ? selectedTopics.filter((id) => id !== topicId)
      : [...selectedTopics, topicId];
    const allIds = chapters.map((ch) => ch.id).filter((id): id is number => id !== undefined);
    if (newSelection.length === 0 || newSelection.length === allIds.length) {
      onSelectedTopicsChange(null);
    } else {
      onSelectedTopicsChange(newSelection);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text variant="titleLarge" style={[styles.title, { color: theme.colors.onSurface }]}>
          {title}
        </Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
          {subtitle}
        </Text>
        {(allowImport && onImport) || onStartBlank ? (
          <View style={styles.altRow}>
            {onStartBlank ? (
              <Pressable
                onPress={onStartBlank}
                disabled={disabled || blankCreating}
                style={({ pressed }) => [styles.altBtn, pressed && { opacity: 0.85 }]}
              >
                <NotebookPen size={14} strokeWidth={ICON_STROKE} color={STUDY_INK} />
                <Text style={styles.altLabel}>{blankCreating ? 'Creating…' : 'Scratch'}</Text>
              </Pressable>
            ) : null}
            {allowImport && onImport ? (
              <Pressable
                onPress={onImport}
                disabled={disabled || blankCreating}
                style={({ pressed }) => [styles.altBtn, pressed && { opacity: 0.85 }]}
              >
                <Upload size={14} strokeWidth={ICON_STROKE} color={STUDY_INK} />
                <Text style={styles.altLabel}>Import</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {showCardCount ? (
        <View style={styles.countGrid}>
          {CARD_COUNT_OPTIONS.map((opt) => {
            const selected = cardCount === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                disabled={disabled}
                onPress={() => onCardCountChange(opt.value)}
                style={[
                  styles.countOption,
                  {
                    borderColor: selected ? theme.colors.primary : theme.colors.outline,
                    backgroundColor: selected
                      ? themeMode === 'dark'
                        ? 'rgba(37, 99, 235, 0.15)'
                        : '#EFF6FF'
                      : theme.colors.surface,
                    opacity: disabled ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={[styles.countValue, { color: theme.colors.onSurface }]}>{opt.label}</Text>
                <Text style={[styles.countSubtitle, { color: theme.colors.onSurfaceVariant }]}>{opt.subtitle}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {chapters.length > 0 ? (
        <View style={[styles.topicsSection, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
            Select Topics
          </Text>
          <TouchableOpacity onPress={() => handleTopicToggle(null)} disabled={disabled} style={styles.topicRow}>
            <Checkbox status={isAllSelected ? 'checked' : 'unchecked'} color={theme.colors.primary} />
            <Text style={{ color: theme.colors.onSurface }}>All Topics ({chapters.length})</Text>
          </TouchableOpacity>
          {chapters.map((chapter) => {
            if (!chapter.id) return null;
            const isSelected = isAllSelected || selectedIds.includes(chapter.id);
            const topicInfo = getTopicInfo(chapter, contentType);
            return (
              <TouchableOpacity
                key={chapter.id}
                onPress={() => handleTopicToggle(chapter.id!)}
                disabled={disabled}
                style={styles.topicRow}
              >
                <Checkbox status={isSelected ? 'checked' : 'unchecked'} color={theme.colors.primary} />
                <View style={styles.topicContent}>
                  <Text style={{ color: theme.colors.onSurface }}>{chapter.title}</Text>
                  {topicInfo ? (
                    <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>{topicInfo}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {showSpecialInstructions ? (
        <>
          <Text style={[styles.label, { color: theme.colors.onSurface }]}>Special instructions (optional)</Text>
          <TextInput
            value={specialInstructions}
            onChangeText={onSpecialInstructionsChange}
            editable={!disabled}
            placeholder="Describe what you want your flashcards to focus on..."
            placeholderTextColor={theme.colors.onSurfaceVariant}
            multiline
            numberOfLines={4}
            style={[
              styles.textarea,
              {
                color: theme.colors.onSurface,
                borderColor: theme.colors.outline,
                backgroundColor: theme.colors.surface,
              },
            ]}
          />
        </>
      ) : null}

      {!notesReady ? (
        <Text style={styles.notesHint}>
          Notes still processing, generate is paused. Use Scratch or Import instead.
        </Text>
      ) : null}

      {onCancel ? (
        <Pressable onPress={onCancel} disabled={disabled} style={styles.cancelWrap}>
          <Text style={styles.cancelLabel}>Back</Text>
        </Pressable>
      ) : null}

      <TouchableOpacity
        onPress={onGenerate}
        disabled={disabled || !notesReady}
        style={[
          styles.generateButton,
          {
            backgroundColor: theme.colors.primary,
            opacity: disabled || !notesReady ? 0.6 : 1,
          },
        ]}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="sprout" size={20} color="#FFFFFF" />
        <Text style={styles.generateButtonText}>{generateLabel}</Text>
        <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  title: {
    fontFamily: Fonts.ui.bold,
    textAlign: 'center',
  },
  countGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  countOption: {
    width: '48%',
    borderWidth: 2,
    borderRadius: 14,
    padding: 14,
  },
  countValue: {
    fontSize: 22,
    fontFamily: Fonts.ui.bold,
  },
  countSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: Fonts.ui.regular,
  },
  topicsSection: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  topicContent: {
    flex: 1,
    marginLeft: 4,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.ui.medium,
    marginBottom: 8,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 96,
    textAlignVertical: 'top',
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    marginBottom: 20,
  },
  altRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  altBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(63,107,79,0.18)',
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 36,
  },
  altLabel: { fontFamily: Fonts.ui.semiBold, fontSize: 13, color: STUDY_INK },
  notesHint: {
    fontFamily: Fonts.ui.regular,
    fontSize: 12,
    color: STUDY_ZINC_500,
    textAlign: 'center',
    marginBottom: 12,
  },
  cancelWrap: { alignSelf: 'center', marginBottom: 12 },
  cancelLabel: { fontFamily: Fonts.ui.medium, fontSize: 14, color: STUDY_ZINC_500 },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    ...boxShadow('0 10px 28px rgba(63,107,79,0.24)', {
      shadowColor: '#1A2F23',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 6,
    }),
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: Fonts.ui.bold,
  },
});

export default CardDeckGenerateScreen;
