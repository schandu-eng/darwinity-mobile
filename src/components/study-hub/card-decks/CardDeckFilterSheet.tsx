import React from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, Checkbox } from 'react-native-paper';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import BottomSheet from '@/components/ui/BottomSheet';
import type { TopicItem } from './cardDeckUtils';

import { Fonts } from '@/config/fonts';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  topics: TopicItem[];
  selectedTopicIds: number[];
  onSelectedTopicIdsChange: (ids: number[]) => void;
  starredOnly: boolean;
  onStarredOnlyChange: (value: boolean) => void;
};

const CardDeckFilterSheet: React.FC<Props> = ({
  visible,
  onDismiss,
  topics,
  selectedTopicIds,
  onSelectedTopicIdsChange,
  starredOnly,
  onStarredOnlyChange,
}) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const toggleTopic = (topicId: number) => {
    if (selectedTopicIds.includes(topicId)) {
      onSelectedTopicIdsChange(selectedTopicIds.filter((id) => id !== topicId));
    } else {
      onSelectedTopicIdsChange([...selectedTopicIds, topicId]);
    }
  };

  return (
    <BottomSheet visible={visible} onDismiss={onDismiss}>
      <View style={styles.header}>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.bold }}>
          Filters
        </Text>
      </View>

      <TouchableOpacity
        onPress={() => onStarredOnlyChange(!starredOnly)}
        style={[styles.row, { borderBottomColor: theme.colors.outlineVariant }]}
      >
        <Checkbox status={starredOnly ? 'checked' : 'unchecked'} color={theme.colors.primary} />
        <Text style={{ color: theme.colors.onSurface }}>Starred cards only</Text>
      </TouchableOpacity>

      {topics.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>Topics</Text>
          <ScrollView style={styles.topicList} nestedScrollEnabled>
            {topics.map((topic) => {
              const checked = selectedTopicIds.includes(topic.id);
              return (
                <TouchableOpacity
                  key={topic.id}
                  onPress={() => toggleTopic(topic.id)}
                  style={[styles.row, { borderBottomColor: theme.colors.outlineVariant }]}
                >
                  <Checkbox status={checked ? 'checked' : 'unchecked'} color={theme.colors.primary} />
                  <Text style={{ color: theme.colors.onSurface, flex: 1 }}>{topic.title}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      <TouchableOpacity
        onPress={onDismiss}
        style={[styles.doneButton, { backgroundColor: theme.colors.primary }]}
      >
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sectionLabel: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    fontSize: 12,
    fontFamily: Fonts.ui.semiBold,
    textTransform: 'uppercase',
  },
  topicList: {
    maxHeight: 240,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  doneButton: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.ui.bold,
    fontSize: 16,
  },
});

export default CardDeckFilterSheet;
