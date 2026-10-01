import React, {
  useEffect,
  useRef,
  memo,
  useState,
  useCallback,
} from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  ScrollView,
  PanResponder,
  Vibration,
  Easing,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { USE_NATIVE_DRIVER } from '@/theme/webCompat';

interface BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  showDragHandle?: boolean;
  snapPoints?: number[];
  initialSnap?: number;
  footer?: React.ReactNode;
}

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const CLOSE_DRAG_THRESHOLD = 100;
const CLOSE_VELOCITY_THRESHOLD = 0.8;

const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onDismiss,
  children,
  showDragHandle = true,
  footer,
}) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 12);

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const [isMounted, setIsMounted] = useState(visible);
  const [modalVisible, setModalVisible] = useState(visible);
  const [, setSheetHeight] = useState(0);

  const isClosingRef = useRef(false);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const triggerHaptic = useCallback((type: 'open' | 'close' | 'threshold') => {
    if (Platform.OS === 'ios') {
      Vibration.vibrate(type === 'threshold' ? 10 : type === 'open' ? 5 : 8);
    } else {
      if (type === 'threshold') Vibration.vibrate(15);
    }
  }, []);

  const animateOpen = useCallback(() => {
    isClosingRef.current = false;
    translateY.setValue(SCREEN_HEIGHT);
    backdropOpacity.setValue(0);
    scaleAnim.setValue(0.95);

    triggerHaptic('open');

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: USE_NATIVE_DRIVER,
        tension: 55,
        friction: 10,
        velocity: 0.5,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: USE_NATIVE_DRIVER,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
        tension: 55,
        friction: 10,
      }),
    ]).start();
  }, [translateY, backdropOpacity, scaleAnim, triggerHaptic]);

  const closeSheet = useCallback(
    (fromGesture: boolean) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;

      if (fromGesture) {
        triggerHaptic('close');
      }

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT,
          duration: 280,
          useNativeDriver: USE_NATIVE_DRIVER,
          easing: Easing.inOut(Easing.cubic),
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 280,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setModalVisible(false);
        setIsMounted(false);
        isClosingRef.current = false;
        if (fromGesture) onDismissRef.current();
      });
    },
    [translateY, backdropOpacity, scaleAnim, triggerHaptic],
  );

  const closeSheetRef = useRef(closeSheet);
  useEffect(() => {
    closeSheetRef.current = closeSheet;
  }, [closeSheet]);

  const hasOpenedRef = useRef(false);
  useEffect(() => {
    if (visible) {
      if (hasOpenedRef.current) return;
      hasOpenedRef.current = true;
      setIsMounted(true);
      setModalVisible(true);
      translateY.setValue(SCREEN_HEIGHT);
      backdropOpacity.setValue(0);
      scaleAnim.setValue(0.95);
      requestAnimationFrame(() => {
        requestAnimationFrame(animateOpen);
      });
    } else if (hasOpenedRef.current) {
      hasOpenedRef.current = false;
      closeSheet(false);
    }
  }, [visible]);

  const scrollYRef = useRef(0);

  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 1.5,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) {
          const resistance = 1 - Math.min(dy / (SCREEN_HEIGHT * 1.5), 0.8);
          translateY.setValue(dy * resistance);
        } else {
          translateY.setValue(dy * 0.15);
        }
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const shouldClose =
          dy > CLOSE_DRAG_THRESHOLD || vy > CLOSE_VELOCITY_THRESHOLD;

        if (dy > CLOSE_DRAG_THRESHOLD * 0.7 && !shouldClose) {
          triggerHaptic('threshold');
        }

        if (shouldClose) {
          closeSheetRef.current(true);
          return;
        }

        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: USE_NATIVE_DRIVER,
          tension: 70,
          friction: 12,
          velocity: vy,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: USE_NATIVE_DRIVER,
          tension: 70,
          friction: 12,
        }).start();
      },
    }),
  ).current;

  const contentPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dy, dx }) => {
        if (scrollYRef.current > 2) return false;
        if (dy <= 10) return false;
        return Math.abs(dy) > Math.abs(dx) * 1.5;
      },
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) {
          const resistance = 1 - Math.min(dy / (SCREEN_HEIGHT * 1.5), 0.8);
          translateY.setValue(dy * resistance);
        }
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const shouldClose =
          dy > CLOSE_DRAG_THRESHOLD || vy > CLOSE_VELOCITY_THRESHOLD;

        if (shouldClose) {
          closeSheetRef.current(true);
          return;
        }

        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: USE_NATIVE_DRIVER,
          tension: 70,
          friction: 12,
          velocity: vy,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: USE_NATIVE_DRIVER,
          tension: 70,
          friction: 12,
        }).start();
      },
    }),
  ).current;

  const handleBackdropPress = useCallback(() => {
    triggerHaptic('close');
    closeSheet(true);
  }, [closeSheet, triggerHaptic]);

  if (!isMounted) return null;

  const backdropInterpolation = backdropOpacity.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)'],
  });

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleBackdropPress}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              backgroundColor: backdropInterpolation,
            }
          ]}
        >
          <TouchableOpacity
            style={styles.backdropTouchable}
            activeOpacity={1}
            onPress={handleBackdropPress}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              transform: [
                { translateY },
                { scale: scaleAnim }
              ],
            },
            Platform.select({
              ios: {
                shadowColor: themeMode === 'dark' ? '#000' : '#1a1a1a',
                shadowOffset: { width: 0, height: -6 },
                shadowOpacity: themeMode === 'dark' ? 0.4 : 0.15,
                shadowRadius: 20,
              },
              android: {
                elevation: 24,
              },
            }),
          ]}
          onLayout={(e) => setSheetHeight(e.nativeEvent.layout.height)}
        >
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.keyboardView}
            enabled={Platform.OS !== 'web'}
          >
            {showDragHandle && (
              <View style={styles.dragHandleContainer}>
                <View
                  style={styles.dragHandleWrapper}
                  {...handlePanResponder.panHandlers}
                >
                  <View
                    style={[
                      styles.dragHandle,
                      {
                        backgroundColor: themeMode === 'dark'
                          ? 'rgba(255,255,255,0.2)'
                          : 'rgba(0,0,0,0.15)'
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <View
              style={[
                styles.scrollView,
                {
                  maxHeight:
                    SCREEN_HEIGHT * 0.92 -
                    (showDragHandle ? 44 : 0) -
                    (footer ? 76 + bottomInset : 0),
                },
              ]}
              {...contentPanResponder.panHandlers}
            >
              <ScrollView
                contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: footer ? 12 : bottomInset + 8 },
                ]}
                showsVerticalScrollIndicator={false}
                bounces={false}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                scrollEventThrottle={16}
                decelerationRate="fast"
                onScroll={(e) => {
                  scrollYRef.current = e.nativeEvent.contentOffset.y;
                }}
              >
                {children}
              </ScrollView>
            </View>

            {footer ? (
              <View
                style={[
                  styles.footer,
                  {
                    borderTopColor: theme.colors.outlineVariant,
                    paddingBottom: bottomInset,
                  },
                ]}
              >
                {footer}
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropTouchable: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: SCREEN_WIDTH,
    maxHeight: SCREEN_HEIGHT * 0.92,
    overflow: 'hidden',
  },
  keyboardView: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.92,
  },
  dragHandleContainer: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragHandleWrapper: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  dragHandle: {
    width: 36,
    height: 4.5,
    borderRadius: 3,
  },
  scrollView: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});

export default memo(BottomSheet);