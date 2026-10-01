import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { createMarkdownTableRules } from '@/utils/markdownTable';
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

const LEGACY_MAX_IMAGE_WIDTH = 240;
const LEGACY_MAX_IMAGE_HEIGHT = 160;
const markdownRules = createMarkdownTableRules();

type Props = {
  value: string;
  occlusionReveal?: boolean;
  markdownStyle: Record<string, unknown>;
};

const CardDeckLegacyFieldContent: React.FC<Props> = ({
  value,
  occlusionReveal = false,
  markdownStyle,
}) => {
  const raw = (value || '').trim();
  const structured = useMemo(() => parseCardContent(raw), [raw]);

  const renderHtmlChunk = (html: string, key: string) => {
    const clozeHtml = transformClozeHtml(html, { reveal: occlusionReveal });
    if (isEmptyHtmlChunk(clozeHtml)) return null;
    const text = stripHtml(clozeHtml);
    const images = extractImageSrcs(html);
    const textAlign = (markdownStyle.body as { textAlign?: 'center' | 'left' })?.textAlign || 'center';
    return (
      <View key={key} style={styles.chunk}>
        {text ? (
          <Text style={[styles.text, { textAlign }]}>{text}</Text>
        ) : null}
        {images.map((src, i) => (
          <CardDeckAutoImage
            key={`${key}-img-${i}`}
            uri={src}
            maxWidth={LEGACY_MAX_IMAGE_WIDTH}
            maxHeight={LEGACY_MAX_IMAGE_HEIGHT}
          />
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

  if (!raw) return null;

  if (!structured?.blocks?.length) {
    if (isStructuredContent(raw)) {
      const fallback = legacyFlashcardDisplayText(raw);
      if (fallback) {
        return <Markdown style={markdownStyle} rules={markdownRules}>{fallback}</Markdown>;
      }
    }
    return <Markdown style={markdownStyle} rules={markdownRules}>{raw}</Markdown>;
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
          const textAlign = (markdownStyle.body as { textAlign?: 'center' | 'left' })?.textAlign || 'center';
          return (
            <View key={`block-${index}`} style={styles.chunk}>
              <Text style={[styles.text, { textAlign, fontWeight: '600' }]}>{answers.join('\n')}</Text>
            </View>
          );
        }
        if (block.t === 'md' && block.c?.trim()) {
          return (
            <View key={`block-${index}`} style={styles.chunk}>
              <Markdown style={markdownStyle} rules={markdownRules}>{block.c}</Markdown>
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
    gap: 8,
    alignItems: 'center',
  },
  chunk: {
    width: '100%',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    fontSize: 15,
    fontFamily: Fonts.ui.regular,
    lineHeight: 24,
  },
});

export default CardDeckLegacyFieldContent;
