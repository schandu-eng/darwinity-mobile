import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { ReelFeedItem } from '@/api/schemas/cardDecksV2';
import { cardDeckV2Service } from '@/services/cardDeckV2Service';
import { PanelSkeleton } from '@/components/ui/skeleton';
import { useNotificationStore } from '@/store/notificationStore';

import { Fonts } from '@/config/fonts';

type Props = {
  userId: number;
  onBack: () => void;
  onSaved: () => void;
};

const CardDeckReelEditor: React.FC<Props> = ({ userId, onBack, onSaved }) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const showSuccess = useNotificationStore((s) => s.showSuccess);

  const [items, setItems] = useState<ReelFeedItem[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      const result = await cardDeckV2Service.getReelFeed(userId);
      if (cancelled) return;
      if (!result.success || !result.data) {
        setError(result.message || 'Could not load feed');
        setLoading(false);
        return;
      }
      setItems(result.data.items || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const toggleInFeed = useCallback((deckId: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.deck_id === deckId
          ? { ...item, in_feed: !item.in_feed, topic_ids: !item.in_feed ? item.topic_ids : null }
          : item
      )
    );
  }, []);

  const toggleTopic = useCallback((deckId: number, topicId: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.deck_id !== deckId) return item;
        const allIds = (item.topics || []).map((t) => t.id);
        const current = item.topic_ids == null ? allIds : item.topic_ids;
        const has = current.includes(topicId);
        const next = has ? current.filter((id) => id !== topicId) : [...current, topicId];
        return {
          ...item,
          topic_ids: next.length === allIds.length ? null : next,
        };
      })
    );
  }, []);

  const isTopicActive = (item: ReelFeedItem, topicId: number) => {
    if (item.topic_ids == null) return true;
    return item.topic_ids.includes(topicId);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const payload = items
      .filter((i) => i.in_feed)
      .map((i) => ({
        deck_id: i.deck_id,
        content_id: i.content_id,
        topic_ids: i.topic_ids ?? null,
      }));
    const result = await cardDeckV2Service.saveReelFeed(userId, payload);
    setSaving(false);
    if (!result.success) {
      setError(result.message || 'Could not save feed');
      return;
    }
    showSuccess('Feed updated');
    onSaved();
  };

  if (loading) {
    return <PanelSkeleton label="Loading feed" rows={4} />;
  }

  return (
    <View style={styles.container}>
      <Text variant="titleLarge" style={[styles.title, { color: theme.colors.onSurface }]}>
        Manage flashcard feed
      </Text>
      <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
        Choose which flashcard sets appear in your feed. Expand a set to limit topics.
      </Text>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      {items.length === 0 ? (
        <View style={[styles.emptyBox, { borderColor: theme.colors.outlineVariant }]}>
          <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
            No flashcard sets with SRS cards yet.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {items.map((item) => {
            const inFeed = !!item.in_feed;
            const hasTopics = (item.topics || []).length > 0;
            const isOpen = expanded === item.deck_id;
            const deckTitle = item.deck_title || item.title || 'Flashcard set';
            const noteTitle = item.note_title || '';
            return (
              <View
                key={item.deck_id}
                style={[
                  styles.itemCard,
                  {
                    borderColor: inFeed ? theme.colors.primary : theme.colors.outlineVariant,
                    backgroundColor: inFeed
                      ? themeMode === 'dark'
                        ? 'rgba(59, 130, 246, 0.12)'
                        : 'rgba(59, 130, 246, 0.06)'
                      : theme.colors.surface,
                  },
                ]}
              >
                <View style={styles.itemRow}>
                  <TouchableOpacity
                    onPress={() => toggleInFeed(item.deck_id)}
                    style={styles.itemMain}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        inFeed
                          ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                          : { borderColor: theme.colors.outline },
                      ]}
                    >
                      {inFeed ? (
                        <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                      ) : null}
                    </View>
                    <View style={styles.itemText}>
                      <Text
                        style={[styles.itemTitle, { color: theme.colors.onSurface }]}
                        numberOfLines={1}
                      >
                        {deckTitle}
                      </Text>
                      <Text
                        style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}
                        numberOfLines={1}
                      >
                        {noteTitle ? `${noteTitle} · ` : ''}
                        {(item.study_queue_count || 0) > 0
                          ? `${item.study_queue_count} to review`
                          : `${item.card_count || 0} cards`}
                        {(item.study_queue_count || 0) > 0 && (item.new_count || 0) > 0
                          ? ` · ${item.new_count} new`
                          : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {inFeed && hasTopics ? (
                    <TouchableOpacity
                      onPress={() => setExpanded(isOpen ? null : item.deck_id)}
                      style={styles.expandButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <MaterialCommunityIcons
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color={theme.colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {inFeed && hasTopics && isOpen ? (
                  <View style={styles.topicRow}>
                    {(item.topics || []).map((topic) => {
                      const active = isTopicActive(item, topic.id);
                      return (
                        <TouchableOpacity
                          key={topic.id}
                          onPress={() => toggleTopic(item.deck_id, topic.id)}
                          style={[
                            styles.topicChip,
                            active
                              ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                              : {
                                  backgroundColor: theme.colors.surface,
                                  borderColor: theme.colors.outlineVariant,
                                },
                          ]}
                        >
                          <Text
                            style={{
                              color: active ? '#FFFFFF' : theme.colors.onSurfaceVariant,
                              fontSize: 12,
                              fontWeight: '600',
                            }}
                          >
                            {topic.title}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveButton, { backgroundColor: theme.colors.primary, opacity: saving ? 0.6 : 1 }]}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save changes'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backButton, { borderColor: theme.colors.outlineVariant }]}
        >
          <Text style={{ color: theme.colors.onSurface, fontWeight: '600' }}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontFamily: Fonts.ui.bold, marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  errorText: { color: '#DC2626', marginBottom: 12, textAlign: 'center' },
  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    marginBottom: 16,
  },
  list: { flex: 1, marginBottom: 16 },
  itemCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1, minWidth: 0 },
  itemTitle: { fontWeight: '600', fontSize: 14, marginBottom: 2 },
  expandButton: { padding: 4 },
  topicRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  topicChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  actions: { flexDirection: 'row', gap: 8 },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  backButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
  },
});

export default CardDeckReelEditor;
