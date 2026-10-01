import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FileText } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { BRAND_COLORS } from '@/config/brand';
import { Fonts } from '@/config/fonts';
import { boxShadow, hideWebFocusRing } from '@/theme/webCompat';
import type { ChatMentionCandidate } from '@/study-hub/chatContext';

type Props = {
  items: ChatMentionCandidate[];
  isDark: boolean;
  onSelect: (item: ChatMentionCandidate) => void;
};

export default function ChatMentionMenu({ items, isDark, onSelect }: Props) {
  return (
    <View
      style={[
        styles.menu,
        {
          backgroundColor: isDark ? '#18181B' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,47,35,0.12)',
        },
      ]}
      accessibilityRole="list"
      accessibilityLabel="Reference notes"
    >
      {!items.length ? (
        <Text style={[styles.empty, { color: isDark ? '#A1A1AA' : '#71717A' }]}>
          No matching sections in this note.
        </Text>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled
          style={styles.list}
        >
          {items.map((item) => (
            <Pressable
              key={item.id}
              onPressIn={() => onSelect(item)}
              style={({ pressed }) => [
                styles.row,
                hideWebFocusRing,
                pressed && {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(63,107,79,0.10)',
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Reference ${item.title}`}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: isDark ? 'rgba(63,107,79,0.25)' : 'rgba(63,107,79,0.12)' },
                ]}
              >
                <FileText
                  size={14}
                  strokeWidth={ICON_STROKE}
                  color={isDark ? '#9BB8A6' : BRAND_COLORS.ink}
                />
              </View>
              <View style={styles.copy}>
                <Text
                  style={[styles.title, { color: isDark ? '#FAFAFA' : '#18181B' }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <Text
                  style={[styles.subtitle, { color: isDark ? '#A1A1AA' : '#71717A' }]}
                  numberOfLines={1}
                >
                  {item.subtitle}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    marginBottom: 8,
    maxHeight: 224,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    ...boxShadow('0 12px 36px rgba(26,47,35,0.12)', {
      shadowColor: BRAND_COLORS.ink,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 6,
    }),
  },
  list: {
    maxHeight: 224,
  },
  empty: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: Fonts.ui.regular,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontFamily: Fonts.ui.medium,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
  },
});
