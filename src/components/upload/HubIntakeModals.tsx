import React, { createElement, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import {
  ChevronRight,
  FileText,
  Link2,
  Loader2,
  Mic,
  Upload,
  X,
  type LucideIcon,
} from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { BRAND_COLORS } from '@/config/brand';
import { Fonts } from '@/config/fonts';
import { useAppTheme } from '@/store/appThemeStore';
import FeatureProTag from '@/components/ui/pro/FeatureProTag';
import { validateYouTubeUrl } from '@/utils/youtubeUrl';

export type HubIntakeKind = 'document' | 'youtube' | 'audio';

export type PickedUploadFile = {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
};

export function pickedFileFromWeb(file: File): PickedUploadFile {
  return {
    uri: URL.createObjectURL(file),
    name: file.name,
    mimeType: file.type || undefined,
    size: file.size,
  };
}

const BRAND = '#1A2F23';
const BRAND_15 = 'rgba(26,47,35,0.15)';
const BRAND_12 = 'rgba(26,47,35,0.12)';
const BRAND_30 = 'rgba(26,47,35,0.30)';
const BRAND_35 = 'rgba(26,47,35,0.35)';
const GROWTH = '#3F6B4F';
const ZINC_900 = '#18181B';
const ZINC_800 = '#27272A';
const ZINC_600 = '#52525B';
const ZINC_400 = '#A1A1AA';
const ZINC_300 = '#D4D4D8';
const ZINC_200 = '#E4E4E7';
const BACKDROP = 'rgba(24,24,27,0.45)';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function useIntakeTheme() {
  const isDark = useAppTheme() === 'dark';
  return {
    isDark,
    surface: isDark ? '#111113' : '#FFFFFF',
    onSurface: isDark ? '#FAFAFA' : ZINC_900,
    onSurfaceVariant: isDark ? '#A1A1AA' : ZINC_600,
    mutedIcon: isDark ? '#A1A1AA' : ZINC_400,
    border: isDark ? 'rgba(255,255,255,0.08)' : BRAND_12,
    dashBorder: isDark ? 'rgba(255,255,255,0.15)' : ZINC_300,
    dropBorder: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(228,228,231,0.9)',
    iconBg: isDark ? 'rgba(63,107,79,0.3)' : BRAND_15,
    iconFg: isDark ? '#9BB8A6' : BRAND,
    inputBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(228,228,231,0.9)',
    readyBorder: isDark ? 'rgba(122,158,134,0.4)' : BRAND_30,
    readyRing: isDark ? 'rgba(122,158,134,0.2)' : BRAND_15,
    errorBorder: isDark ? 'rgba(180,83,9,0.5)' : 'rgba(252,211,77,0.7)',
    errorBg: isDark ? 'rgba(69,26,3,0.3)' : 'rgba(255,251,235,0.8)',
    recordBoxBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(228,228,231,0.9)',
    closeHover: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(63,107,79,0.14)',
  };
}

type ShellProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  withKeyboard?: boolean;
  children: React.ReactNode;
};

const HubIntakeModalShell: React.FC<ShellProps> = ({ open, onClose, labelledBy, withKeyboard, children }) => {
  const t = useIntakeTheme();
  const [mounted, setMounted] = useState(open);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [open, progress]);

  if (!mounted) return null;

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={withKeyboard && Platform.OS === 'ios' ? 'padding' : undefined}
        accessibilityViewIsModal
        accessibilityLabelledBy={labelledBy}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View
          style={[
            styles.panel,
            {
              backgroundColor: t.surface,
              borderColor: t.border,
              opacity: progress,
              transform: [{ scale }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            },
          ]}
        >
          <Pressable
            onPress={onClose}
            hitSlop={8}
            accessibilityLabel="Close"
            style={styles.closeBtn}
          >
            <X size={20} strokeWidth={ICON_STROKE} color={t.mutedIcon} />
          </Pressable>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

function GenerateNotesButton({
  ready,
  processing,
  onPress,
}: {
  ready: boolean;
  processing: boolean;
  onPress: () => void;
}) {
  const disabled = !ready || processing;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Generate Notes"
      style={({ pressed }) => [
        styles.generateBtn,
        { backgroundColor: BRAND, opacity: disabled ? 0.5 : pressed ? 0.92 : 1 },
      ]}
    >
      {processing ? <ActivityIndicator size="small" color="#FAFAFA" /> : null}
      <Text style={styles.generateLabel}>{processing ? 'Creating…' : 'Generate Notes'}</Text>
    </Pressable>
  );
}

