import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, X } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { playGameClose } from '@/study-hub/gameFeedback';

type Theme = 'city' | 'orbit' | 'phantom';

const THEMES: Record<Theme, { brand: string; ink: string; muted: string; paper: string; heart: string; heartOff: string; backBg: string; backBorder: string; chromeBorder: string }> = {
  city: {
    brand: '#5f7f6a',
    ink: '#18181b',
    muted: '#71717a',
    paper: '#ffffff',
    heart: '#3d5646',
    heartOff: 'rgba(113, 113, 122, 0.35)',
    backBg: '#e8f0ea',
    backBorder: 'rgba(95, 127, 106, 0.18)',
    chromeBorder: 'rgba(95, 127, 106, 0.18)',
  },
  orbit: {
    brand: '#3d8a80',
    ink: '#18181b',
    muted: '#71717a',
    paper: '#ffffff',
    heart: '#1f4f4a',
    heartOff: 'rgba(113, 113, 122, 0.35)',
    backBg: '#d4ebe7',
    backBorder: 'rgba(61, 138, 128, 0.22)',
    chromeBorder: 'rgba(61, 138, 128, 0.22)',
  },
  phantom: {
    brand: '#b45a5a',
    ink: '#f4f0f0',
    muted: '#b0a0a0',
    paper: '#121816',
    heart: '#b45a5a',
    heartOff: 'rgba(176, 160, 160, 0.35)',
    backBg: '#2a1818',
    backBorder: 'rgba(180, 90, 90, 0.22)',
    chromeBorder: 'rgba(180, 90, 90, 0.22)',
  },
};

function LivesHearts({
  lives,
  colorOn,
  colorOff,
}: {
  lives: number;
  colorOn: string;
  colorOff: string;
}) {
  const prev = useRef(lives);
  const [lostIndex, setLostIndex] = useState<number | null>(null);
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (lives < prev.current) {
      const idx = lives;
      setLostIndex(idx);
      scale.setValue(1);
      opacity.setValue(1);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.55, duration: 90, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.25, duration: 280, useNativeDriver: true }),
        ]),
        Animated.timing(opacity, { toValue: 0.25, duration: 370, useNativeDriver: true }),
      ]).start(() => {
        setLostIndex(null);
        scale.setValue(1);
        opacity.setValue(1);
      });
    }
    prev.current = lives;
  }, [lives, opacity, scale]);

  return (
    <View style={styles.lives} accessibilityLabel={`${lives} lives`}>
      {Array.from({ length: 3 }).map((_, i) => {
        const on = i < lives;
        const animating = lostIndex === i;
        const heart = (
          <Heart
            size={18}
            strokeWidth={2}
            color={on || animating ? colorOn : colorOff}
            fill={on || animating ? colorOn : 'transparent'}
          />
        );
        if (animating) {
          return (
            <Animated.View key={i} style={{ transform: [{ scale }], opacity }}>
              {heart}
            </Animated.View>
          );
        }
        return <View key={i}>{heart}</View>;
      })}
    </View>
  );
}

type StudyGameShellProps = {
  title: string;
  subtitle?: string;
  lives?: number | null;
  score?: number | null;
  combo?: number | null;
  onExit: () => void;
  theme?: Theme;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export const StudyGameShell: React.FC<StudyGameShellProps> = ({
  lives = null,
  score = null,
  combo = null,
  onExit,
  theme = 'city',
  footer,
  children,
}) => {
  const colors = THEMES[theme];
  const insets = useSafeAreaInsets();
  const barStyle = theme === 'phantom' ? 'light-content' : 'dark-content';

  const handleClose = () => {
    playGameClose();
    onExit();
  };

  return (
    <View style={[styles.shell, { backgroundColor: colors.paper }]}>
      <StatusBar
        barStyle={barStyle}
        backgroundColor={colors.paper}
        translucent={Platform.OS === 'android'}
      />
      <View style={styles.stage}>{children}</View>
      <View
        style={[styles.chrome, { paddingTop: Math.max(insets.top, 10) }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={handleClose}
          style={[styles.close, { backgroundColor: colors.backBg, borderColor: colors.backBorder }]}
          hitSlop={12}
          accessibilityLabel="Close game"
        >
          <X size={20} strokeWidth={ICON_STROKE} color={colors.heart} />
        </TouchableOpacity>
        <View style={styles.stats}>
          {lives != null ? (
            <LivesHearts lives={lives} colorOn={colors.heart} colorOff={colors.heartOff} />
          ) : null}
          {score != null ? (
            <Text style={[styles.stat, { color: colors.muted }]}>Score {score}</Text>
          ) : null}
          {combo != null && combo > 1 ? (
            <Text style={[styles.combo, { color: colors.heart }]}>×{combo}</Text>
          ) : null}
        </View>
      </View>
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );
};

type GameOverOverlayProps = {
  won: boolean;
  score: number | string;
  correct?: number;
  total?: number;
  onRetry: () => void;
  onExit: () => void;
  title?: string;
  brand?: string;
};

export const GameOverOverlay: React.FC<GameOverOverlayProps> = ({
  won,
  score,
  correct,
  total,
  onRetry,
  onExit,
  title,
  brand = '#5f7f6a',
}) => (
  <View style={styles.overlay} accessibilityRole="alert">
    <View style={styles.overlayCard}>
      <Text style={styles.overlayKicker}>{won ? 'Cleared' : 'Run over'}</Text>
      <Text style={styles.overlayTitle}>{title || (won ? 'Nice recall' : 'Try again')}</Text>
      <Text style={styles.overlayMeta}>
        {typeof score === 'string' && score.includes('s') ? `Time ${score}` : `Score ${score}`}
        {total != null ? ` · ${correct}/${total} correct` : ''}
      </Text>
      <TouchableOpacity style={[styles.overlayBtn, { backgroundColor: brand }]} onPress={onRetry}>
        <Text style={styles.overlayBtnText}>Play again</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.overlayGhost} onPress={onExit}>
        <Text style={styles.overlayGhostText}>Back to games</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  shell: { flex: 1 },
  chrome: {
    ...StyleSheet.absoluteFillObject,
    bottom: undefined,
    zIndex: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 10,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lives: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  stat: { fontFamily: Fonts.ui.semiBold, fontSize: 13 },
  combo: { fontFamily: Fonts.ui.bold, fontSize: 13 },
  stage: { flex: 1, minHeight: 0 },
  footer: { paddingHorizontal: 16, paddingTop: 4 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250, 249, 246, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    padding: 20,
  },
  overlayCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(95, 127, 106, 0.18)',
  },
  overlayKicker: {
    fontFamily: Fonts.ui.bold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#71717a',
    textAlign: 'center',
  },
  overlayTitle: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 24,
    color: '#18181b',
    marginTop: 6,
    textAlign: 'center',
  },
  overlayMeta: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    color: '#71717a',
    marginTop: 6,
    marginBottom: 16,
    textAlign: 'center',
  },
  overlayBtn: { borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  overlayBtnText: { fontFamily: Fonts.ui.bold, fontSize: 15, color: '#fff' },
  overlayGhost: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#e8f0ea',
  },
  overlayGhostText: { fontFamily: Fonts.ui.semiBold, fontSize: 14, color: '#3d5646' },
});
