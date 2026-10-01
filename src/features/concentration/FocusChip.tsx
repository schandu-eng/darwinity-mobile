import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Clock } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { useConcentrationSessionOptional } from './ConcentrationSessionProvider';
import { formatMmSs, getPresetById, POMODORO_PRESETS } from './allowlist';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { BRAND_COLORS } from '@/config/brand';

import { Fonts } from '@/config/fonts';

const RED = '#DC2626';
const RED_SOFT = '#FEF2F2';
const RED_BORDER = '#FECACA';

type ChipVariant = 'header' | 'modals';

export const ConcentrationChip: React.FC<{ variant?: ChipVariant }> = ({ variant = 'header' }) => {
  const focus = useConcentrationSessionOptional();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const [selectedPreset, setSelectedPreset] = useState('classic');

  useEffect(() => {
    if (focus?.presetId) setSelectedPreset(focus.presetId);
  }, [focus?.presetId]);

  if (!focus) return null;

  const {
    status,
    phaseRemaining,
    setupOpen,
    setSetupOpen,
    awayWarningOpen,
    awayRemaining,
    isAway,
    phaseBanner,
    setPhaseBanner,
    requestStart,
    startWithPreset,
    end,
    dismissAwayWarning,
    confirmLeaveAndEnd,
    returnToStudy,
  } = focus;

  const busy = status === 'finalizing';
  const active = status === 'running' || status === 'paused';
  const idleMinutes = getPresetById(selectedPreset).workMinutes;
  const pillLabel = isAway
    ? formatMmSs(awayRemaining)
    : active
      ? formatMmSs(phaseRemaining)
      : `${idleMinutes}m`;

  const pill = (
    <TouchableOpacity
      onPress={() => {
        if (busy) return;
        if (status === 'idle') requestStart();
      }}
      style={[
        styles.headerPill,
        {
          backgroundColor: isAway ? RED_SOFT : themeMode === 'dark' ? '#111113' : '#FFFFFF',
          borderColor: isAway
            ? RED_BORDER
            : themeMode === 'dark'
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(26,47,35,0.12)',
        },
      ]}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={active ? `Pomodoro ${pillLabel}` : `Start pomodoro ${pillLabel}`}
      disabled={busy}
    >
      {busy ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <>
          <Clock
            size={16}
            strokeWidth={ICON_STROKE}
            color={isAway ? RED : themeMode === 'dark' ? '#E4E4E7' : BRAND_COLORS.ink}
          />
          <Text
            style={[
              styles.headerLabel,
              { color: isAway ? RED : themeMode === 'dark' ? '#E4E4E7' : BRAND_COLORS.ink },
            ]}
          >
            {pillLabel}
          </Text>
          {active && !isAway ? (
            <TouchableOpacity onPress={() => void end()} hitSlop={8}>
              <Text style={[styles.endLabel, { color: theme.colors.error }]}>End</Text>
            </TouchableOpacity>
          ) : null}
          {isAway ? (
            <TouchableOpacity onPress={returnToStudy} hitSlop={8}>
              <Text style={[styles.endLabel, { color: RED }]}>Return</Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );

  const modals = (
    <>
      <Modal
        visible={setupOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSetupOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSetupOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: theme.colors.onSurface }]}>
              Start a pomodoro
            </Text>
            <Text style={[styles.sheetBody, { color: theme.colors.onSurfaceVariant }]}>
              Start from Home or any study screen. Leave Darwinity for 2 minutes and the session
              ends. If you turned on Block distractions, selected apps stay blocked during work and
              unlock on break.
            </Text>
            {POMODORO_PRESETS.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.preset,
                  {
                    borderColor:
                      selectedPreset === p.id ? theme.colors.primary : theme.colors.outlineVariant,
                  },
                ]}
                onPress={() => setSelectedPreset(p.id)}
              >
                <Text style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.semiBold }}>
                  {p.label} min
                </Text>
                <Text
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    fontFamily: Fonts.ui.regular,
                    fontSize: 12,
                  }}
                >
                  {p.workMinutes}m focus · {p.breakMinutes}m break
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.sheetActions}>
              <TouchableOpacity onPress={() => setSetupOpen(false)} style={styles.sheetBtn}>
                <Text style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.medium }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void startWithPreset(selectedPreset)}
                style={[
                  styles.sheetBtn,
                  styles.sheetPrimary,
                  { backgroundColor: theme.colors.primary },
                ]}
              >
                <Text style={{ color: theme.colors.onPrimary, fontFamily: Fonts.ui.semiBold }}>
                  Start
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={awayWarningOpen}
        transparent
        animationType="fade"
        onRequestClose={dismissAwayWarning}
      >
        <Pressable style={styles.backdrop} onPress={dismissAwayWarning}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: RED }]}>Session ending soon</Text>
            <Text style={styles.awayTimer}>{formatMmSs(awayRemaining)}</Text>
            <Text style={[styles.sheetBody, { color: theme.colors.onSurfaceVariant }]}>
              You left study. Open Home or any note before the timer runs out, or the session
              ends.
            </Text>
            <TouchableOpacity
              onPress={returnToStudy}
              style={[
                styles.sheetBtn,
                styles.sheetPrimary,
                { backgroundColor: theme.colors.primary, marginTop: 4 },
              ]}
            >
              <Text
                style={{
                  color: theme.colors.onPrimary,
                  fontFamily: Fonts.ui.semiBold,
                  textAlign: 'center',
                }}
              >
                Return to study
              </Text>
            </TouchableOpacity>
            <View style={styles.sheetActions}>
              <TouchableOpacity onPress={dismissAwayWarning} style={styles.sheetBtn}>
                <Text style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.medium }}>
                  Dismiss
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void confirmLeaveAndEnd()} style={styles.sheetBtn}>
                <Text style={{ color: theme.colors.error, fontFamily: Fonts.ui.medium }}>
                  End session
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(phaseBanner)}
        transparent
        animationType="fade"
        onRequestClose={() => setPhaseBanner(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPhaseBanner(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.sheetTitle, { color: theme.colors.onSurface }]}>
              {phaseBanner?.title}
            </Text>
            <Text style={[styles.sheetBody, { color: theme.colors.onSurfaceVariant }]}>
              {phaseBanner?.body}
            </Text>
            <TouchableOpacity
              onPress={() => setPhaseBanner(null)}
              style={[
                styles.sheetBtn,
                styles.sheetPrimary,
                { backgroundColor: theme.colors.primary, marginTop: 12 },
              ]}
            >
              <Text
                style={{
                  color: theme.colors.onPrimary,
                  fontFamily: Fonts.ui.semiBold,
                  textAlign: 'center',
                }}
              >
                Continue
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );

  if (variant === 'modals') return modals;
  return pill;
};

const styles = StyleSheet.create({
  headerPill: {
    height: 36,
    minWidth: 64,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(26,47,35,0.04)' },
      default: {
        shadowColor: '#1A2F23',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      },
    }),
  },
  headerLabel: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  endLabel: {
    fontFamily: Fonts.ui.medium,
    fontSize: 12,
    marginLeft: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  sheetTitle: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 18,
  },
  sheetBody: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    marginBottom: 8,
  },
  awayTimer: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 36,
    color: RED,
    textAlign: 'center',
    marginVertical: 4,
  },
  preset: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    gap: 2,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  sheetBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetPrimary: {},
});
