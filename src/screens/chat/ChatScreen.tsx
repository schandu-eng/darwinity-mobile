import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Platform,
  TouchableOpacity,
  Alert,
  TextInput as RNTextInput,
  Text as RNText,
  Animated as RNAnimated,
  Dimensions,
  Image,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { ActivityIndicator } from 'react-native-paper';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';
import KatexWebView from '@/components/ui/KatexWebView';
import { hasMath } from '@/utils/mathContent';
import {
  createMarkdownTableStyles,
  createMarkdownTableRules,
  createMarkdownItWithTables,
} from '@/utils/markdownTable';

import { useAuthStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useChat } from '@/api/queries/chat';
import { useChatAvailability } from '@/hooks/useChatAvailability';
import { useProFeatureAccess } from '@/hooks/useProFeatureAccess';
import ChatProGate from '@/components/study-hub/ChatProGate';
import type { ContentStackParamList } from '@/types/navigation';
import type { ChatMessage } from '@/api/schemas/chat';
import { useSessionTracker } from '@/analytics/useSessionTracker';
import { EVENTS } from '@/analytics/events';
import { analytics } from '@/analytics/analytics';
import { useStudyPageDwell } from '@/features/concentration/useStudyPageDwell';

import { Fonts } from '@/config/fonts';
import { BRAND_COLORS, BRAND_NAME } from '@/config/brand';
import { BrandMark } from '@/components/brand/BrandMark';
import { ArrowUp, ChevronDown, Paperclip, X } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { boxShadow, hideWebFocusRing, USE_NATIVE_DRIVER } from '@/theme/webCompat';
import ChatMentionMenu from '@/screens/chat/ChatMentionMenu';
import {
  buildTopicMentionCandidates,
  estimateCursorAfterChange,
  filterMentionCandidates,
  getAtTriggerState,
  serializeChatContext,
  type AtTriggerState,
  type ChatMentionCandidate,
} from '@/study-hub/chatContext';

const RICH_WIDTH = Math.min(Dimensions.get('window').width * 0.8, 340);
const DARWIN_FACE = require('../../../assets/onboarding-darwin.png');

type LocalChatMessage = ChatMessage & { isNew?: boolean; isError?: boolean; error_code?: string | null };

type ChatRouteProp = RouteProp<ContentStackParamList, 'Chat'>;

const GREETING_TYPE_MS = 38;
const GREETING_SUB_DELAY_MS = 180;

const WelcomeGreeting: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const headingFull = `Hey, I'm ${BRAND_NAME}`;
  const subFull = 'Ask me anything about the source material.';
  const [heading, setHeading] = useState(headingFull);
  const [subheading, setSubheading] = useState(subFull);

  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let i = 0;
    setHeading('');
    setSubheading('');

    const typeHeading = () => {
      if (cancelled) return;
      i += 1;
      setHeading(headingFull.slice(0, i));
      if (i < headingFull.length) {
        timerId = setTimeout(typeHeading, GREETING_TYPE_MS);
        return;
      }
      i = 0;
      timerId = setTimeout(typeSub, GREETING_SUB_DELAY_MS);
    };

    const typeSub = () => {
      if (cancelled) return;
      i += 1;
      setSubheading(subFull.slice(0, i));
      if (i < subFull.length) {
        timerId = setTimeout(typeSub, GREETING_TYPE_MS);
      }
    };

    timerId = setTimeout(typeHeading, 220);
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [headingFull, subFull]);

  return (
    <View style={styles.welcomeCopy}>
      <RNText
        style={[styles.welcomeTitle, { color: isDark ? '#FAFAFA' : '#18181B' }]}
        accessibilityLabel={headingFull}
      >
        {heading}
      </RNText>
      <RNText
        style={[styles.welcomeSub, { color: isDark ? '#A1A1AA' : '#71717A' }]}
        accessibilityLabel={subFull}
      >
        {subheading}
      </RNText>
    </View>
  );
};

