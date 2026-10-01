import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { NativeMarkdown } from '@/components/content/NativeMarkdown';

interface KatexWebViewProps {
  content?: string;
  html?: string;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
  compact?: boolean;
  center?: boolean;
  boldColor?: string;
  minHeight?: number;
  style?: StyleProp<ViewStyle>;
  showLoader?: boolean;
}

function htmlToMarkdown(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<h1[^>]*>/gi, '# ')
    .replace(/<h2[^>]*>/gi, '## ')
    .replace(/<h3[^>]*>/gi, '### ')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<(strong|b)[^>]*>/gi, '**')
    .replace(/<\/(strong|b)>/gi, '**')
    .replace(/<(em|i)[^>]*>/gi, '_')
    .replace(/<\/(em|i)>/gi, '_')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Notes/math body. Native Markdown on every platform — RN WebView does not run on Expo web. */
const KatexWebView: React.FC<KatexWebViewProps> = ({
  content,
  html: htmlBody,
  fontSize,
  textColor,
  backgroundColor,
  style,
}) => {
  const markdown = htmlBody != null ? htmlToMarkdown(htmlBody) : content || '';
  return (
    <NativeMarkdown
      content={markdown}
      fontSize={fontSize}
      textColor={textColor}
      backgroundColor={backgroundColor}
      style={style}
    />
  );
};

export default KatexWebView;
