import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { createMarkdownTableRules } from '@/utils/markdownTable';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import CardDeckAutoImage from './CardDeckAutoImage';
import CardDeckImageOcclusion from './CardDeckImageOcclusion';
import { Fonts } from '@/config/fonts';

import {
  buildInterleavedRenderParts,
  extractImageSrcs,
  htmlContainsImageSrc,
  isEmptyHtmlChunk,
  isStructuredContent,
  legacyFlashcardDisplayText,
  parseCardContent,
  stripHtml,
  transformClozeHtml,
  type ContentBlock,
} from './cardDeckContentUtils';

const markdownRules = createMarkdownTableRules();

type Props = {
  value: string | null | undefined;
  occlusionReveal?: boolean;
  centered?: boolean;
};

const CardDeckContent: React.FC<Props> = ({ value, occlusionReveal = false, centered = true }) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const raw = (value || '').trim();
  const structured = useMemo(() => parseCardContent(raw), [raw]);

  const markdownStyles = useMemo(
    () => ({
      body: {
        color: theme.colors.onSurface,
        fontSize: 16,
        fontFamily: Fonts.ui.regular,
        lineHeight: 24,
        textAlign: centered ? ('center' as const) : ('left' as const),
      },
      paragraph: { marginBottom: 8 },
      strong: { fontFamily: Fonts.ui.bold },
    }),
    [theme.colors.onSurface, centered]
  );

  const renderHtmlChunk = (html: string, key: string) => {
    const clozeHtml = transformClozeHtml(html, { reveal: occlusionReveal });
    if (isEmptyHtmlChunk(clozeHtml)) return null;
    const text = stripHtml(clozeHtml);
    const images = extractImageSrcs(html);
    return (
      <View key={key} style={styles.chunk}>
        {text ? (
          <Text style={[styles.text, { color: theme.colors.onSurface, textAlign: centered ? 'center' : 'left' }]}>
            {text}
          </Text>
        ) : null}
        {images.map((src, i) => (
          <CardDeckAutoImage key={`${key}-img-${i}`} uri={src} />
        ))}
      </View>
    );
  };

  const renderOcclusion = (block: Extract<ContentBlock, { t: 'occ' }>, key: string) => (
    <CardDeckImageOcclusion
      key={key}
      src={block.src}
      regions={block.regions}
      reveal={occlusionReveal || Boolean(block.reveal)}
    />
  );

  if (!raw) {
    return <Text style={[styles.empty, { color: theme.colors.onSurfaceVariant }]}>-</Text>;
  }

  if (!structured?.blocks?.length) {
    if (isStructuredContent(raw)) {
      const fallback = legacyFlashcardDisplayText(raw);
      if (fallback) {
        return (
          <Text style={[styles.text, { color: theme.colors.onSurface, textAlign: centered ? 'center' : 'left' }]}>
            {fallback}
          </Text>
        );
      }
    }
    if (raw.includes('<') && raw.includes('>')) {
      return renderHtmlChunk(raw, 'plain-html');
    }
    return (
      <Markdown style={markdownStyles} rules={markdownRules}>{raw}</Markdown>
    );
  }

  const occlusionBlock = structured.blocks.find((b) => b.t === 'occ' && b.src);
  const htmlHasOcclusionImage =
    occlusionBlock?.t === 'occ' &&
    occlusionBlock.src &&
    structured.blocks.some((b) => b.t === 'html' && htmlContainsImageSrc(b.c, occlusionBlock.src));
  const interleaveOcclusion = Boolean(occlusionBlock && htmlHasOcclusionImage && !occlusionReveal);

  if (interleaveOcclusion && occlusionBlock?.t === 'occ') {
    const htmlBlock = structured.blocks.find((b) => b.t === 'html' && htmlContainsImageSrc(b.c, occlusionBlock.src));
    if (htmlBlock?.t === 'html') {
      const parts = buildInterleavedRenderParts(htmlBlock.c, occlusionBlock.src);
      return (
        <View style={styles.stack}>
          {parts.map((part, index) => {
            if (part.type === 'html') return renderHtmlChunk(part.html, `part-${index}`);
            return renderOcclusion(occlusionBlock, `occ-${index}`);
          })}
        </View>
      );
    }
  }

  return (
    <View style={styles.stack}>
      {structured.blocks.map((block, index) => {
        if (block.t === 'occ') return renderOcclusion(block, `block-${index}`);
        if (block.t === 'html') return renderHtmlChunk(block.c, `block-${index}`);
        if (block.t === 'cloze') {
          const answers = (block.answers || []).map((a) => String(a || '').trim()).filter(Boolean);
          if (!answers.length) return null;
          return (
            <View key={`block-${index}`} style={styles.chunk}>
              <Text
                style={[
                  styles.text,
                  { color: theme.colors.onSurface, textAlign: centered ? 'center' : 'left', fontFamily: Fonts.ui.semiBold },
                ]}
              >
                {answers.join('\n')}
              </Text>
            </View>
          );
        }
        if (block.t === 'md' && block.c?.trim()) {
          return (
            <View key={`block-${index}`} style={styles.chunk}>
              <Markdown style={markdownStyles} rules={markdownRules}>{block.c}</Markdown>
            </View>
          );
        }
        return null;
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  stack: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  chunk: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 16,
    fontFamily: Fonts.ui.regular,
    lineHeight: 24,
  },
  empty: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: Fonts.ui.regular,
  },
});

export default CardDeckContent;