const DarwinAvatar: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <Image
    source={DARWIN_FACE}
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(26, 47, 35, 0.15)',
    }}
    accessibilityIgnoresInvertColors
  />
);

const AnimatedMessageBubble: React.FC<{ isNew: boolean; children: React.ReactNode; style?: any }> = React.memo(({ isNew, children, style }) => {
  const translateY = useRef(new RNAnimated.Value(isNew ? 15 : 0)).current;
  const opacity = useRef(new RNAnimated.Value(isNew ? 0 : 1)).current;

  useEffect(() => {
    if (isNew) {
      RNAnimated.parallel([
        RNAnimated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: USE_NATIVE_DRIVER }),
        RNAnimated.spring(translateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: USE_NATIVE_DRIVER })
      ]).start();
    }
  }, [isNew, opacity, translateY]);

  return (
    <RNAnimated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </RNAnimated.View>
  );
});

const AnimatedSendButton: React.FC<{ onPress: () => void; disabled: boolean; canSend: boolean; isDark: boolean }> = ({ onPress, disabled, canSend, isDark }) => {
  const scale = useRef(new RNAnimated.Value(1)).current;

  const handlePressIn = () => RNAnimated.spring(scale, { toValue: 0.85, useNativeDriver: USE_NATIVE_DRIVER }).start();
  const handlePressOut = () => RNAnimated.spring(scale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: USE_NATIVE_DRIVER }).start();

  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      style={hideWebFocusRing}
    >
      <RNAnimated.View style={[styles.sendBtn, {
        backgroundColor: canSend ? BRAND_COLORS.ink : (isDark ? 'rgba(255,255,255,0.1)' : BRAND_COLORS.paperDeep),
        opacity: canSend ? 1 : 0.55,
        transform: [{ scale }]
      }]}>
        <ArrowUp
          size={16}
          strokeWidth={ICON_STROKE}
          color={canSend ? '#FFFFFF' : (isDark ? '#A1A1AA' : '#A1A1AA')}
        />
      </RNAnimated.View>
    </TouchableOpacity>
  );
};

