import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import CardDeckContent from './CardDeckContent';
import StudyHintToast from './FloatingHintToast';
import { useFloatingHint } from './useFloatingHint';
import { resolveFlashcardAnswerContent } from './cardDeckContentUtils';

import { Fonts } from '@/config/fonts';

type FaceStyle =
  | { type: 'solid'; backgroundColor: string; borderColor: string }
  | {
      type: 'gradient';
      colors: [string, string, ...string[]];
      start: { x: number; y: number };
      end: { x: number; y: number };
      borderColor: string;
    };

type Props = {
  front: string;
  back: string;
  hint?: string;
  isFlipped: boolean;
  onFlip: () => void;
  isDueRevision?: boolean;
  isStarred?: boolean;
  onToggleStar?: (() => void) | null;
  showTapHint?: boolean;
  flipOnClick?: boolean;
};

const getFaceStyle = (face: 'front' | 'back', isDueRevision: boolean, isDark: boolean): FaceStyle => {
  if (isDueRevision) {
    if (face === 'front') {
      return isDark
        ? {
            type: 'gradient',
            colors: ['rgba(69, 26, 3, 0.35)', '#27272A', '#27272A'],
            start: { x: 0, y: 0 },
            end: { x: 1, y: 1 },
            borderColor: 'rgba(180, 83, 9, 0.5)',
          }
        : {
            type: 'gradient',
            colors: ['rgba(255, 251, 235, 0.8)', '#FFFFFF', '#FFFFFF'],
            start: { x: 0, y: 0 },
            end: { x: 1, y: 1 },
            borderColor: 'rgba(253, 230, 138, 0.7)',
          };
    }
    return isDark
      ? {
          type: 'gradient',
          colors: ['rgba(69, 26, 3, 0.3)', 'rgba(23, 37, 84, 0.4)', '#27272A'],
          start: { x: 0, y: 0 },
          end: { x: 1, y: 1 },
          borderColor: 'rgba(180, 83, 9, 0.5)',
        }
      : {
          type: 'gradient',
          colors: ['rgba(255, 251, 235, 0.7)', 'rgba(239, 246, 255, 0.5)', '#FFFFFF'],
          start: { x: 0, y: 0 },
          end: { x: 1, y: 1 },
          borderColor: 'rgba(253, 230, 138, 0.7)',
        };
  }

  if (face === 'front') {
    return isDark
      ? { type: 'solid', backgroundColor: '#27272A', borderColor: '#52525B' }
      : { type: 'solid', backgroundColor: '#FFFFFF', borderColor: '#E4E4E7' };
  }

  return isDark
    ? {
        type: 'gradient',
        colors: ['rgba(23, 37, 84, 0.5)', '#27272A'],
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        borderColor: '#1D4ED8',
      }
    : {
        type: 'gradient',
        colors: ['#EFF6FF', '#FFFFFF'],
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        borderColor: '#BFDBFE',
      };
};

const CARD_MIN_HEIGHT = 240;

const CardDeckFlipCard: React.FC<Props> = ({
  front,
  back,
  hint,
  isFlipped,
  onFlip,
  isDueRevision = false,
  isStarred = false,
  onToggleStar = null,
  showTapHint = false,
  flipOnClick = true,
}) => {
  const themeMode = useAppTheme();
  const isDark = themeMode === 'dark';
  const hasHint = Boolean(hint?.trim());
  const { visible: hintVisible, fadingOut, showHint, hideImmediately } = useFloatingHint();

  useEffect(() => {
    hideImmediately();
  }, [front, isFlipped, hideImmediately]);

  const renderFace = (
    content: string,
    face: 'front' | 'back',
    revealOcclusion: boolean,
    showHintControl: boolean
  ) => {
    const faceStyle = getFaceStyle(face, isDueRevision, isDark);
    const faceShellStyle = [
      styles.cardFace,
      faceStyle.type === 'solid'
        ? { backgroundColor: faceStyle.backgroundColor, borderColor: faceStyle.borderColor }
        : { borderColor: faceStyle.borderColor },
    ];

    const faceBody = (
      <>
        <View style={styles.topBarAbsolute} pointerEvents="box-none">
          <View pointerEvents="auto">
            {showHintControl && hasHint ? (
              <TouchableOpacity
                onPress={showHint}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={[styles.hintButton, { borderColor: isDark ? '#52525B' : '#E4E4E7' }]}
                accessibilityLabel="Show hint"
              >
                <MaterialCommunityIcons
                  name="lightbulb-outline"
                  size={20}
                  color={isDark ? '#A1A1AA' : '#71717A'}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.hintPlaceholder} />
            )}
          </View>
          {onToggleStar ? (
            <TouchableOpacity
              onPress={onToggleStar}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              pointerEvents="auto"
            >
              <MaterialCommunityIcons
                name={isStarred ? 'star' : 'star-outline'}
                size={22}
                color={isStarred ? '#F59E0B' : isDark ? '#71717A' : '#D4D4D8'}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.hintPlaceholder} />
          )}
        </View>

        <StudyHintToast
          text={hint}
          visible={hintVisible && showHintControl}
          fadingOut={fadingOut}
          onDismiss={hideImmediately}
        />

        <View style={styles.cardBody}>
          <View style={styles.contentArea}>
            <CardDeckContent value={content} occlusionReveal={revealOcclusion} centered />
          </View>

          {showTapHint ? (
            <Text style={[styles.tapHint, { color: isDark ? '#71717A' : '#A1A1AA' }]}>
              {face === 'back' ? 'Tap card to flip back' : 'Tap card to see answer'}
            </Text>
          ) : null}
        </View>
      </>
    );

    if (faceStyle.type === 'gradient') {
      return (
        <LinearGradient
          colors={faceStyle.colors}
          start={faceStyle.start}
          end={faceStyle.end}
          style={faceShellStyle}
        >
          {faceBody}
        </LinearGradient>
      );
    }

    return <View style={faceShellStyle}>{faceBody}</View>;
  };

  const handlePress = () => {
    if (flipOnClick) onFlip();
  };

  const cardContent = (
    <View style={styles.wrapper}>
      {isFlipped
        ? renderFace(resolveFlashcardAnswerContent(front || '', back || ''), 'back', true, false)
        : renderFace(front, 'front', false, !isFlipped)}
    </View>
  );

  if (!flipOnClick) {
    return <View style={styles.touchable}>{cardContent}</View>;
  }

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={handlePress} style={styles.touchable}>
      {cardContent}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
    alignSelf: 'stretch',
  },
  wrapper: {
    width: '100%',
    minHeight: CARD_MIN_HEIGHT,
  },
  cardFace: {
    width: '100%',
    minHeight: CARD_MIN_HEIGHT,
    flexDirection: 'column',
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
      web: {
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      },
    }),
  },
  topBarAbsolute: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  hintButton: {
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  hintPlaceholder: {
    width: 36,
    height: 36,
  },
  cardBody: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 16,
  },
  contentArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  tapHint: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
    fontFamily: Fonts.ui.regular,
    opacity: 0.7,
  },
});

export default CardDeckFlipCard;
