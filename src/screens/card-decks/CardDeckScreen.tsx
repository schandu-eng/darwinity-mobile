import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import CardDecksTab from '@/components/study-hub/CardDecksTab';
import FlashcardsProGate from '@/components/study-hub/FlashcardsProGate';
import type { ContentStackParamList } from '@/types/navigation';
import { useSessionTracker } from '@/analytics/useSessionTracker';
import { EVENTS } from '@/analytics/events';
import { useStudyPageDwell } from '@/features/concentration/useStudyPageDwell';

type FlashcardRouteProp = RouteProp<ContentStackParamList, 'Flashcards'>;

const CloseButton = React.memo<{ onPress: () => void; backgroundColor: string; iconColor: string }>(
  ({ onPress, backgroundColor, iconColor }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.closeButton, { backgroundColor }]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name="close" size={20} color={iconColor} />
    </TouchableOpacity>
  )
);
CloseButton.displayName = 'CloseButton';

const DeckMenuButton = React.memo<{ onPress: () => void; iconColor: string; backgroundColor: string }>(
  ({ onPress, iconColor, backgroundColor }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.menuButton, { backgroundColor }]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name="dots-horizontal" size={20} color={iconColor} />
    </TouchableOpacity>
  )
);
DeckMenuButton.displayName = 'DeckMenuButton';

const CardDeckScreen: React.FC = () => {
  const route = useRoute<FlashcardRouteProp>();
  const navigation = useNavigation();
  const { contentId } = route.params;
  const themeMode = useAppTheme();
  const theme = useMemo(() => (themeMode === 'dark' ? darkTheme : lightTheme), [themeMode]);
  const recreateHandlerRef = useRef<(() => void) | null>(null);
  const [areFlashcardsDisplayed, setAreFlashcardsDisplayed] = useState(false);

  useSessionTracker(EVENTS.CARD_DECK_SESSION_STARTED, EVENTS.CARD_DECK_SESSION_ENDED, { content_id: contentId });
  useStudyPageDwell({ contentId, pageType: 'cards' });

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleRecreate = useCallback(() => {
    recreateHandlerRef.current?.();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: '',
      headerLeft: () => (
        <CloseButton
          onPress={handleGoBack}
          backgroundColor={theme.colors.surfaceVariant}
          iconColor={theme.colors.onSurface}
        />
      ),
      headerRight: () =>
        areFlashcardsDisplayed ? (
          <DeckMenuButton
            onPress={handleRecreate}
            backgroundColor={theme.colors.surfaceVariant}
            iconColor={theme.colors.onSurface}
          />
        ) : null,
      headerStyle: {
        backgroundColor: theme.colors.surface,
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 0,
      },
      headerShadowVisible: false,
    });
  }, [navigation, theme.colors.surface, theme.colors.surfaceVariant, theme.colors.onSurface, theme.colors.primary, handleGoBack, handleRecreate, areFlashcardsDisplayed]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlashcardsProGate>
        <CardDecksTab
          contentId={contentId}
          recreateHandlerRef={recreateHandlerRef}
          onFlashcardsDisplayedChange={setAreFlashcardsDisplayed}
        />
      </FlashcardsProGate>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
});

export default CardDeckScreen;