const StudyChatScreen: React.FC = () => {
  const route = useRoute<ChatRouteProp>();
  const navigation = useNavigation();
  const { contentId, selectedText } = route.params;
  useSessionTracker(EVENTS.AI_CHAT_SESSION_STARTED, EVENTS.AI_CHAT_SESSION_ENDED, { content_id: contentId });
  useStudyPageDwell({ contentId, pageType: 'chat' });
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((state) => state.user);
  const isDark = themeMode === 'dark';

  const [inputMessage, setInputMessage] = useState('');
  const [contextText, setContextText] = useState<string | null>(selectedText || null);
  const [mentions, setMentions] = useState<ChatMentionCandidate[]>([]);
  const [mentionState, setMentionState] = useState<AtTriggerState | null>(null);
  const [menuForcedOpen, setMenuForcedOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [forcedSelection, setForcedSelection] = useState<{ start: number; end: number } | null>(null);
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const messagesRef = useRef<LocalChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const [inputContainerHeight, setInputContainerHeight] = useState(100);
  const flatListRef = useRef<FlatList>(null);
  const hasProcessedSelectedText = useRef(false);
  const inputRef = useRef<RNTextInput>(null);
  const inputMessageRef = useRef('');
  const selectionRef = useRef({ start: 0, end: 0 });
  const blurCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isChatAvailable, isLoading: isLoadingContent, content } = useChatAvailability(contentId);
  const chatMutation = useChat();
  const { allowed: chatAllowed, isLoading: chatAccessLoading } = useProFeatureAccess();

  const mentionCandidates = useMemo(
    () =>
      buildTopicMentionCandidates({
        topics: content?.topics,
        contentTitle: content?.title,
        contentId,
      }),
    [content?.topics, content?.title, contentId],
  );

  const filteredMentions = useMemo(() => {
    if (menuForcedOpen && !mentionState) {
      return filterMentionCandidates(mentionCandidates, '');
    }
    if (!mentionState) return [];
    return filterMentionCandidates(mentionCandidates, mentionState.query);
  }, [mentionCandidates, mentionState, menuForcedOpen]);

  const mentionMenuOpen =
    (Boolean(mentionState) || menuForcedOpen) && mentionCandidates.length > 0;

  const closeMentionMenu = useCallback(() => {
    setMentionState(null);
    setMenuForcedOpen(false);
  }, []);

  const addMention = useCallback((item: ChatMentionCandidate) => {
    setMentions((prev) => {
      if (prev.some((m) => m.id === item.id)) return prev;
      return [...prev, item];
    });
  }, []);

  const removeMention = useCallback((id: string) => {
    setMentions((prev) => prev.filter((m) => m.id !== id));
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: '',
      headerBackVisible: false,
      headerTitleContainerStyle: { marginLeft: 0 },
      headerLeft: () => (
        <View style={styles.headerBrand}>
          <BrandMark size={20} color={isDark ? '#7A9E86' : BRAND_COLORS.ink} />
          <RNText style={[styles.headerTitle, { color: isDark ? '#FAFAFA' : '#18181B' }]}>
            Ask AI
          </RNText>
        </View>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[
            styles.closeButton,
            hideWebFocusRing,
            { backgroundColor: isDark ? 'rgba(63,107,79,0.25)' : 'rgba(63,107,79,0.14)' },
          ]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
          accessibilityLabel="Close chat"
        >
          <X size={14} strokeWidth={ICON_STROKE} color={isDark ? '#9BB8A6' : BRAND_COLORS.ink} />
        </TouchableOpacity>
      ),
      headerStyle: {
        backgroundColor: isDark ? '#09090B' : '#FFFFFF',
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.10)',
      },
      headerShadowVisible: false,
    });
  }, [navigation, theme.colors, isDark]);

  useEffect(() => {
    if (selectedText && selectedText.trim() && !hasProcessedSelectedText.current) {
      setContextText(selectedText.trim());
      hasProcessedSelectedText.current = true;
    }
  }, [selectedText]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === 'function') active.blur();
  }, []);

  useEffect(() => {
    setMessages([]);
    setMentions([]);
    setMentionState(null);
    setMenuForcedOpen(false);
  }, [contentId]);

  useEffect(() => {
    return () => {
      if (blurCloseTimerRef.current) clearTimeout(blurCloseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const id = setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(id);
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!inputMessage.trim() || chatMutation.isPending || !user?.id) return;
    const trimmedMessage = inputMessage.trim();
    const mentionsForSend = mentions;
    const contextToSend = serializeChatContext({
      selection: contextText,
      mentions: mentionsForSend,
    });
    const historyPayload: ChatMessage[] = messagesRef.current
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content)
      .filter((m) => !m.isError && !(m.role === 'assistant' && m.content.startsWith("I'm having trouble")))
      .slice(-100)
      .map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp || null,
        contextText: m.contextText || null,
      }));
    const userMessage: LocalChatMessage = {
      role: 'user',
      content: trimmedMessage,
      timestamp: new Date().toISOString(),
      contextText: contextToSend || undefined,
      isNew: true,
    };
    setMessages((prev) => [...prev, userMessage]);
    inputMessageRef.current = '';
    selectionRef.current = { start: 0, end: 0 };
    setInputMessage('');
    setContextText(null);
    setMentions([]);
    setMentionState(null);
    setMenuForcedOpen(false);
    hasProcessedSelectedText.current = false;
    analytics.track(EVENTS.AI_CHAT_MESSAGE_SENT, {
      content_id: contentId,
      has_context: Boolean(contextToSend),
      mention_count: mentionsForSend.length,
    });
    try {
      const result = await chatMutation.mutateAsync({
        message: trimmedMessage,
        contentId,
        userId: user.id,
        context: contextToSend,
        history: historyPayload,
      });
      if (result.success && result.data) {
        const responseData = result.data;
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: responseData.response,
            timestamp: new Date().toISOString(),
            retrieval_successful: responseData.retrieval_successful,
            isError: Boolean(responseData.error_code),
            error_code: responseData.error_code || undefined,
            isNew: true,
          },
        ]);
      } else {
        throw new Error(result.message || 'Failed to send message');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send message. Please try again.');
      setMessages((prev) => prev.slice(0, -1));
    }
  }, [inputMessage, contextText, mentions, contentId, user?.id, chatMutation]);

  const handleRemoveContext = useCallback(() => {
    setContextText(null);
    hasProcessedSelectedText.current = false;
  }, []);

  const [showScrollDown, setShowScrollDown] = useState(false);
  const handleScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distance = contentSize.height - contentOffset.y - layoutMeasurement.height;
    setShowScrollDown(distance > 240);
  }, []);
  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowScrollDown(false);
  }, []);

  const [previewText, setPreviewText] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setPreviewText(inputMessage), 400);
    return () => clearTimeout(id);
  }, [inputMessage]);

  const markdownStyles = useMemo(
    () => ({
      body: { color: theme.colors.onSurface, fontSize: 15, lineHeight: 24, fontFamily: Fonts.ui.regular },
      paragraph: { fontFamily: Fonts.ui.regular, marginTop: 0, marginBottom: 8 },
      strong: { fontFamily: Fonts.ui.bold },
      em: { fontFamily: Fonts.ui.regular, fontStyle: 'italic' as const },
      link: { fontFamily: Fonts.ui.regular, color: theme.colors.primary },
      heading1: { fontFamily: Fonts.ui.bold, fontSize: 19, marginTop: 6, marginBottom: 8 },
      heading2: { fontFamily: Fonts.ui.bold, fontSize: 17, marginTop: 6, marginBottom: 6 },
      heading3: { fontFamily: Fonts.ui.semiBold, fontSize: 15, marginTop: 4, marginBottom: 4 },
      bullet_list: { marginBottom: 6 },
      ordered_list: { marginBottom: 6 },
      list_item: { marginBottom: 3 },
      code_inline: {
        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
        color: theme.colors.primary,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        fontSize: 13,
        fontFamily: Fonts.ui.regular,
      },
      code_block: {
        backgroundColor: isDark ? '#18181b' : '#f8fafc',
        color: theme.colors.onSurface,
        padding: 12,
        borderRadius: 10,
        fontSize: 13,
        fontFamily: Fonts.ui.regular,
        marginVertical: 6,
      },
      fence: {
        backgroundColor: isDark ? '#18181b' : '#f8fafc',
        color: theme.colors.onSurface,
        padding: 12,
        borderRadius: 10,
        fontSize: 13,
        fontFamily: Fonts.ui.regular,
        marginVertical: 6,
      },
      blockquote: {
        backgroundColor: 'transparent',
        borderColor: isDark ? '#3a3a40' : '#cbd5e1',
        borderLeftWidth: 3,
        paddingLeft: 12,
        marginVertical: 4,
      },
      hr: { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)', height: 1, marginVertical: 10 },
      ...createMarkdownTableStyles(isDark),
    }),
    [theme.colors.onSurface, theme.colors.primary, isDark],
  );

  const markdownRules = useMemo(() => createMarkdownTableRules(), []);
  const markdownItInstance = useMemo(() => createMarkdownItWithTables(), []);

  const renderMessage = useCallback(
    ({ item: message, index }: { item: LocalChatMessage; index: number }) => {
      const isUser = message.role === 'user';
      const list = messagesRef.current;
      const prevMessage = index > 0 ? list[index - 1] : null;
      const nextMessage = index < list.length - 1 ? list[index + 1] : null;
      const isFirstInGroup = !prevMessage || prevMessage.role !== message.role;
      const isLastInGroup = !nextMessage || nextMessage.role !== message.role;
      const marginBottom = isLastInGroup ? 16 : 3;

      const rich = hasMath(message.content);

      if (isUser) {
        return (
          <AnimatedMessageBubble isNew={!!message.isNew} style={[styles.userRow, { marginBottom }]}>
            <View
              style={[
                styles.userBubble,
                { backgroundColor: isDark ? '#18181B' : BRAND_COLORS.paper },
                rich && { width: RICH_WIDTH },
              ]}
            >
              {rich ? (
                <KatexWebView
                  content={message.content}
                  backgroundColor={isDark ? '#18181B' : BRAND_COLORS.paper}
                  textColor={isDark ? '#FAFAFA' : '#27272A'}
                  fontSize={13}
                />
              ) : (
                <RNText style={[styles.userText, { color: isDark ? '#FAFAFA' : '#27272A' }]}>{message.content}</RNText>
              )}
            </View>
          </AnimatedMessageBubble>
        );
      }

      return (
        <AnimatedMessageBubble isNew={!!message.isNew} style={[styles.assistantRow, { marginBottom }]}>
          <View style={styles.assistantAvatarCol}>
            {isFirstInGroup ? (
              <DarwinAvatar size={AVATAR_SIZE} />
            ) : (
              <View style={styles.avatarSpacer} />
            )}
          </View>
          <View style={styles.assistantBubbleWrap}>
            {message.isError ? (
              <View
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <RNText style={{ color: theme.colors.onSurfaceVariant, fontSize: 14, fontFamily: Fonts.ui.regular, lineHeight: 20 }}>
                  {message.content}
                </RNText>
              </View>
            ) : rich ? (
              <KatexWebView
                content={message.content}
                backgroundColor={theme.colors.background}
                textColor={theme.colors.onSurface}
                fontSize={15}
              />
            ) : (
              <Markdown
                style={markdownStyles}
                rules={markdownRules}
                markdownit={markdownItInstance}
              >
                {message.content}
              </Markdown>
            )}
          </View>
        </AnimatedMessageBubble>
      );
    },
    [theme.colors, isDark, markdownStyles]
  );

  const keyExtractor = useCallback((item: ChatMessage, index: number) => {
    return `${item.role}-${item.timestamp}-${index}`;
  }, []);

  const renderFooter = useCallback(() => {
    if (!chatMutation.isPending) return null;
    return (
      <View style={[styles.assistantRow, { marginBottom: 4 }]}>
        <View style={styles.assistantAvatarCol}>
          <DarwinAvatar size={AVATAR_SIZE} />
        </View>
        <RNText style={[styles.thinkingText, { color: isDark ? '#A1A1AA' : '#71717A' }]}>
          Thinking…
        </RNText>
      </View>
    );
  }, [chatMutation.isPending, theme.colors, isDark]);

  const canSend = inputMessage.trim().length > 0 && !chatMutation.isPending;
  const isFirstTurn = messages.length === 0;
  const chatBg = isDark ? '#09090B' : '#FFFFFF';

  const placeCursor = useCallback((pos: number) => {
    selectionRef.current = { start: pos, end: pos };
    setForcedSelection({ start: pos, end: pos });
    requestAnimationFrame(() => setForcedSelection(null));
  }, []);

  const handleChangeText = useCallback((text: string) => {
    const prev = inputMessageRef.current;
    const cursor = estimateCursorAfterChange(prev, text, selectionRef.current);
    inputMessageRef.current = text;
    setInputMessage(text);
    selectionRef.current = { start: cursor, end: cursor };
    setMenuForcedOpen(false);
    setMentionState(getAtTriggerState(text, cursor));
  }, []);

  const handleSelectionChange = useCallback((e: { nativeEvent: { selection: { start: number; end: number } } }) => {
    const sel = e.nativeEvent.selection;
    selectionRef.current = sel;
    if (menuForcedOpen) return;
    setMentionState(getAtTriggerState(inputMessageRef.current, sel.end));
  }, [menuForcedOpen]);

  const handleInputFocus = useCallback(() => {
    if (blurCloseTimerRef.current) {
      clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
    setInputFocused(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    setInputFocused(false);
    blurCloseTimerRef.current = setTimeout(() => {
      closeMentionMenu();
      blurCloseTimerRef.current = null;
    }, 180);
  }, [closeMentionMenu]);

  const selectMention = useCallback((item: ChatMentionCandidate) => {
    if (!item) return;
    if (blurCloseTimerRef.current) {
      clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
    addMention(item);
    const label = `@${String(item.title || '').trim()} `;
    const text = inputMessageRef.current;
    const range = mentionState;
    let next: string;
    let cursor: number;
    if (range) {
      next = `${text.slice(0, range.from)}${label}${text.slice(range.to)}`;
      cursor = range.from + label.length;
    } else {
      const start = selectionRef.current.start;
      const end = selectionRef.current.end;
      next = `${text.slice(0, start)}${label}${text.slice(end)}`;
      cursor = start + label.length;
    }
    inputMessageRef.current = next;
    setInputMessage(next);
    placeCursor(cursor);
    closeMentionMenu();
    inputRef.current?.focus();
  }, [addMention, closeMentionMenu, mentionState, placeCursor]);

  const openReferenceMenu = useCallback(() => {
    if (chatMutation.isPending || mentionCandidates.length === 0) return;
    if (blurCloseTimerRef.current) {
      clearTimeout(blurCloseTimerRef.current);
      blurCloseTimerRef.current = null;
    }
    setMenuForcedOpen(true);
    setMentionState(null);
    inputRef.current?.focus();
  }, [chatMutation.isPending, mentionCandidates.length]);

  const composer = (
    <View
      style={[styles.bottomBarWrap, { backgroundColor: isFirstTurn ? 'transparent' : chatBg }]}
      onLayout={(e) => setInputContainerHeight(e.nativeEvent.layout.height)}
    >
      {(contextText || mentions.length > 0) && (
        <View style={styles.contextBanner}>
          {mentions.length > 0 ? (
            <View style={styles.mentionChipRow}>
              {mentions.map((mention) => (
                <View
                  key={mention.id}
                  style={[
                    styles.mentionChip,
                    {
                      backgroundColor: isDark ? 'rgba(63,107,79,0.22)' : 'rgba(63,107,79,0.10)',
                      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(63,107,79,0.15)',
                    },
                  ]}
                >
                  <RNText
                    style={[styles.mentionChipText, { color: isDark ? '#9BB8A6' : BRAND_COLORS.growth }]}
                    numberOfLines={1}
                  >
                    @{mention.title}
                  </RNText>
                  <TouchableOpacity
                    onPress={() => removeMention(mention.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={hideWebFocusRing}
                    accessibilityLabel={`Remove @${mention.title}`}
                  >
                    <X size={12} strokeWidth={ICON_STROKE} color={isDark ? '#9BB8A6' : BRAND_COLORS.ink} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
          {contextText ? (
            <View style={[styles.contextInner, {
              backgroundColor: isDark ? '#18181B' : BRAND_COLORS.paper,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)',
            }]}>
              <View style={{ flex: 1 }}>
                <RNText style={[styles.contextLabel, { color: isDark ? '#9BB8A6' : BRAND_COLORS.growth }]}>
                  Selected text
                </RNText>
                <RNText style={[styles.contextText, { color: isDark ? '#A1A1AA' : '#52525B' }]} numberOfLines={2}>
                  {contextText}
                </RNText>
              </View>
              <TouchableOpacity
                onPress={handleRemoveContext}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={hideWebFocusRing}
              >
                <X size={14} strokeWidth={ICON_STROKE} color={isDark ? '#A1A1AA' : '#71717A'} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {hasMath(previewText) && (
        <View style={styles.previewWrap}>
          <View style={[styles.previewCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' }]}>
            <RNText style={[styles.previewLabel, { color: theme.colors.onSurfaceVariant }]}>Preview</RNText>
            <KatexWebView
              content={previewText}
              backgroundColor="transparent"
              textColor={theme.colors.onSurface}
              fontSize={15}
            />
          </View>
        </View>
      )}

      <View style={[styles.inputArea, isFirstTurn && styles.inputAreaFirstTurn]}>
        {mentionMenuOpen ? (
          <ChatMentionMenu
            items={filteredMentions}
            isDark={isDark}
            onSelect={selectMention}
          />
        ) : null}
        <View
          style={[
            styles.inputCard,
            hideWebFocusRing,
            {
              backgroundColor: isDark ? '#18181B' : '#FFFFFF',
              borderColor: inputFocused
                ? (isDark ? 'rgba(155,184,166,0.45)' : 'rgba(63,107,79,0.35)')
                : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,47,35,0.12)'),
            },
            isFirstTurn ? styles.inputCardFirstTurn : styles.inputCardDocked,
          ]}
        >
          <TouchableOpacity
            onPress={openReferenceMenu}
            disabled={chatMutation.isPending || mentionCandidates.length === 0}
            style={[styles.attachBtn, hideWebFocusRing, mentionCandidates.length === 0 && { opacity: 0.4 }]}
            accessibilityLabel="Reference a note section"
            activeOpacity={0.7}
          >
            <Paperclip size={16} strokeWidth={ICON_STROKE} color={isDark ? '#9BB8A6' : BRAND_COLORS.ink} />
          </TouchableOpacity>
          <RNTextInput
            ref={inputRef}
            value={inputMessage}
            onChangeText={handleChangeText}
            onSelectionChange={handleSelectionChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            {...(forcedSelection ? { selection: forcedSelection } : {})}
            placeholder={contextText ? 'Ask about the selected text...' : "Type a question here or type '@' to reference notes..."}
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#A1A1AA'}
            multiline
            style={[styles.textInput, hideWebFocusRing, { color: isDark ? '#FAFAFA' : '#18181B' }]}
            editable={!chatMutation.isPending}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            blurOnSubmit={false}
            autoCorrect={false}
            autoComplete="off"
            autoCapitalize="sentences"
            spellCheck={false}
            importantForAutofill="no"
            underlineColorAndroid="transparent"
            keyboardType="default"
          />
          <AnimatedSendButton
            onPress={handleSend}
            disabled={!canSend}
            canSend={canSend}
            isDark={isDark}
          />
        </View>
      </View>
    </View>
  );

  if (!chatAllowed) {
    return (
      <View style={[styles.container, { backgroundColor: chatBg }]}>
        {chatAccessLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <ChatProGate />
        )}
      </View>
    );
  }

  if (isLoadingContent) {
    return (
      <View style={[styles.container, { backgroundColor: chatBg }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (!isChatAvailable) {
    return (
      <View style={[styles.container, { backgroundColor: chatBg }]}>
        <View style={styles.centered}>
          <DarwinAvatar size={48} />
          <RNText style={[styles.emptyTitle, { color: theme.colors.onSurface, marginTop: 16 }]}>
            Preparing chat…
          </RNText>
          <RNText style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant, marginTop: 8 }]}>
            Chat will be available once your notes are ready.
          </RNText>
        </View>
      </View>
    );
  }

  if (isFirstTurn) {
    return (
      <View style={[styles.container, { backgroundColor: chatBg }]}>
        <KeyboardStickyView offset={{ closed: 0, opened: 0 }} style={styles.firstTurnSticky}>
          <View style={styles.firstTurnInner}>
            <WelcomeGreeting isDark={isDark} />
            {composer}
          </View>
        </KeyboardStickyView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: chatBg }]}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        ListFooterComponent={renderFooter}
        style={styles.flatList}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: inputContainerHeight + 32 },
        ]}
        keyboardShouldPersistTaps="always"
        removeClippedSubviews={false}
        maxToRenderPerBatch={8}
        windowSize={12}
        initialNumToRender={15}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        showsVerticalScrollIndicator={false}
      />

      {showScrollDown && (
        <TouchableOpacity
          style={[
            styles.scrollDownBtn,
            {
              bottom: inputContainerHeight + 14,
              backgroundColor: isDark ? '#18181B' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,47,35,0.15)',
            },
          ]}
          onPress={scrollToBottom}
          activeOpacity={0.85}
        >
          <ChevronDown size={20} strokeWidth={ICON_STROKE} color={isDark ? '#9BB8A6' : BRAND_COLORS.ink} />
        </TouchableOpacity>
      )}

      <KeyboardStickyView offset={{ closed: 0, opened: 0 }} style={styles.stickyContainer}>
        {composer}
      </KeyboardStickyView>
    </View>
  );
};

const AVATAR_SIZE = 28;

const styles = StyleSheet.create({
  container: { flex: 1 },
  flatList: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  stickyContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  firstTurnSticky: {
    flex: 1,
  },
  firstTurnInner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  bottomBarWrap: {
    overflow: 'visible',
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: -0.2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: Fonts.ui.bold,
    letterSpacing: -0.4,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Fonts.ui.regular,
    textAlign: 'center',
    marginBottom: 32,
  },
  welcomeCopy: {
    alignItems: 'center',
    marginBottom: 8,
  },
  welcomeTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: -0.6,
    textAlign: 'center',
    minHeight: 36,
  },
  welcomeSub: {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: Fonts.ui.regular,
    textAlign: 'center',
    maxWidth: 340,
    minHeight: 24,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingLeft: 56,
  },
  userBubble: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '78%',
    overflow: 'hidden',
    ...boxShadow('0 1px 2px rgba(26,47,35,0.06)', {
      shadowColor: BRAND_COLORS.ink,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 1,
    }),
  },
  userText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Fonts.ui.regular,
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: 40,
    gap: 10,
  },
  assistantAvatarCol: {
    width: AVATAR_SIZE,
    paddingTop: 2,
  },
  avatarSpacer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  assistantBubbleWrap: {
    flex: 1,
    paddingTop: 2,
  },
  thinkingText: {
    fontSize: 13,
    fontFamily: Fonts.ui.regular,
    paddingTop: 6,
  },
  contextBanner: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    paddingTop: 4,
    gap: 8,
  },
  mentionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mentionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  mentionChipText: {
    maxWidth: 220,
    fontSize: 12,
    fontFamily: Fonts.ui.medium,
  },
  contextInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  contextLabel: {
    fontSize: 11,
    fontFamily: Fonts.ui.medium,
    marginBottom: 2,
  },
  contextText: {
    fontSize: 13,
    fontFamily: Fonts.ui.regular,
  },
  inputArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    overflow: 'visible',
  },
  inputAreaFirstTurn: {
    paddingHorizontal: 0,
    paddingTop: 20,
    paddingBottom: 0,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 22,
    borderWidth: 1,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 8,
    minHeight: 52,
    ...hideWebFocusRing,
  },
  inputCardFirstTurn: {
    ...boxShadow('0 16px 48px rgba(26,47,35,0.10)', {
      shadowColor: BRAND_COLORS.ink,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 8,
    }),
  },
  inputCardDocked: {
    ...boxShadow('0 8px 28px rgba(26,47,35,0.08)', {
      shadowColor: BRAND_COLORS.ink,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 4,
    }),
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Fonts.ui.regular,
    maxHeight: 120,
    minHeight: 36,
    paddingTop: 8,
    paddingBottom: 8,
    textAlignVertical: 'center',
    marginRight: 8,
    ...hideWebFocusRing,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginBottom: 0,
  },
  scrollDownBtn: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    ...boxShadow('0 8px 20px rgba(26,47,35,0.12)', {
      shadowColor: BRAND_COLORS.ink,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4,
    }),
  },
  previewWrap: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  previewCard: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewLabel: {
    fontSize: 10,
    fontFamily: Fonts.ui.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
});

export default StudyChatScreen;
