import React, { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { createNativeMarkdownStyles } from '@/utils/nativeMarkdownStyles';
import {
  createMarkdownItWithTables,
  createMarkdownTableRules,
} from '@/utils/markdownTable';

type NativeMarkdownProps = {
  content: string;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

const markdownIt = createMarkdownItWithTables();
const tableRules = createMarkdownTableRules();

export const NativeMarkdown: React.FC<NativeMarkdownProps> = React.memo(({
  content,
  fontSize = 15,
  textColor,
  backgroundColor,
  style,
}) => {
  const isDark = useAppTheme() === 'dark';
  const theme = isDark ? darkTheme : lightTheme;
  const colors = {
    onSurface: textColor || theme.colors.onSurface,
    primary: theme.colors.primary,
  };
  const markdownStyles = useMemo(
    () => createNativeMarkdownStyles(colors, isDark, fontSize),
    [colors.onSurface, colors.primary, isDark, fontSize]
  );
  const markdownRules = tableRules;

  return (
    <View style={[{ backgroundColor: backgroundColor ?? 'transparent' }, style]}>
      <Markdown style={markdownStyles} rules={markdownRules} markdownit={markdownIt}>
        {content || ''}
      </Markdown>
    </View>
  );
});

NativeMarkdown.displayName = 'NativeMarkdown';

export default NativeMarkdown;
