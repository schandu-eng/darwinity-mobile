import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageCircle } from '@/icons';
import { TourAnchor } from '@/components/ui/feature-tour';
import { BRAND_COLORS } from '@/config/brand';
import { useAppTheme } from '@/store/appThemeStore';
import { boxShadow } from '@/theme/webCompat';
import { storageGet, storageSet } from '@/components/ui/feature-tour/safeStorage';
import {
  FLOATING_CHAT_FAB_MARGIN,
  FLOATING_CHAT_FAB_SIZE,
  FLOATING_CHAT_FAB_STORAGE_KEY,
  FLOATING_CHAT_FAB_TAP_SLOP,
  clampFloatingChatPosition,
  defaultFloatingChatPosition,
  fromFloatingChatFractions,
  parseFloatingChatFractions,
  serializeFloatingChatFractions,
  toFloatingChatFractions,
} from '@shared/floatingChatFab.js';

type Props = {
  onPress: () => void;
  bottomInset: number;
  visible?: boolean;
  tourStepId?: string;
};

type Point = { x: number; y: number };

export default function FloatingChatButton({
  onPress,
  bottomInset,
  visible = true,
  tourStepId = 'chat',
}: Props) {
  const isDark = useAppTheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const boundsFor = useCallback(
    (w: number, h: number, top: number, bottom: number) => ({
      width: w,
      height: h,
      size: FLOATING_CHAT_FAB_SIZE,
      margin: FLOATING_CHAT_FAB_MARGIN,
      topInset: top,
      bottomInset: bottom,
    }),
    [],
  );

  const initial = defaultFloatingChatPosition(
    boundsFor(width, height, insets.top, bottomInset),
  );
  const pos = useRef(new Animated.ValueXY(initial)).current;
  const posRef = useRef<Point>(initial);
  const originRef = useRef<Point>(initial);
  const fractionsRef = useRef<{ fx: number; fy: number } | null>(null);
  const onPressRef = useRef(onPress);
  const applyPointRef = useRef<(next: Point) => void>(() => {});
  const persistRef = useRef<(next: Point) => void>(() => {});
  const boundsRef = useRef(() => boundsFor(width, height, insets.top, bottomInset));

  onPressRef.current = onPress;
  boundsRef.current = () => boundsFor(width, height, insets.top, bottomInset);

  const applyPoint = useCallback(
    (next: Point) => {
      posRef.current = next;
      pos.setValue(next);
    },
    [pos],
  );
  applyPointRef.current = applyPoint;

  const persist = useCallback((next: Point) => {
    const fractions = toFloatingChatFractions(next.x, next.y, boundsRef.current());
    fractionsRef.current = fractions;
    void storageSet(
      FLOATING_CHAT_FAB_STORAGE_KEY,
      serializeFloatingChatFractions(fractions.fx, fractions.fy),
    );
  }, []);
  persistRef.current = persist;

  const layoutToStoredOrDefault = useCallback(() => {
    const bounds = boundsRef.current();
    if (bounds.width < FLOATING_CHAT_FAB_SIZE || bounds.height < FLOATING_CHAT_FAB_SIZE) return;
    const fractions = fractionsRef.current;
    applyPoint(
      fractions
        ? fromFloatingChatFractions(fractions.fx, fractions.fy, bounds)
        : defaultFloatingChatPosition(bounds),
    );
  }, [applyPoint]);

  useEffect(() => {
    const id = pos.addListener((value) => {
      posRef.current = value;
    });
    return () => pos.removeListener(id);
  }, [pos]);

  useEffect(() => {
    let cancelled = false;
    void storageGet(FLOATING_CHAT_FAB_STORAGE_KEY).then((raw) => {
      if (cancelled) return;
      fractionsRef.current = parseFloatingChatFractions(raw);
      layoutToStoredOrDefault();
    });
    return () => {
      cancelled = true;
    };
  }, [layoutToStoredOrDefault]);

  useEffect(() => {
    layoutToStoredOrDefault();
  }, [layoutToStoredOrDefault, width, height, bottomInset, insets.top]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          originRef.current = { ...posRef.current };
        },
        onPanResponderMove: (_, gesture) => {
          applyPointRef.current(
            clampFloatingChatPosition({
              x: originRef.current.x + gesture.dx,
              y: originRef.current.y + gesture.dy,
              ...boundsRef.current(),
            }),
          );
        },
        onPanResponderRelease: (_, gesture) => {
          const next = clampFloatingChatPosition({
            x: originRef.current.x + gesture.dx,
            y: originRef.current.y + gesture.dy,
            ...boundsRef.current(),
          });
          applyPointRef.current(next);
          persistRef.current(next);
          if (Math.hypot(gesture.dx, gesture.dy) < FLOATING_CHAT_FAB_TAP_SLOP) {
            onPressRef.current();
          }
        },
        onPanResponderTerminate: (_, gesture) => {
          const next = clampFloatingChatPosition({
            x: originRef.current.x + gesture.dx,
            y: originRef.current.y + gesture.dy,
            ...boundsRef.current(),
          });
          applyPointRef.current(next);
          persistRef.current(next);
        },
      }),
    [],
  );

  if (!visible) return null;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel="Ask AI about these notes"
      accessibilityHint="Drag to move"
      style={[
        styles.fab,
        {
          backgroundColor: isDark ? '#3F6B4F' : BRAND_COLORS.ink,
          left: pos.x,
          top: pos.y,
        },
        Platform.OS === 'web'
          ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as object)
          : null,
      ]}
    >
      <TourAnchor stepId={tourStepId} style={styles.tourFill}>
        <View pointerEvents="none">
          <MessageCircle size={22} strokeWidth={2.25} color="#FAFAFA" />
        </View>
      </TourAnchor>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: FLOATING_CHAT_FAB_SIZE,
    height: FLOATING_CHAT_FAB_SIZE,
    borderRadius: FLOATING_CHAT_FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    ...boxShadow('0 8px 24px rgba(26,47,35,0.32)', {
      shadowColor: '#1A2F23',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.32,
      shadowRadius: 12,
      elevation: 10,
    }),
  },
  tourFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