function DropZone({
  onPress,
  accept,
  onWebFile,
  dragging,
  ready,
  error,
  children,
}: {
  onPress: () => void;
  accept?: string;
  onWebFile?: (file: File) => void;
  dragging?: boolean;
  ready?: boolean;
  error?: boolean;
  children: React.ReactNode;
}) {
  const t = useIntakeTheme();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const borderColor = error
    ? t.errorBorder
    : dragging
      ? 'rgba(63,107,79,0.4)'
      : ready
        ? t.readyBorder
        : t.dashBorder;
  const backgroundColor = error
    ? t.errorBg
    : dragging
      ? 'rgba(63,107,79,0.08)'
      : t.surface;

  const handlePress = () => {
    if (Platform.OS === 'web' && inputRef.current) {
      inputRef.current.click();
      return;
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      style={[
        styles.dropZone,
        {
          borderColor,
          backgroundColor,
          borderStyle: error || ready ? 'solid' : 'dashed',
        },
      ]}
    >
      {Platform.OS === 'web' && accept && onWebFile
        ? createElement('input', {
            ref: (node: HTMLInputElement | null) => {
              inputRef.current = node;
            },
            type: 'file',
            accept,
            style: { display: 'none' },
            onChange: (event: { target: HTMLInputElement }) => {
              const file = event.target.files?.[0];
              if (file) onWebFile(file);
              event.target.value = '';
            },
          })
        : null}
      <Upload size={20} strokeWidth={ICON_STROKE} color={t.iconFg} />
      {children}
    </Pressable>
  );
}

type CreateOption = {
  id: HubIntakeKind;
  label: string;
  subtitle: string;
  Icon: LucideIcon;
  bg: string;
  color: string;
  loading?: boolean;
  disabled?: boolean;
  proLocked?: boolean;
};

export function CreateOptionListItem({
  option,
  onSelect,
}: {
  option: CreateOption;
  onSelect: (id: HubIntakeKind) => void;
}) {
  const t = useIntakeTheme();
  const Icon = option.Icon;
  return (
    <Pressable
      onPress={() => onSelect(option.id)}
      disabled={option.disabled}
      accessibilityRole="button"
      accessibilityLabel={option.proLocked ? `${option.label}, Pro feature, locked` : option.label}
      style={({ pressed }) => [
        styles.listRow,
        { backgroundColor: pressed ? (t.isDark ? 'rgba(255,255,255,0.04)' : '#FAFAFA') : 'transparent', opacity: option.disabled ? 0.5 : 1 },
      ]}
    >
      <View style={[styles.listIcon, { backgroundColor: option.bg }]}>
        {option.loading ? (
          <Loader2 size={20} strokeWidth={ICON_STROKE} color={option.color} />
        ) : (
          <Icon size={20} strokeWidth={ICON_STROKE} color={option.color} opacity={option.proLocked ? 0.5 : 1} />
        )}
        {option.proLocked ? <FeatureProTag variant="icon" /> : null}
      </View>
      <View style={styles.listText}>
        <View style={styles.listTitleRow}>
          <Text style={[styles.listTitle, { color: t.onSurface }]} numberOfLines={1}>
            {option.label}
          </Text>
          {option.proLocked ? <FeatureProTag variant="inline" /> : null}
        </View>
        <Text style={styles.listSubtitle} numberOfLines={1}>
          {option.subtitle}
        </Text>
      </View>
      <ChevronRight size={20} strokeWidth={ICON_STROKE} color={ZINC_400} />
    </Pressable>
  );
}

export const CREATE_SHEET_OPTIONS: CreateOption[] = [
  { id: 'document', label: 'Upload', subtitle: 'PDF, slides, or Word', Icon: Upload, bg: 'rgba(63,107,79,0.12)', color: BRAND },
  { id: 'youtube', label: 'Paste', subtitle: 'YouTube link', Icon: Link2, bg: '#E8EDE9', color: GROWTH },
  { id: 'audio', label: 'Record', subtitle: 'Lecture or audio file', Icon: Mic, bg: '#DDE6E0', color: '#2F4F3E' },
];

export function HubDocumentUploadModal({
  open,
  selectedFile,
  fileError,
  submitError,
  isProcessing,
  onClose,
  onPickFile,
  onWebFile,
  onSubmit,
}: {
  open: boolean;
  selectedFile: PickedUploadFile | null;
  fileError?: string | null;
  submitError?: string | null;
  isProcessing: boolean;
  onClose: () => void;
  onPickFile: () => void;
  onWebFile?: (file: File) => void;
  onSubmit: () => void;
}) {
  const t = useIntakeTheme();
  const ready = Boolean(selectedFile) && !fileError;

  return (
    <HubIntakeModalShell open={open} onClose={onClose} labelledBy="document-upload-title">
      <View style={styles.header}>
        <View style={[styles.heroIcon, { backgroundColor: t.iconBg }]}>
          <FileText size={20} strokeWidth={ICON_STROKE} color={t.iconFg} />
          <Text style={[styles.docMark, { color: t.iconFg }]}>DOC</Text>
        </View>
        <Text nativeID="document-upload-title" style={[styles.title, { color: t.onSurface }]}>
          Create note from file
        </Text>
      </View>

      <View style={styles.body}>
        <DropZone
          onPress={onPickFile}
          accept=".pdf,.ppt,.pptx,.doc,.docx"
          onWebFile={onWebFile}
          ready={ready}
          error={Boolean(fileError)}
        >
          {fileError ? (
            <Text style={styles.errorText}>Filename needs a rename</Text>
          ) : selectedFile ? (
            <Text style={[styles.fileName, { color: t.isDark ? '#F4F4F5' : ZINC_800 }]} numberOfLines={1}>
              {selectedFile.name}
            </Text>
          ) : (
            <Text style={[styles.dropHint, { color: t.isDark ? '#D4D4D8' : ZINC_600 }]}>
              Drag documents here, or click to upload
            </Text>
          )}
        </DropZone>
      </View>

      {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
      <GenerateNotesButton ready={ready} processing={isProcessing} onPress={onSubmit} />
    </HubIntakeModalShell>
  );
}

export function HubLinkPasteModal({
  open,
  value,
  isProcessing,
  submitError,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean;
  value: string;
  isProcessing: boolean;
  submitError?: string | null;
  onClose: () => void;
  onChange: (next: string) => void;
  onSubmit: () => void;
}) {
  const t = useIntakeTheme();
  const trimmed = value.trim();
  const validation = validateYouTubeUrl(trimmed);
  const ready = Boolean(trimmed) && validation.valid;
  const linkError = trimmed && !validation.valid ? validation.message : submitError;

  const handleSubmit = () => {
    if (isProcessing) return;
    if (!validateYouTubeUrl(value).valid) return;
    onSubmit();
  };

  return (
    <HubIntakeModalShell open={open} onClose={onClose} labelledBy="link-paste-title" withKeyboard>
      <View style={styles.header}>
        <View style={[styles.heroIconRound, { backgroundColor: t.iconBg }]}>
          <View style={styles.ytBody}>
            <View style={styles.ytTriangle} />
          </View>
        </View>
        <Text nativeID="link-paste-title" style={[styles.title, { color: t.onSurface }]}>
          Create note from link
        </Text>
      </View>

      <View style={styles.body}>
        <View
          style={[
            styles.linkField,
            {
              backgroundColor: t.surface,
              borderColor: linkError ? '#F59E0B' : ready ? t.readyBorder : t.inputBorder,
              shadowColor: ready && !linkError ? BRAND : 'transparent',
            },
            ready && !linkError && { shadowOpacity: 0, borderWidth: 1 },
          ]}
        >
          <Link2
            size={16}
            strokeWidth={ICON_STROKE}
            color={linkError ? '#D97706' : ready ? t.iconFg : ZINC_400}
          />
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Paste a YouTube link…"
            placeholderTextColor={ZINC_400}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            keyboardType="url"
            returnKeyType="done"
            editable={!isProcessing}
            onSubmitEditing={handleSubmit}
            style={[styles.linkInput, { color: t.onSurface }]}
          />
        </View>
      </View>

      {linkError ? <Text style={styles.submitError}>{linkError}</Text> : null}
      <GenerateNotesButton ready={ready} processing={isProcessing} onPress={handleSubmit} />
    </HubIntakeModalShell>
  );
}

const WAVEFORM_DELAYS = [0, 70, 140, 40, 180, 90, 30, 160, 50, 120, 80, 20, 150, 60, 110, 10, 170, 100, 45, 130];

function RecordingWaveform({ active }: { active: boolean }) {
  return (
    <View style={styles.waveform} accessibilityElementsHidden>
      {WAVEFORM_DELAYS.map((delay, index) => (
        <WaveBar key={`${delay}-${index}`} delay={delay} active={active} />
      ))}
    </View>
  );
}

function WaveBar({ delay, active }: { delay: number; active: boolean }) {
  const scale = useRef(new Animated.Value(0.28)).current;
  useEffect(() => {
    if (!active) {
      scale.stopAnimation();
      scale.setValue(0.28);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(scale, { toValue: 0.26, duration: 380, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    const start = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [active, delay, scale]);

  return (
    <Animated.View
      style={[
        styles.waveBar,
        { transform: [{ scaleY: scale }] },
      ]}
    />
  );
}

export function HubAudioCaptureModal({
  open,
  isProcessing,
  isRecording,
  isStartingRecording,
  recordingError,
  recordingDuration,
  recordedReady,
  recordedLabel,
  selectedFile,
  audioMode,
  onClose,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onPickFile,
  onWebFile,
  onSubmit,
  submitError,
}: {
  open: boolean;
  isProcessing: boolean;
  isRecording: boolean;
  isStartingRecording: boolean;
  recordingError?: string | null;
  recordingDuration: number;
  recordedReady: boolean;
  recordedLabel?: string | null;
  selectedFile: PickedUploadFile | null;
  audioMode: 'record' | 'upload';
  onClose: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onPickFile: () => void;
  onWebFile?: (file: File) => void;
  onSubmit: () => void;
  submitError?: string | null;
}) {
  const t = useIntakeTheme();
  const ready =
    (audioMode === 'upload' && Boolean(selectedFile)) ||
    (audioMode === 'record' && recordedReady && !isRecording);

  return (
    <HubIntakeModalShell open={open} onClose={onClose} labelledBy="audio-capture-title">
      <View style={styles.header}>
        <View
          style={[
            styles.heroIconRound,
            { backgroundColor: isRecording ? 'rgba(254,226,226,1)' : t.iconBg },
          ]}
        >
          <Mic size={24} strokeWidth={ICON_STROKE} color={isRecording ? '#DC2626' : t.iconFg} />
        </View>
        <Text nativeID="audio-capture-title" style={[styles.title, { color: t.onSurface }]}>
          Create note from audio
        </Text>
      </View>

      <View style={[styles.recordBox, { borderColor: t.recordBoxBorder, backgroundColor: t.surface }]}>
        <View style={styles.recordRow}>
          <Text style={[styles.recordLabel, { color: t.isDark ? '#F4F4F5' : ZINC_800 }]}>Make a recording</Text>
          {!isRecording && !recordedReady ? (
            <Pressable
              onPress={onStartRecording}
              disabled={isStartingRecording}
              style={({ pressed }) => [styles.recordPill, { opacity: isStartingRecording ? 0.7 : pressed ? 0.92 : 1 }]}
            >
              <Mic size={14} strokeWidth={ICON_STROKE} color="#FAFAFA" />
              <Text style={styles.recordPillText}>{isStartingRecording ? 'Starting…' : 'Record'}</Text>
            </Pressable>
          ) : null}
          {isRecording ? (
            <Pressable onPress={onStopRecording} style={styles.secondaryPill}>
              <View style={styles.stopSquare} />
              <Text style={styles.secondaryPillText}>Stop</Text>
            </Pressable>
          ) : null}
          {recordedReady && !isRecording ? (
            <Pressable onPress={onCancelRecording} style={styles.secondaryPill}>
              <Text style={styles.secondaryPillText}>Discard</Text>
            </Pressable>
          ) : null}
        </View>

        {isRecording ? (
          <View style={styles.recordingLive}>
            <View style={styles.recBadgeRow}>
              <View style={styles.recDot} />
              <Text style={styles.recLiveLabel}>RECORDING</Text>
              <Text style={[styles.recTime, { color: t.onSurface }]}>{formatDuration(recordingDuration)}</Text>
            </View>
            <RecordingWaveform active />
          </View>
        ) : (
          <View style={styles.idleWave}>
            <Mic size={16} strokeWidth={ICON_STROKE} color={t.iconFg} />
            {recordedReady ? (
              <Text style={styles.readyHint}>{recordedLabel || `Ready · ${formatDuration(recordingDuration)}`}</Text>
            ) : (
              <View style={[styles.dashLine, { borderColor: t.isDark ? 'rgba(255,255,255,0.15)' : ZINC_200 }]} />
            )}
          </View>
        )}

        {recordingError ? (
          <Text style={styles.recordingError} accessibilityRole="alert">
            {recordingError}
          </Text>
        ) : null}

        {recordedReady && !isRecording ? (
          <Pressable onPress={onStartRecording} hitSlop={6}>
            <Text style={[styles.recordAgain, { color: t.iconFg }]}>Record again</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.orRow} accessibilityElementsHidden>
        <View style={[styles.orLine, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.1)' : ZINC_200 }]} />
        <Text style={styles.orText}>Or</Text>
        <View style={[styles.orLine, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.1)' : ZINC_200 }]} />
      </View>

      <DropZone
        onPress={onPickFile}
        accept=".mp3,.m4a,.webm,audio/mpeg,audio/mp4,audio/x-m4a,audio/webm"
        onWebFile={onWebFile}
        ready={Boolean(selectedFile) && audioMode === 'upload'}
      >
        {selectedFile && audioMode === 'upload' ? (
          <>
            <Text style={[styles.fileName, { color: t.isDark ? '#F4F4F5' : ZINC_800 }]} numberOfLines={1}>
              {selectedFile.name}
            </Text>
            <Text style={styles.replaceHint}>
              {typeof selectedFile.size === 'number'
                ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB · tap to replace`
                : 'tap to replace'}
            </Text>
          </>
        ) : (
          <Text style={[styles.dropHint, { color: t.isDark ? '#D4D4D8' : ZINC_600 }]}>
            Drag audio here, or click to upload
          </Text>
        )}
      </DropZone>

      {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
      <GenerateNotesButton ready={ready} processing={isProcessing} onPress={onSubmit} />
    </HubIntakeModalShell>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: BACKDROP,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' } : null),
  },
  panel: {
    width: '100%',
    maxWidth: 448,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    ...Platform.select({
      web: { boxShadow: '0 28px 80px -20px rgba(26,47,35,0.35)' },
      ios: {
        shadowColor: BRAND,
        shadowOpacity: 0.22,
        shadowRadius: 28,
        shadowOffset: { width: 0, height: 16 },
      },
      android: { elevation: 16 },
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 4,
    alignItems: 'center',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconRound: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docMark: {
    marginTop: 2,
    fontSize: 9,
    fontFamily: Fonts.ui.bold,
    letterSpacing: 0.6,
    lineHeight: 10,
  },
  title: {
    marginTop: 12,
    fontSize: 18,
    lineHeight: 24,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  body: {
    marginTop: 20,
  },
  dropZone: {
    minHeight: 88,
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
  },
  dropHint: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.ui.regular,
    textAlign: 'center',
  },
  fileName: {
    maxWidth: 256,
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    fontFamily: Fonts.ui.medium,
    color: '#92400E',
    textAlign: 'center',
  },
  generateBtn: {
    marginTop: 20,
    width: '100%',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
  },
  generateLabel: {
    color: '#FAFAFA',
    fontSize: 16,
    fontFamily: Fonts.ui.semiBold,
  },
  ytBody: {
    width: 40,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ytTriangle: {
    marginLeft: 2,
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
  },
  linkField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  linkInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.ui.regular,
    padding: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as const } : null),
  },
  recordBox: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  recordLabel: {
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
  },
  recordPill: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: BRAND,
  },
  recordPillText: {
    color: '#FAFAFA',
    fontSize: 14,
    fontFamily: Fonts.ui.medium,
  },
  secondaryPill: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.paper,
    borderWidth: 1,
    borderColor: BRAND_12,
  },
  secondaryPillText: {
    color: ZINC_800,
    fontSize: 14,
    fontFamily: Fonts.ui.medium,
  },
  recordingLive: {
    marginTop: 12,
    gap: 8,
  },
  recBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recLiveLabel: {
    fontSize: 12,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.8,
    color: '#DC2626',
  },
  recTime: {
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
    fontVariant: ['tabular-nums'],
  },
  waveform: {
    height: 44,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  waveBar: {
    width: 3,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#EF4444',
  },
  idleWave: {
    marginTop: 10,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dashLine: {
    flex: 1,
    height: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  readyHint: {
    fontSize: 12,
    color: ZINC_400,
    fontFamily: Fonts.ui.regular,
  },
  recordingError: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: Fonts.ui.medium,
    color: '#DC2626',
  },
  recordAgain: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: Fonts.ui.medium,
  },
  orRow: {
    marginVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  orText: {
    fontSize: 12,
    fontFamily: Fonts.ui.medium,
    color: ZINC_400,
  },
  replaceHint: {
    marginTop: 2,
    fontSize: 12,
    color: ZINC_400,
    fontFamily: Fonts.ui.regular,
  },
  submitError: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.ui.medium,
    color: '#DC2626',
    textAlign: 'center',
  },
  stopSquare: {
    width: 10,
    height: 10,
    borderRadius: 1,
    backgroundColor: ZINC_800,
  },
  listRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  listText: {
    flex: 1,
    minWidth: 0,
  },
  listTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listTitle: {
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
    flexShrink: 1,
  },
  listSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
    color: ZINC_400,
  },
});
