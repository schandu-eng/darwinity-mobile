import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { MarkdownIt } from 'react-native-markdown-display';
import { MarkdownImage } from '@/components/content/MarkdownImage';
import { Fonts } from '@/config/fonts';

/** [[term]] → glossary_term token (bold brand-green, no brackets). */
function glossaryTermPlugin(md: { inline: { ruler: { before: (name: string, rule: string, fn: (state: any, silent: boolean) => boolean) => void } } }) {
  md.inline.ruler.before('emphasis', 'glossary_term', (state: any, silent: boolean) => {
    const start = state.pos;
    if (state.src.charCodeAt(start) !== 0x5b || state.src.charCodeAt(start + 1) !== 0x5b) {
      return false;
    }
    const close = state.src.indexOf(']]', start + 2);
    if (close < 0 || close === start + 2) return false;
    const content = state.src.slice(start + 2, close);
    if (!content || /[\n\]]/.test(content)) return false;
    if (!silent) {
      const token = state.push('glossary_term', '', 0);
      token.content = content;
      token.markup = '[[';
    }
    state.pos = close + 2;
    return true;
  });
}

export const TABLE_COLUMN_WIDTH = 150;

const CELL_PADDING_VERTICAL = 7;
const CELL_PADDING_HORIZONTAL = 10;

export const createMarkdownTableStyles = (isDark: boolean) => {
  const borderColor = isDark ? 'rgba(122, 158, 134, 0.35)' : 'rgba(24, 24, 27, 0.1)';
  const headerBg = isDark ? 'rgba(122, 158, 134, 0.22)' : 'rgba(24, 24, 27, 0.04)';

  const cell = {
    width: TABLE_COLUMN_WIDTH,
    paddingVertical: CELL_PADDING_VERTICAL,
    paddingHorizontal: CELL_PADDING_HORIZONTAL,
    borderRightWidth: 1,
    borderRightColor: borderColor,
    borderBottomWidth: 1,
    borderBottomColor: borderColor,
  } as const;

  return {
    table: {
      borderWidth: 1,
      borderColor,
      borderRadius: 8,
      overflow: 'hidden' as const,
      alignSelf: 'flex-start' as const,
    },
    thead: { backgroundColor: headerBg },
    tbody: {},
    tr: { flexDirection: 'row' as const },
    th: { ...cell, fontFamily: Fonts.ui.semiBold, backgroundColor: headerBg, color: isDark ? '#FFFFFF' : '#18181B' },
    td: { ...cell, backgroundColor: isDark ? 'transparent' : '#FFFFFF' },
  };
};

export const createMarkdownTableRules = () => ({
  table: (node: any, children: any, _parent: any, styles: any) => (
    <ScrollView
      key={node.key}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 6 }}
      style={{ marginVertical: 8 }}
    >
      <View style={styles.table}>{children}</View>
    </ScrollView>
  ),
  glossary_term: (node: any, _children: any, _parent: any, styles: any, inheritedStyles: any = {}) => (
    <Text key={node.key} style={[inheritedStyles, styles.glossary_term]}>
      {node.content}
    </Text>
  ),
  // Library default spreads `key` into FitImage and prefixes unmatched src with `https://`.
  image: (node: any, _children: any, _parent: any, styles: any) => {
    const src = String(node?.attributes?.src || '').trim();
    if (!src) return null;
    const alt = node?.attributes?.alt ? String(node.attributes.alt) : undefined;
    return (
      <MarkdownImage
        key={node.key}
        src={src}
        alt={alt}
        style={styles._VIEW_SAFE_image}
      />
    );
  },
});

export const createMarkdownItWithTables = () =>
  MarkdownIt({ typographer: true, linkify: true }).enable(['table']).use(glossaryTermPlugin);
